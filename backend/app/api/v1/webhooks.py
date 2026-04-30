"""
Webhook trigger endpoints for external workflow invocation.
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from app.core.deps import DbSession, get_api_key_user
from app.models.user import User
from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowExecutionResponse
from app.services.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/webhooks")

@router.post("/{workflow_id}/trigger", response_model=WorkflowExecutionResponse,
    status_code=status.HTTP_202_ACCEPTED, summary="Trigger workflow via webhook")
async def trigger_webhook(
    workflow_id: uuid.UUID, request: Request, db: DbSession,
    user: User = Depends(get_api_key_user),
):
    result = await db.execute(select(Workflow).where(
        Workflow.id == workflow_id, Workflow.tenant_id == user.tenant_id,
        Workflow.is_active.is_(True)))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    body = await request.json() if await request.body() else {}
    execution = await WorkflowEngine.create_execution(
        db=db, workflow=workflow, trigger_type="webhook",
        triggered_by=user.id, input_data=body)
    await WorkflowEngine.dispatch_execution(
        execution_id=execution.id, workflow_id=workflow.id,
        tenant_id=user.tenant_id, dag=workflow.dag_definition)
    return execution
