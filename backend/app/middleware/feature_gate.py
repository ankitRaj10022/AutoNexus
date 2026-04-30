"""
Feature flag and tier-based access control middleware/dependencies.
"""

from typing import Callable, Any
from fastapi import HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_tenant
from app.models.tenant import Workspace
from app.models.subscription import Subscription

def require_feature(feature_name: str) -> Callable:
    """Dependency that ensures the current tenant's plan supports the requested feature."""
    async def feature_checker(
        tenant: Workspace = Depends(get_current_tenant),
        db: AsyncSession = Depends(get_db)
    ) -> Workspace:
        # Get active subscription
        result = await db.execute(
            select(Subscription).where(
                Subscription.tenant_id == tenant.id,
                Subscription.status == "active"
            )
        )
        subscription = result.scalar_one_or_none()
        
        # Determine plan tier
        plan = subscription.plan if subscription else "free"
        
        # Define feature matrices
        plan_features = {
            "free": ["basic_workflows", "standard_nodes"],
            "pro": ["basic_workflows", "standard_nodes", "advanced_nodes", "webhooks", "custom_domains"],
            "enterprise": ["basic_workflows", "standard_nodes", "advanced_nodes", "webhooks", "custom_domains", "sso", "dedicated_support"]
        }
        
        allowed_features = plan_features.get(plan.lower(), plan_features["free"])
        
        if feature_name not in allowed_features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_name}' requires a plan upgrade. Current plan: {plan}"
            )
        return tenant
    
    return feature_checker
