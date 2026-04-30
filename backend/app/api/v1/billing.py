"""
Billing API endpoints.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request
from app.core.config import settings
from app.core.deps import CurrentUser, CurrentTenant, DbSession
from app.schemas.billing import PlanResponse, SubscribeRequest, SubscriptionResponse, UsageSummaryResponse
from app.services.billing import BillingService
from app.services.stripe_client import stripe_client

router = APIRouter(prefix="/billing")

@router.get("/usage", response_model=UsageSummaryResponse)
async def get_usage(user: CurrentUser, tenant: CurrentTenant, db: DbSession):
    summary = await BillingService.get_usage_summary(db, tenant.id, tenant.plan.value)
    return UsageSummaryResponse(**summary)

@router.get("/plan", response_model=PlanResponse)
async def get_plan(user: CurrentUser, tenant: CurrentTenant):
    plan = tenant.plan.value
    return PlanResponse(
        plan=plan, task_limit=settings.get_plan_task_limit(plan),
        rate_limit=settings.get_rate_limit(plan),
        features=BillingService.PLAN_FEATURES.get(plan, []))

@router.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe(payload: SubscribeRequest, user: CurrentUser,
    tenant: CurrentTenant, db: DbSession):
    if payload.plan not in ("pro", "enterprise"):
        raise HTTPException(status_code=400, detail="Invalid plan")
    if not tenant.stripe_customer_id:
        customer = await stripe_client.create_customer(user.email, tenant.name)
        tenant.stripe_customer_id = customer["id"]
    price_ids = {"pro": "price_pro_monthly", "enterprise": "price_enterprise_monthly"}
    sub = await stripe_client.create_subscription(tenant.stripe_customer_id, price_ids[payload.plan])
    from app.models.subscription import Subscription, SubscriptionStatus
    from app.models.tenant import PlanType
    from datetime import datetime, timezone
    subscription = Subscription(
        tenant_id=tenant.id, plan=payload.plan, status=SubscriptionStatus.ACTIVE,
        stripe_subscription_id=sub["id"],
        current_period_start=datetime.fromtimestamp(sub["current_period_start"], tz=timezone.utc),
        current_period_end=datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc))
    db.add(subscription)
    tenant.plan = PlanType(payload.plan)
    await db.flush()
    return subscription

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    event = await stripe_client.handle_webhook(payload, sig)
    return {"received": True, "type": event.get("type")}
