"""
Workflow CRUD and execution endpoints.
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from app.core.deps import CurrentUser, CurrentTenant, DbSession, require_role
from app.models.task import WorkflowExecution
from app.models.user import UserRole
from app.models.workflow import Workflow
from app.schemas.workflow import (
    ExecutionListResponse, ExecutionTriggerRequest, WorkflowCreateRequest,
    WorkflowExecutionResponse, WorkflowListResponse, WorkflowResponse, WorkflowUpdateRequest,
)
from app.services.workflow_engine import DAGValidationError, WorkflowEngine

router = APIRouter(prefix="/workflows")

@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.DEVELOPER))])
async def create_workflow(payload: WorkflowCreateRequest, user: CurrentUser, tenant: CurrentTenant, db: DbSession):
    if payload.dag_definition.get("nodes"):
        try:
            WorkflowEngine.validate_dag(payload.dag_definition)
        except DAGValidationError as e:
            raise HTTPException(status_code=422, detail=f"Invalid DAG: {e}")
    workflow = Workflow(name=payload.name, description=payload.description,
        dag_definition=payload.dag_definition, trigger_type=payload.trigger_type,
        schedule=payload.schedule, created_by=user.id, tenant_id=tenant.id)
    db.add(workflow)
    await db.flush()
    return workflow

@router.get("", response_model=WorkflowListResponse)
async def list_workflows(user: CurrentUser, tenant: CurrentTenant, db: DbSession,
    skip: int = 0, limit: int = 50, is_active: bool | None = None):
    query = select(Workflow).where(Workflow.tenant_id == tenant.id)
    if is_active is not None:
        query = query.where(Workflow.is_active == is_active)
    result = await db.execute(query.offset(skip).limit(limit).order_by(Workflow.updated_at.desc()))
    workflows = result.scalars().all()
    count_result = await db.execute(select(func.count(Workflow.id)).where(Workflow.tenant_id == tenant.id))
    return WorkflowListResponse(workflows=workflows, total=count_result.scalar() or 0)

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: uuid.UUID, user: CurrentUser, tenant: CurrentTenant, db: DbSession):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id, Workflow.tenant_id == tenant.id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.patch("/{workflow_id}", response_model=WorkflowResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.DEVELOPER))])
async def update_workflow(workflow_id: uuid.UUID, payload: WorkflowUpdateRequest,
    user: CurrentUser, tenant: CurrentTenant, db: DbSession):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id, Workflow.tenant_id == tenant.id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    update_data = payload.model_dump(exclude_unset=True)
    if "dag_definition" in update_data and update_data["dag_definition"]:
        try:
            WorkflowEngine.validate_dag(update_data["dag_definition"])
        except DAGValidationError as e:
            raise HTTPException(status_code=422, detail=f"Invalid DAG: {e}")
    for key, value in update_data.items():
        setattr(workflow, key, value)
    await db.flush()
    return workflow

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.DEVELOPER))])
async def delete_workflow(workflow_id: uuid.UUID, user: CurrentUser, tenant: CurrentTenant, db: DbSession):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id, Workflow.tenant_id == tenant.id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(workflow)

@router.post("/{workflow_id}/execute", response_model=WorkflowExecutionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.DEVELOPER))])
async def execute_workflow(workflow_id: uuid.UUID, payload: ExecutionTriggerRequest,
    user: CurrentUser, tenant: CurrentTenant, db: DbSession):
    result = await db.execute(select(Workflow).where(
        Workflow.id == workflow_id, Workflow.tenant_id == tenant.id, Workflow.is_active.is_(True)))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found or inactive")
    try:
        WorkflowEngine.validate_dag(workflow.dag_definition)
    except DAGValidationError as e:
        raise HTTPException(status_code=422, detail=f"Cannot execute: {e}")
    execution = await WorkflowEngine.create_execution(
        db=db, workflow=workflow, trigger_type="manual",
        triggered_by=user.id, input_data=payload.input_data)
    await WorkflowEngine.dispatch_execution(
        execution_id=execution.id, workflow_id=workflow.id,
        tenant_id=tenant.id, dag=workflow.dag_definition)
    return execution

@router.get("/{workflow_id}/executions", response_model=ExecutionListResponse)
async def list_executions(workflow_id: uuid.UUID, user: CurrentUser, tenant: CurrentTenant,
    db: DbSession, skip: int = 0, limit: int = 20):
    result = await db.execute(
        select(WorkflowExecution).options(selectinload(WorkflowExecution.node_executions))
        .where(WorkflowExecution.workflow_id == workflow_id, WorkflowExecution.tenant_id == tenant.id)
        .offset(skip).limit(limit).order_by(WorkflowExecution.created_at.desc()))
    executions = result.scalars().all()
    count_result = await db.execute(select(func.count(WorkflowExecution.id)).where(
        WorkflowExecution.workflow_id == workflow_id, WorkflowExecution.tenant_id == tenant.id))
    return ExecutionListResponse(executions=executions, total=count_result.scalar() or 0)
