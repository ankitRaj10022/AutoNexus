# AutoNexus — Multi-Tenant SaaS Workflow Platform

Build a production-grade, horizontally-scalable workflow automation platform with multi-tenancy, billing, and a visual DAG editor.

## User Review Required

> [!IMPORTANT]
> **Phased delivery**: This is ~150+ files. I will implement phase-by-phase, verifying each before proceeding. Phases 1-4 are the functional core; Phases 5-8 add production hardening.

> [!WARNING]
> **Stripe integration**: Phase 5 uses a mock Stripe client. Real keys are never committed. Confirm if you want real Stripe test-mode integration instead.

## Open Questions

1. **Domain name**: Should tenant isolation use subdomains (`tenant1.autonexus.io`) or path-based (`/api/v1` with JWT tenant claim)?  
   *Default: JWT-based tenant claim — simpler for local dev.*
2. **OAuth providers**: Google + GitHub OAuth, or JWT-only for MVP?  
   *Default: JWT-only first, OAuth as follow-up.*
3. **Database**: Local PostgreSQL via Docker, or do you have a cloud instance?  
   *Default: Docker-compose PostgreSQL.*

---

## Project Structure

```
AutoNexus/
├── backend/                    # FastAPI + Celery
│   ├── alembic/                # DB migrations
│   ├── app/
│   │   ├── api/v1/             # Route modules
│   │   ├── core/               # Config, security, deps
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Tenant, logging, rate-limit
│   │   ├── workers/            # Celery tasks
│   │   └── websockets/         # WS handlers
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # Next.js + TypeScript
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/         # UI components
│   │   ├── lib/                # API client, auth, stores
│   │   └── styles/             # Tailwind config
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/
│   ├── k8s/                    # Kubernetes manifests
│   └── monitoring/             # Prometheus, Grafana configs
├── .github/workflows/          # CI/CD
├── .env.example
└── README.md
```

---

## Proposed Changes

### Phase 1 — Project Scaffolding & Core Backend

Set up the monorepo, FastAPI app factory, Docker-compose with Redis + PostgreSQL, and Celery worker.

#### [NEW] backend/requirements.txt
Core deps: `fastapi`, `uvicorn[standard]`, `celery[redis]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pydantic-settings`, `python-jose[cryptography]`, `passlib[bcrypt]`, `structlog`, `prometheus-fastapi-instrumentator`, `httpx`, `python-multipart`, `websockets`.

#### [NEW] backend/app/main.py
FastAPI app factory with lifespan, CORS, middleware registration, router includes.

#### [NEW] backend/app/core/config.py
`pydantic-settings` based config loading from env vars: DB URL, Redis URL, JWT secrets, Stripe keys, rate limits per plan.

#### [NEW] backend/app/core/database.py
Async SQLAlchemy engine + session factory. Connection pooling via `pool_size=20, max_overflow=10`. Dependency `get_db()`.

#### [NEW] backend/celery_app.py
Celery instance with Redis broker, JSON serializer, `task_acks_late=True`, `worker_prefetch_multiplier=1`.

#### [NEW] docker-compose.yml
Services: `api`, `worker`, `redis`, `postgres`, `nginx`. Networks + volumes.

#### [NEW] .env.example
Template for all required env vars (no real secrets).

---

### Phase 2 — Data Models & Migrations

Multi-tenant schema with row-level isolation via `tenant_id` on every table.

#### [NEW] backend/app/models/base.py
`TenantBase` mixin with `tenant_id` column + index. `TimestampMixin` with `created_at`, `updated_at`.

#### [NEW] backend/app/models/tenant.py
`Workspace` model: id, name, slug, settings (JSONB), plan, created_at.

#### [NEW] backend/app/models/user.py
`User` model: id, email, hashed_password, full_name, is_active, role (enum: admin/developer/viewer), tenant_id (FK → workspace).

#### [NEW] backend/app/models/api_key.py
`APIKey` model: id, key_hash, name, tenant_id, user_id, scopes (JSONB), expires_at, is_active.

#### [NEW] backend/app/models/workflow.py
`Workflow`: id, tenant_id, name, description, dag_definition (JSONB — nodes + edges), is_active, schedule (cron string), created_by.

#### [NEW] backend/app/models/task.py
`TaskNode`: id, workflow_id, tenant_id, node_type, config (JSONB), position (JSONB).  
`TaskExecution`: id, workflow_id, tenant_id, node_id, status (enum), started_at, completed_at, result (JSONB), error, worker_id.

