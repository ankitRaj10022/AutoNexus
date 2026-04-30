"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, Clock, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15" },
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/15" },
  pending: { icon: Clock, color: "text-gray-400", bg: "bg-gray-500/15" },
  queued: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15" },
};

export default function ExecutionsPage() {
  const { id } = useParams<{ id: string }>();
  const [executions, setExecutions] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api.getExecutions(id).then((d) => {
      setExecutions(d.executions || []);
      if (d.executions?.length) setSelected(d.executions[0]);
    }).catch(() => {});
  }, [id]);

  // WebSocket for live updates on selected execution
  useEffect(() => {
    if (!selected || !["running", "pending", "queued"].includes(selected.status)) return;
    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8000/ws/executions/${selected.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSelected((prev: any) => {
        if (!prev) return prev;
        const nodes = [...(prev.node_executions || [])];
        const idx = nodes.findIndex((n: any) => n.node_id === data.node_id);
        if (idx >= 0) nodes[idx] = { ...nodes[idx], status: data.status };
        return { ...prev, status: data.node_id ? prev.status : data.status, node_executions: nodes };
      });
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [selected?.id, selected?.status]);

  const getStatus = (status: string) => statusConfig[status] || statusConfig.pending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href={`/workflows/${id}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Executions</h1>
          <p className="text-gray-400 mt-0.5">Workflow execution history and live status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution List */}
        <div className="glass-card p-4 lg:col-span-1 max-h-[70vh] overflow-auto">
          <h3 className="text-sm font-medium text-gray-400 mb-3">HISTORY</h3>
          <div className="space-y-1.5">
            {executions.map((exec) => {
              const s = getStatus(exec.status);
              const Icon = s.icon;
              return (
                <button key={exec.id} onClick={() => setSelected(exec)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selected?.id === exec.id ? "bg-indigo-500/15 border border-indigo-500/30" : "hover:bg-white/5"
                  }`}>
                  <Icon className={`w-4 h-4 ${s.color} ${exec.status === "running" ? "animate-spin" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exec.trigger_type} trigger</p>
                    <p className="text-xs text-gray-500">{new Date(exec.created_at).toLocaleString()}</p>
                  </div>
                  {exec.duration_seconds && (
                    <span className="text-xs text-gray-500">{exec.duration_seconds.toFixed(1)}s</span>
                  )}
                </button>
              );
            })}
            {executions.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No executions yet</p>}
          </div>
        </div>

        {/* Execution Detail */}
        <div className="glass-card p-6 lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Execution Detail</h3>
                <span className={`badge ${getStatus(selected.status).bg} ${getStatus(selected.status).color}`}>
                  {selected.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Trigger:</span> <span className="ml-2">{selected.trigger_type}</span></div>
                <div><span className="text-gray-500">Duration:</span> <span className="ml-2">{selected.duration_seconds ? `${selected.duration_seconds.toFixed(2)}s` : "—"}</span></div>
                <div><span className="text-gray-500">Started:</span> <span className="ml-2">{selected.started_at ? new Date(selected.started_at).toLocaleString() : "—"}</span></div>
                <div><span className="text-gray-500">Completed:</span> <span className="ml-2">{selected.completed_at ? new Date(selected.completed_at).toLocaleString() : "—"}</span></div>
              </div>

              {selected.error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">{selected.error}</div>
              )}

              {/* Node Executions */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">NODE STATUS</h4>
                <div className="space-y-1.5">
                  {(selected.node_executions || []).map((node: any) => {
                    const ns = getStatus(node.status);
                    const NIcon = ns.icon;
                    return (
                      <div key={node.id} className={`flex items-center gap-3 p-3 rounded-lg ${ns.bg}`}>
                        <NIcon className={`w-4 h-4 ${ns.color} ${node.status === "running" ? "animate-spin" : ""}`} />
                        <span className="text-sm font-medium flex-1">{node.node_label}</span>
                        <span className={`text-xs ${ns.color}`}>{node.status}</span>
                        {node.duration_seconds && <span className="text-xs text-gray-500">{node.duration_seconds.toFixed(2)}s</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">Select an execution to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
