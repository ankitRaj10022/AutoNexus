const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
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
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401) {
      if (!endpoint.includes("/auth/login") && !endpoint.includes("/auth/register")) {
        const refreshed = await this.refreshToken();
        if (refreshed) return this.request<T>(endpoint, options);
      }
      this.clearTokens();
      if (typeof window !== "undefined" && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/register")) {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized: Invalid email or password");
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    if (res.status === 204) return {} as T;
    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{access_token: string; refresh_token: string}>("/auth/login", {
      method: "POST", body: { email, password },
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async register(email: string, password: string, fullName: string, workspaceName: string) {
    const data = await this.request<{access_token: string; refresh_token: string; user_id: string; workspace_id: string}>("/auth/register", {
      method: "POST", body: { email, password, full_name: fullName, workspace_name: workspaceName },
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  // Workflows
  async getWorkflows() { return this.request<{workflows: any[]; total: number}>("/workflows"); }
  async getWorkflow(id: string) { return this.request<any>(`/workflows/${id}`); }
  async createWorkflow(data: any) { return this.request<any>("/workflows", { method: "POST", body: data }); }
  async updateWorkflow(id: string, data: any) { return this.request<any>(`/workflows/${id}`, { method: "PATCH", body: data }); }
  async executeWorkflow(id: string, input?: any) {
    return this.request<any>(`/workflows/${id}/execute`, { method: "POST", body: { input_data: input } });
  }
  async getExecutions(workflowId: string) {
    return this.request<{executions: any[]; total: number}>(`/workflows/${workflowId}/executions`);
  }

  // Billing
  async getUsage() { return this.request<any>("/billing/usage"); }
  async getPlan() { return this.request<any>("/billing/plan"); }

  // Users
  async getMe() { return this.request<any>("/users/me"); }
  async getUsers() { return this.request<{users: any[]; total: number}>("/users"); }
}

export const api = new ApiClient();
