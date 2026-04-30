"""
Celery task definitions for workflow execution.

Tasks are designed to be idempotent, JSON-serializable, and publish
status updates to Redis pub/sub for real-time WebSocket notifications.
"""

from __future__ import annotations

import json
import time
import traceback
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

import redis
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.celery_app import celery
from app.core.config import settings
from app.models.task import ExecutionStatus, NodeExecution, WorkflowExecution

# ── Sync DB session for Celery workers ───────────────────────
# Celery tasks use synchronous SQLAlchemy since they run in prefork workers
_sync_db_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2").replace(
    "postgresql+asyncpg", "postgresql"
)
_sync_engine = create_engine(_sync_db_url, pool_size=5, max_overflow=2)
_SyncSession = sessionmaker(bind=_sync_engine)

# ── Redis client for pub/sub ─────────────────────────────────
_redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def _publish_status(
    execution_id: str,
    node_id: str | None,
    status: str,
    data: dict | None = None,
):
    """Publish execution status update to Redis pub/sub channel."""
    message = {
        "execution_id": execution_id,
        "node_id": node_id,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data or {},
    }
    channel = f"execution:{execution_id}"
    _redis_client.publish(channel, json.dumps(message))


def _execute_node_logic(node: dict, input_data: dict | None) -> dict:
    """
    Execute a single node's logic based on its type and config.

    This is the extensible core — add new node types here.
    """
    node_type = node.get("type", "action")
    config = node.get("config", {})

    if node_type == "trigger":
        # Trigger nodes pass through input data
        return {"triggered": True, "input": input_data}

    elif node_type == "action":
        # Simulated action execution
        action_type = config.get("action_type", "log")
        if action_type == "http_request":
            # In production, use httpx to make real requests
            return {
                "action": "http_request",
                "url": config.get("url", ""),
                "status": "simulated",
            }
        elif action_type == "transform":
            return {
                "action": "transform",
                "input": input_data,
                "output": config.get("transform_result", input_data),
            }
        else:
            return {"action": action_type, "result": "completed"}

    elif node_type == "condition":
        # Evaluate condition
        condition = config.get("condition", "true")
        result = True  # simplified — real impl would evaluate expressions
        return {"condition": condition, "result": result}

    elif node_type == "output":
        return {"output": input_data, "delivered": True}

    else:
        return {"type": node_type, "result": "executed"}


