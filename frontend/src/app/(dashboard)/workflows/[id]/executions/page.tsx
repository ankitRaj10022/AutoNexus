"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

import { api } from "@/lib/api";
import type {
  ExecutionStatus,
  NodeExecution,
  WorkflowExecution,
} from "@/lib/types";

interface StatusDisplay {
  icon: LucideIcon;
  color: string;
  bg: string;
}

interface ExecutionUpdateMessage {
  type?: string;
  status?: ExecutionStatus;
  node_id?: string;
  error?: string | null;
  duration_seconds?: number | null;
}

const statusConfig: Record<ExecutionStatus, StatusDisplay> = {
  success: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/15",
  },
  running: {
    icon: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
  },
  pending: {
    icon: Clock,
    color: "text-gray-400",
    bg: "bg-gray-500/15",
  },
  queued: {
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
  },
  cancelled: {
    icon: XCircle,
    color: "text-gray-400",
    bg: "bg-gray-500/15",
  },
  retrying: {
    icon: Loader2,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
  },
};

function getWebSocketUrl(executionId: string): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return `${process.env.NEXT_PUBLIC_WS_URL}/ws/executions/${executionId}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  if (window.location.port === "3000") {
    return `${protocol}://localhost:8000/ws/executions/${executionId}`;
  }

  return `${protocol}://${window.location.host}/ws/executions/${executionId}`;
}

function mergeNodeUpdate(
  nodes: NodeExecution[],
  update: ExecutionUpdateMessage,
): NodeExecution[] {
  if (!update.node_id || !update.status) {
    return nodes;
  }

  const nextStatus = update.status;

  return nodes.map((node) =>
    node.node_id === update.node_id
      ? {
          ...node,
          status: nextStatus,
          error: update.error ?? node.error,
          duration_seconds: update.duration_seconds ?? node.duration_seconds,
        }
      : node,
  );
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatDuration(value: number | null): string {
  return value !== null ? `${value.toFixed(2)}s` : "-";
}

export default function ExecutionsPage() {
  const { id } = useParams<{ id: string }>();
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selected, setSelected] = useState<WorkflowExecution | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    void api
      .getExecutions(id)
      .then((data) => {
        setExecutions(data.executions || []);
        setSelected(data.executions?.[0] ?? null);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!selected || !["running", "pending", "queued"].includes(selected.status)) {
      return;
    }

    const ws = new WebSocket(getWebSocketUrl(selected.id));

    ws.onmessage = (event) => {
      let payload: ExecutionUpdateMessage;

      try {
        payload = JSON.parse(event.data) as ExecutionUpdateMessage;
      } catch {
        return;
      }

      if (payload.type === "pong") {
        return;
      }

      setSelected((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          status: payload.node_id ? current.status : payload.status ?? current.status,
          error: payload.error ?? current.error,
          duration_seconds: payload.duration_seconds ?? current.duration_seconds,
          node_executions: mergeNodeUpdate(current.node_executions, payload),
        };
      });

      setExecutions((currentExecutions) =>
        currentExecutions.map((execution) =>
          execution.id === selected.id
            ? {
                ...execution,
                status: payload.node_id
                  ? execution.status
                  : payload.status ?? execution.status,
                error: payload.error ?? execution.error,
                duration_seconds:
                  payload.duration_seconds ?? execution.duration_seconds,
              }
            : execution,
        ),
      );
    };

    return () => {
      ws.close();
    };
  }, [selected]);

  const getStatus = (status: ExecutionStatus) =>
    statusConfig[status] ?? statusConfig.pending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          href={`/workflows/${id}`}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Executions</h1>
          <p className="text-gray-400 mt-0.5">
            Workflow execution history and live status
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-4 lg:col-span-1 max-h-[70vh] overflow-auto">
          <h3 className="text-sm font-medium text-gray-400 mb-3">HISTORY</h3>
          <div className="space-y-1.5">
            {executions.map((execution) => {
              const state = getStatus(execution.status);
              const Icon = state.icon;

              return (
                <button
                  key={execution.id}
                  onClick={() => setSelected(execution)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selected?.id === execution.id
                      ? "bg-indigo-500/15 border border-indigo-500/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${state.color} ${
                      execution.status === "running" ? "animate-spin" : ""
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {execution.trigger_type} trigger
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(execution.created_at).toLocaleString()}
                    </p>
                  </div>
                  {execution.duration_seconds !== null && (
                    <span className="text-xs text-gray-500">
                      {execution.duration_seconds.toFixed(1)}s
                    </span>
                  )}
                </button>
              );
            })}
            {executions.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                No executions yet
              </p>
            )}
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Execution Detail</h3>
                <span
                  className={`badge ${getStatus(selected.status).bg} ${
                    getStatus(selected.status).color
                  }`}
                >
                  {selected.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Trigger:</span>
                  <span className="ml-2">{selected.trigger_type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <span className="ml-2">
                    {formatDuration(selected.duration_seconds)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Started:</span>
                  <span className="ml-2">{formatDate(selected.started_at)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <span className="ml-2">
                    {formatDate(selected.completed_at)}
                  </span>
                </div>
              </div>

              {selected.error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  {selected.error}
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  NODE STATUS
                </h4>
                <div className="space-y-1.5">
                  {selected.node_executions.map((node) => {
                    const state = getStatus(node.status);
                    const Icon = state.icon;

                    return (
                      <div
                        key={node.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${state.bg}`}
                      >
                        <Icon
                          className={`w-4 h-4 ${state.color} ${
                            node.status === "running" ? "animate-spin" : ""
                          }`}
                        />
                        <span className="text-sm font-medium flex-1">
                          {node.node_label}
                        </span>
                        <span className={`text-xs ${state.color}`}>
                          {node.status}
                        </span>
                        {node.duration_seconds !== null && (
                          <span className="text-xs text-gray-500">
                            {node.duration_seconds.toFixed(2)}s
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              Select an execution to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
