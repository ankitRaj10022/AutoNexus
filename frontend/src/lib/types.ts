export type UserRole = "admin" | "developer" | "viewer";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface RegisterResponse extends AuthTokens {
  user_id: string;
  workspace_id: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  tenant_id: string;
  created_at: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export interface WorkflowPosition {
  x: number;
  y: number;
}

export type WorkflowNodeType = "trigger" | "action" | "condition" | "output";

export interface WorkflowDagNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  config: Record<string, unknown>;
  position: WorkflowPosition;
}

export interface WorkflowDagEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowDagDefinition {
  nodes: WorkflowDagNode[];
  edges: WorkflowDagEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  dag_definition: WorkflowDagDefinition;
  is_active: boolean;
  trigger_type: string;
  schedule: string | null;
  created_by: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total: number;
}

export interface WorkflowCreateRequest {
  name: string;
  description?: string;
  dag_definition?: WorkflowDagDefinition;
  trigger_type?: string;
  schedule?: string | null;
}

export interface WorkflowUpdateRequest {
  name?: string;
  description?: string;
  dag_definition?: WorkflowDagDefinition;
  is_active?: boolean;
  trigger_type?: string;
  schedule?: string | null;
}

export type ExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "retrying";

export interface NodeExecution {
  id: string;
  node_id: string;
  node_type: string;
  node_label: string;
  status: ExecutionStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error: string | null;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  trigger_type: string;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  node_executions: NodeExecution[];
  created_at: string;
}

export interface ExecutionListResponse {
  executions: WorkflowExecution[];
  total: number;
}

export interface UsageSummary {
  tenant_id: string;
  plan: string;
  period_start: string | null;
  period_end: string | null;
  task_executions: number;
  task_limit: number;
  compute_seconds: number;
  api_calls: number;
}

export interface PlanDetails {
  plan: string;
  task_limit: number;
  rate_limit: number;
  features: string[];
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: Record<string, string[]>;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface ApiKeyListResponse {
  keys: ApiKey[];
  total: number;
}

export interface ApiKeyCreateRequest {
  name: string;
  scopes?: Record<string, string[]>;
  expires_in_days?: number;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  scopes: Record<string, string[]>;
  expires_at: string | null;
  created_at: string;
}

export interface ApiErrorResponse {
  detail?: string;
}