@celery.task(
    bind=True,
    name="app.workers.task_executor.execute_node",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def execute_node(
    self,
    execution_id: str,
    node_id: str,
    node_config: dict,
    input_data: dict | None = None,
) -> dict:
    """Execute a single workflow node."""
    with _SyncSession() as session:
        try:
            # Update node status to RUNNING
            session.execute(
                update(NodeExecution)
                .where(
                    NodeExecution.workflow_execution_id == uuid.UUID(execution_id),
                    NodeExecution.node_id == node_id,
                )
                .values(
                    status=ExecutionStatus.RUNNING,
                    started_at=datetime.now(timezone.utc),
                    celery_task_id=self.request.id,
                    worker_id=self.request.hostname,
                )
            )
            session.commit()

            _publish_status(execution_id, node_id, "running")

            # Execute node logic
            start_time = time.time()
            result = _execute_node_logic(node_config, input_data)
            duration = time.time() - start_time

            # Update node status to SUCCESS
            session.execute(
                update(NodeExecution)
                .where(
                    NodeExecution.workflow_execution_id == uuid.UUID(execution_id),
                    NodeExecution.node_id == node_id,
                )
                .values(
                    status=ExecutionStatus.SUCCESS,
                    completed_at=datetime.now(timezone.utc),
                    duration_seconds=duration,
                    output_data=result,
                )
            )
            session.commit()

            _publish_status(execution_id, node_id, "success", result)
            return result

        except Exception as exc:
            # Update node status to FAILED
            session.execute(
                update(NodeExecution)
                .where(
                    NodeExecution.workflow_execution_id == uuid.UUID(execution_id),
                    NodeExecution.node_id == node_id,
                )
                .values(
                    status=ExecutionStatus.FAILED,
                    completed_at=datetime.now(timezone.utc),
                    error=str(exc),
                )
            )
            session.commit()

            _publish_status(execution_id, node_id, "failed", {"error": str(exc)})

            # Retry if retries remaining
            if self.request.retries < self.max_retries:
                raise self.retry(exc=exc)
            raise


@celery.task(
    bind=True,
    name="app.workers.task_executor.execute_workflow",
    acks_late=True,
)
def execute_workflow(
    self,
    execution_id: str,
    workflow_id: str,
    tenant_id: str,
    dag: dict,
) -> dict:
    """
    Orchestrate execution of an entire workflow DAG.

    Executes nodes layer by layer (topological order).
    Nodes in the same layer run sequentially within this task
    (for true parallelism, dispatch each node as a separate Celery task).
    """
    with _SyncSession() as session:
        try:
            # Mark workflow execution as RUNNING
            session.execute(
                update(WorkflowExecution)
                .where(WorkflowExecution.id == uuid.UUID(execution_id))
                .values(
                    status=ExecutionStatus.RUNNING,
                    started_at=datetime.now(timezone.utc),
                )
            )
            session.commit()

            _publish_status(execution_id, None, "running")

            # Topological sort
            nodes_map = {n["id"]: n for n in dag.get("nodes", [])}
            edges = dag.get("edges", [])

            in_degree: dict[str, int] = {nid: 0 for nid in nodes_map}
            adjacency: dict[str, list[str]] = defaultdict(list)
            for edge in edges:
                adjacency[edge["source"]].append(edge["target"])
                in_degree[edge["target"]] += 1

            queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
            node_results: dict[str, dict] = {}

            start_time = time.time()

            while queue:
                layer = list(queue)
                next_queue: deque[str] = deque()

                for node_id in layer:
                    node_config = nodes_map[node_id]

                    # Gather input from parent nodes
                    parent_outputs = {}
                    for edge in edges:
                        if edge["target"] == node_id and edge["source"] in node_results:
                            parent_outputs[edge["source"]] = node_results[edge["source"]]

                    input_data = parent_outputs if parent_outputs else None

                    # Execute node
                    result = execute_node(
                        execution_id, node_id, node_config, input_data
                    )
                    node_results[node_id] = result

                    # Update adjacency
                    for neighbor in adjacency[node_id]:
                        in_degree[neighbor] -= 1
                        if in_degree[neighbor] == 0:
                            next_queue.append(neighbor)

                queue = next_queue

            duration = time.time() - start_time

            # Mark workflow execution as SUCCESS
            session.execute(
                update(WorkflowExecution)
                .where(WorkflowExecution.id == uuid.UUID(execution_id))
                .values(
                    status=ExecutionStatus.SUCCESS,
                    completed_at=datetime.now(timezone.utc),
                    duration_seconds=duration,
                    output_data=node_results,
                )
            )
            session.commit()

            _publish_status(execution_id, None, "success", {"duration": duration})
            return {"status": "success", "duration": duration}

        except Exception as exc:
            session.execute(
                update(WorkflowExecution)
                .where(WorkflowExecution.id == uuid.UUID(execution_id))
                .values(
                    status=ExecutionStatus.FAILED,
                    completed_at=datetime.now(timezone.utc),
                    error=traceback.format_exc(),
                )
            )
            session.commit()

            _publish_status(
                execution_id, None, "failed", {"error": str(exc)}
            )
            raise


@celery.task(name="app.workers.task_executor.schedule_check")
def schedule_check():
    """
    Periodic task — checks for workflows with cron schedules that are due.
    Called every minute by Celery Beat.
    """
    from croniter import croniter

    with _SyncSession() as session:
        from app.models.workflow import Workflow

        workflows = session.execute(
            select(Workflow).where(
                Workflow.is_active.is_(True),
                Workflow.schedule.isnot(None),
                Workflow.trigger_type == "cron",
            )
        ).scalars().all()

        now = datetime.now(timezone.utc)

        for wf in workflows:
            try:
                cron = croniter(wf.schedule, now)
                prev_run = cron.get_prev(datetime)
                # If previous scheduled time is within the last 60 seconds, trigger
                if (now - prev_run).total_seconds() < 60:
                    execution = WorkflowExecution(
                        workflow_id=wf.id,
                        tenant_id=wf.tenant_id,
                        trigger_type="cron",
                        status=ExecutionStatus.PENDING,
                    )
                    session.add(execution)
                    session.flush()

                    execute_workflow.delay(
                        str(execution.id),
                        str(wf.id),
                        str(wf.tenant_id),
                        wf.dag_definition,
                    )
            except Exception:
                pass  # Log and continue — one bad cron shouldn't block others

        session.commit()
