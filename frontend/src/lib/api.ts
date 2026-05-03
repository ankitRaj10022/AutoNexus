import type {
  ApiErrorResponse,
  ApiKey,
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
  ApiKeyListResponse,
  AuthTokens,
  ExecutionListResponse,
  PlanDetails,
  RegisterResponse,
  UsageSummary,
  User,
  UserListResponse,
  Workflow,
  WorkflowCreateRequest,
  WorkflowExecution,
  WorkflowListResponse,
  WorkflowUpdateRequest,
} from "./types";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private getApiBase(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }

    if (typeof window !== "undefined") {
      if (window.location.port === "3000") {
        return "http://localhost:8000/api/v1";
      }
      return `${window.location.origin}/api/v1`;
    }

    return "http://localhost:8000/api/v1";
  }

  private getToken(): string | null {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem("access_token");
  }

  private setTokens(access: string, refresh: string) {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }

  clearTokens() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${this.getApiBase()}${endpoint}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401) {
      if (
        !endpoint.includes("/auth/login") &&
        !endpoint.includes("/auth/register")
      ) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request<T>(endpoint, options);
        }
      }

      this.clearTokens();
      if (
        typeof window !== "undefined" &&
        !endpoint.includes("/auth/login") &&
        !endpoint.includes("/auth/register")
      ) {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized: Invalid email or password");
    }

    if (!res.ok) {
      const error = (await res.json().catch(
        () => ({ detail: "Request failed" }) satisfies ApiErrorResponse,
      )) as ApiErrorResponse;
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  }

  private async refreshToken(): Promise<boolean> {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) {
      return false;
    }

    try {
      const res = await fetch(`${this.getApiBase()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as AuthTokens;
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const data = await this.request<AuthTokens>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async register(
    email: string,
    password: string,
    fullName: string,
    workspaceName: string,
  ): Promise<RegisterResponse> {
    const data = await this.request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: {
        email,
        password,
        full_name: fullName,
        workspace_name: workspaceName,
      },
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async getWorkflows(): Promise<WorkflowListResponse> {
    return this.request<WorkflowListResponse>("/workflows");
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/workflows/${id}`);
  }

  async createWorkflow(data: WorkflowCreateRequest): Promise<Workflow> {
    return this.request<Workflow>("/workflows", {
      method: "POST",
      body: data,
    });
  }

  async updateWorkflow(
    id: string,
    data: WorkflowUpdateRequest,
  ): Promise<Workflow> {
    return this.request<Workflow>(`/workflows/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request<void>(`/workflows/${id}`, {
      method: "DELETE",
    });
  }

  async executeWorkflow(
    id: string,
    input?: Record<string, unknown>,
  ): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(`/workflows/${id}/execute`, {
      method: "POST",
      body: { input_data: input },
    });
  }

  async getExecutions(workflowId: string): Promise<ExecutionListResponse> {
    return this.request<ExecutionListResponse>(
      `/workflows/${workflowId}/executions`,
    );
  }

  async getUsage(): Promise<UsageSummary> {
    return this.request<UsageSummary>("/billing/usage");
  }

  async getPlan(): Promise<PlanDetails> {
    return this.request<PlanDetails>("/billing/plan");
  }

  async getMe(): Promise<User> {
    return this.request<User>("/users/me");
  }

  async getUsers(): Promise<UserListResponse> {
    return this.request<UserListResponse>("/users");
  }

  async getApiKeys(): Promise<ApiKeyListResponse> {
    return this.request<ApiKeyListResponse>("/api-keys");
  }

  async createApiKey(payload: ApiKeyCreateRequest): Promise<ApiKeyCreateResponse> {
    return this.request<ApiKeyCreateResponse>("/api-keys", {
      method: "POST",
      body: payload,
    });
  }

  async revokeApiKey(keyId: string): Promise<void> {
    await this.request<void>(`/api-keys/${keyId}`, { method: "DELETE" });
  }
}

export const api = new ApiClient();
export type { ApiKey };
