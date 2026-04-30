"""
Workflow DAG execution engine.

Parses the JSONB dag_definition, performs topological sort to determine
execution order, and builds a Celery canvas (chain/group/chord) for
distributed execution.
"""

from __future__ import annotations

import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import ExecutionStatus, NodeExecution, WorkflowExecution
from app.models.workflow import Workflow

logger = structlog.get_logger()


class DAGValidationError(Exception):
    """Raised when DAG structure is invalid."""
    pass


class WorkflowEngine:
    """
    Core engine for parsing, validating, and executing workflow DAGs.

    The engine:
    1. Validates the DAG (no cycles, all edges reference valid nodes)
    2. Topologically sorts nodes to determine execution order
    3. Creates a WorkflowExecution + NodeExecution records
    4. Dispatches to Celery for distributed execution
    """

    @staticmethod
    def validate_dag(dag: dict) -> bool:
        """
        Validate DAG structure — ensure no cycles and all references are valid.

        Raises DAGValidationError on failure.
        """
        nodes = {n["id"]: n for n in dag.get("nodes", [])}
        edges = dag.get("edges", [])

        if not nodes:
            raise DAGValidationError("DAG has no nodes")

        # Check all edge references
        for edge in edges:
            if edge["source"] not in nodes:
                raise DAGValidationError(
                    f"Edge source '{edge['source']}' not found in nodes"
                )
            if edge["target"] not in nodes:
                raise DAGValidationError(
                    f"Edge target '{edge['target']}' not found in nodes"
                )

        # Check for cycles using Kahn's algorithm
        in_degree: dict[str, int] = {nid: 0 for nid in nodes}
        adjacency: dict[str, list[str]] = defaultdict(list)

        for edge in edges:
            adjacency[edge["source"]].append(edge["target"])
            in_degree[edge["target"]] += 1

        queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
        visited = 0

        while queue:
            node_id = queue.popleft()
            visited += 1
            for neighbor in adjacency[node_id]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited != len(nodes):
            raise DAGValidationError("DAG contains a cycle")

        return True

    @staticmethod
    def topological_sort(dag: dict) -> list[list[str]]:
        """
        Returns execution layers — nodes in the same layer can run in parallel.

        Example: [[trigger_1], [action_1, action_2], [output_1]]
        """
        nodes = {n["id"]: n for n in dag.get("nodes", [])}
        edges = dag.get("edges", [])

        in_degree: dict[str, int] = {nid: 0 for nid in nodes}
        adjacency: dict[str, list[str]] = defaultdict(list)

        for edge in edges:
            adjacency[edge["source"]].append(edge["target"])
            in_degree[edge["target"]] += 1

        layers: list[list[str]] = []
        queue = deque(nid for nid, deg in in_degree.items() if deg == 0)

        while queue:
            layer = list(queue)
            layers.append(layer)
            next_queue: deque[str] = deque()

            for node_id in layer:
                for neighbor in adjacency[node_id]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        next_queue.append(neighbor)

            queue = next_queue

        return layers

    @staticmethod
    async def create_execution(
        db: AsyncSession,
        workflow: Workflow,
        trigger_type: str = "manual",
        triggered_by: uuid.UUID | None = None,
        input_data: dict | None = None,
    ) -> WorkflowExecution:
        """Create a WorkflowExecution and child NodeExecution records."""
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            tenant_id=workflow.tenant_id,
            trigger_type=trigger_type,
            triggered_by=triggered_by,
            input_data=input_data,
            status=ExecutionStatus.PENDING,
        )
        db.add(execution)
        await db.flush()

        # Create NodeExecution for each node in the DAG
        dag = workflow.dag_definition
        for node in dag.get("nodes", []):
            node_exec = NodeExecution(
                workflow_execution_id=execution.id,
                tenant_id=workflow.tenant_id,
                node_id=node["id"],
                node_type=node.get("type", "action"),
                node_label=node.get("label", node["id"]),
                status=ExecutionStatus.PENDING,
            )
            db.add(node_exec)

        await db.flush()

        logger.info(
            "workflow_execution_created",
            execution_id=str(execution.id),
            workflow_id=str(workflow.id),
            node_count=len(dag.get("nodes", [])),
        )

        return execution

    @staticmethod
    async def dispatch_execution(
        execution_id: uuid.UUID,
        workflow_id: uuid.UUID,
        tenant_id: uuid.UUID,
        dag: dict,
    ) -> str:
        """
        Build Celery canvas from DAG layers and dispatch for execution.

        Returns the Celery task group ID.
        """
        from app.workers.task_executor import execute_workflow

        # Dispatch the entire workflow execution to Celery
        task = execute_workflow.delay(
            str(execution_id),
            str(workflow_id),
            str(tenant_id),
            dag,
        )

        logger.info(
            "workflow_dispatched",
            execution_id=str(execution_id),
            celery_task_id=task.id,
        )

        return task.id