#### [NEW] backend/app/models/subscription.py
`Subscription`: id, tenant_id, plan (enum), stripe_subscription_id, status, current_period_start/end.  
`UsageRecord`: id, tenant_id, metric_name, value, recorded_at.

#### [NEW] alembic/ config + initial migration
Alembic init with async driver. Initial migration creates all tables with indexes on `tenant_id`, composite indexes on `(tenant_id, status)`, `(tenant_id, created_at)`.

---

### Phase 3 — Auth System & Multi-Tenant Middleware

JWT auth (access + refresh), RBAC, API key auth, tenant-scoped middleware.

#### [NEW] backend/app/core/security.py
`create_access_token()`, `create_refresh_token()`, `verify_token()`, `hash_password()`, `verify_password()`. Uses `python-jose` + `passlib`.

#### [NEW] backend/app/middleware/tenant.py
Middleware that extracts `tenant_id` from JWT claims, sets it in `contextvars`. All downstream DB queries auto-filter by tenant.

#### [NEW] backend/app/core/deps.py
Dependencies: `get_current_user`, `get_current_tenant`, `require_role(role)`, `get_api_key_user`. Reusable across all routes.

#### [NEW] backend/app/api/v1/auth.py
Endpoints: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`. Returns JWT pair.

#### [NEW] backend/app/api/v1/users.py
CRUD for users within tenant. Admin-only user management.

#### [NEW] backend/app/api/v1/api_keys.py
CRUD for API keys. Generate, revoke, list (scoped to tenant).

#### [NEW] backend/app/schemas/auth.py, user.py, api_key.py
Pydantic request/response schemas with strong typing.

---

### Phase 4 — Workflow Engine & Real-Time

DAG execution engine, Celery task orchestration, WebSocket live updates.

#### [NEW] backend/app/services/workflow_engine.py
Core engine: parses DAG JSON → topological sort → builds Celery canvas (chain/group/chord). Handles dependencies, retries, error propagation.

#### [NEW] backend/app/workers/task_executor.py
Celery tasks: `execute_node`, `execute_workflow`. Each task updates status in DB + publishes to Redis pub/sub.

#### [NEW] backend/app/api/v1/workflows.py
CRUD + execution endpoints: `POST /workflows`, `GET /workflows`, `POST /workflows/{id}/execute`, `GET /workflows/{id}/executions`.

#### [NEW] backend/app/websockets/execution.py
WebSocket endpoint `/ws/executions/{workflow_id}`. Subscribes to Redis pub/sub channel, streams node status updates to connected clients.

#### [NEW] backend/app/services/scheduler.py
Cron scheduler using Celery Beat. Reads active workflows with schedules, triggers execution.

#### [NEW] backend/app/api/v1/webhooks.py
Webhook trigger endpoint: `POST /webhooks/{workflow_id}/trigger`. Validates API key, enqueues workflow.

---

### Phase 5 — Billing & Rate Limiting

Usage tracking, plan enforcement, mock Stripe integration.

#### [NEW] backend/app/services/billing.py
`BillingService`: check plan limits, record usage, get usage summary. Plan definitions (Free: 100 tasks/mo, Pro: 10K, Enterprise: unlimited).

#### [NEW] backend/app/services/stripe_client.py
Mock Stripe client: `create_customer`, `create_subscription`, `cancel_subscription`, `handle_webhook`. Interface-based so real Stripe can be swapped in.

#### [NEW] backend/app/api/v1/billing.py
Endpoints: `GET /billing/usage`, `GET /billing/plan`, `POST /billing/subscribe`, `POST /billing/webhook` (Stripe webhook handler).

#### [NEW] backend/app/middleware/rate_limit.py
Redis-based rate limiter. Sliding window per tenant. Limits from plan config. Returns `429` with `Retry-After`.

#### [NEW] backend/app/middleware/feature_gate.py
Middleware/dependency that checks tenant plan before allowing access to gated features.

---

### Phase 6 — Frontend (Next.js)

Dashboard, workflow builder with React Flow, real-time execution view.

#### [NEW] frontend/ (Next.js project)
Initialize with `npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --no-import-alias`.

#### [NEW] frontend/src/app/layout.tsx
Root layout with Inter font, dark theme, auth provider wrapper.

#### [NEW] frontend/src/lib/api.ts
Typed API client with interceptors for JWT auth, token refresh, error handling.

#### [NEW] frontend/src/lib/auth.tsx
Auth context + hooks: `useAuth()`, `login()`, `logout()`, `refreshToken()`. Stores tokens in httpOnly cookies.

#### [NEW] frontend/src/app/(auth)/login/page.tsx
Login page with email/password form. Premium dark glassmorphism design.

#### [NEW] frontend/src/app/(dashboard)/layout.tsx
Dashboard shell: sidebar nav, top bar with user menu, workspace switcher.

#### [NEW] frontend/src/app/(dashboard)/page.tsx
Dashboard home: task execution stats (charts), recent workflows, system health cards.

#### [NEW] frontend/src/app/(dashboard)/workflows/page.tsx
Workflow list with search, filter, status badges, create button.

#### [NEW] frontend/src/app/(dashboard)/workflows/[id]/page.tsx
Visual workflow builder using `@xyflow/react`. Custom node components, connection validation, save/load DAG JSON, execution trigger.

#### [NEW] frontend/src/app/(dashboard)/workflows/[id]/executions/page.tsx
Execution history + real-time execution view. WebSocket connection for live node status. Animated node highlighting.

#### [NEW] frontend/src/app/(dashboard)/settings/page.tsx
Workspace settings, API keys management, billing/plan info, team members.

#### [NEW] frontend/src/components/workflow/
Custom React Flow nodes (`TriggerNode`, `ActionNode`, `ConditionNode`, `OutputNode`), edge types, node config panel, toolbar.

---

### Phase 7 — Infrastructure & DevOps

Docker, Kubernetes, Nginx, CI/CD.

#### [NEW] backend/Dockerfile
Multi-stage build. Python 3.12-slim. Non-root user. Health check.

#### [NEW] frontend/Dockerfile
Multi-stage: build with Node 20, serve with Nginx alpine.

#### [NEW] infra/nginx/nginx.conf
Reverse proxy: `/api` → FastAPI, `/ws` → WebSocket upstream, `/` → Next.js. Rate limiting, HTTPS redirect, security headers, gzip.

#### [NEW] infra/k8s/
- `namespace.yaml` — `autonexus` namespace
- `api-deployment.yaml` — FastAPI (2-10 replicas, HPA at 60% CPU)
- `worker-deployment.yaml` — Celery workers (2-20 replicas, KEDA-ready)
- `redis-deployment.yaml` — Redis with persistence
- `postgres-statefulset.yaml` — PostgreSQL with PVC
- `frontend-deployment.yaml` — Next.js
- `ingress.yaml` — NGINX Ingress
- `secrets.yaml` — Template (no real values)
- `configmap.yaml` — Non-secret config
- `hpa.yaml` — HPA definitions

#### [NEW] .github/workflows/ci.yml
GitHub Actions: lint (ruff + eslint), test (pytest + jest), Docker build + push, K8s deploy (staging on PR merge, prod on tag).

---

### Phase 8 — Observability & Monitoring

Structured logging, metrics, tracing, health dashboard.

#### [NEW] backend/app/middleware/logging.py
`structlog` JSON logging with tenant_id, request_id, trace_id injection. Async-safe via `contextvars`.

#### [NEW] backend/app/middleware/metrics.py
Prometheus metrics: request latency histogram, active tasks gauge, task success/failure counters (labeled by tenant + workflow).

#### [NEW] backend/app/api/v1/health.py
`GET /health` (liveness), `GET /ready` (readiness — checks DB + Redis). Used by K8s probes.

#### [NEW] infra/monitoring/
- `prometheus.yml` — Scrape config
- `grafana-dashboard.json` — Pre-built dashboard: request rates, error rates, task execution times, queue depth, system resources

---

## Verification Plan

### Automated Tests
- `pytest` with async fixtures for all API endpoints
- Tenant isolation tests (verify cross-tenant queries return empty)
- Auth flow tests (register → login → access → refresh → revoke)
- Workflow engine tests (DAG parsing, execution ordering)
- Rate limiting tests (verify 429 after limit exceeded)
- `docker-compose up` smoke test — all services healthy
- Frontend: `npm run build` — zero errors

### Manual Verification
- Run full stack locally via `docker-compose up`
- Create workspace → register user → create workflow → execute → view real-time updates
- Verify tenant isolation with two separate workspaces
- Test rate limiting by exceeding free plan limits
- Browser test the workflow builder drag-and-drop UI
