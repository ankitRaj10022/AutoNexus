"""
Mock Stripe client — interface-compatible with real Stripe SDK.
Swap this for `import stripe` in production with real API keys.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
import structlog

logger = structlog.get_logger()

class MockStripeClient:
    """Simulates Stripe API for development without real API keys."""

    async def create_customer(self, email: str, name: str, metadata: dict = None) -> dict:
        customer_id = f"cus_mock_{uuid.uuid4().hex[:12]}"
        logger.info("stripe_mock_customer_created", customer_id=customer_id, email=email)
        return {"id": customer_id, "email": email, "name": name, "metadata": metadata or {}}

    async def create_subscription(self, customer_id: str, price_id: str) -> dict:
        sub_id = f"sub_mock_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        logger.info("stripe_mock_subscription_created", subscription_id=sub_id)
        return {
            "id": sub_id, "customer": customer_id, "status": "active",
            "current_period_start": int(now.timestamp()),
            "current_period_end": int((now + timedelta(days=30)).timestamp()),
            "items": {"data": [{"price": {"id": price_id}}]},
        }

    async def cancel_subscription(self, subscription_id: str) -> dict:
        logger.info("stripe_mock_subscription_cancelled", subscription_id=subscription_id)
        return {"id": subscription_id, "status": "cancelled",
                "cancelled_at": int(datetime.now(timezone.utc).timestamp())}

    async def handle_webhook(self, payload: bytes, sig_header: str) -> dict:
        logger.info("stripe_mock_webhook_received")
        return {"type": "invoice.payment_succeeded", "data": {"object": {}}}

stripe_client = MockStripeClient()
