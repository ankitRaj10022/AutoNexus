"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge, BackgroundVariant,
  Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, Play, ArrowLeft, Zap, GitBranch, Filter, Send, X, Settings2 } from "lucide-react";

// Custom Node Component with Handles
function CustomNode({ data, selected }: { data: any; selected?: boolean }) {
  const colors: Record<string, { bg: string; border: string; icon: any }> = {
    trigger: { bg: "bg-amber-500/15", border: "border-amber-500/40", icon: Zap },
    action: { bg: "bg-indigo-500/15", border: "border-indigo-500/40", icon: GitBranch },
    condition: { bg: "bg-purple-500/15", border: "border-purple-500/40", icon: Filter },
    output: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", icon: Send },
  };
  const nodeType = data.nodeType || "action";
  const c = colors[nodeType] || colors.action;
  const Icon = c.icon;

  const glowClass = selected ? `shadow-[0_0_15px_rgba(255,255,255,0.2)] border-white/40 scale-[1.02]` : `shadow-lg border`;

  return (
    <div className={`${c.bg} ${glowClass} ${c.border} rounded-xl px-4 py-3 min-w-[160px] backdrop-blur-sm transition-all duration-200 relative`}>
      {/* Target Handle (Left) - Not for Triggers */}
      {nodeType !== "trigger" && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className="w-3 h-3 !bg-indigo-400 !border-2 !border-[#1e2130]" 
        />
      )}

      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-300" />
        <span className="text-sm font-medium text-gray-200">{data.label || "Node"}</span>
      </div>
      {data.description && (
        <p className="text-xs text-gray-500 mt-1">{data.description}</p>
      )}

      {/* Source Handle (Right) - Not for Outputs */}
      {nodeType !== "output" && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className="w-3 h-3 !bg-indigo-400 !border-2 !border-[#1e2130]" 
        />
      )}
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

const NODE_TEMPLATES = [
  { type: "trigger", label: "Trigger", icon: Zap, color: "text-amber-400" },
  { type: "action", label: "Action", icon: GitBranch, color: "text-indigo-400" },
  { type: "condition", label: "Condition", icon: Filter, color: "text-purple-400" },
  { type: "output", label: "Output", icon: Send, color: "text-emerald-400" },
];

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<any>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Configuration Sidebar State
  const [configDraft, setConfigDraft] = useState<any>({});

  useEffect(() => {
    api.getWorkflow(id).then((wf) => {
      setWorkflow(wf);
      const dag = wf.dag_definition || { nodes: [], edges: [] };
      setNodes(dag.nodes.map((n: any) => ({
        id: n.id, type: "custom", position: n.position || { x: 0, y: 0 },
        data: { label: n.label, nodeType: n.type, description: n.config?.description, config: n.config || {} },
      })));
      setEdges(dag.edges.map((e: any) => ({
        id: e.id, source: e.source, target: e.target, animated: true,
        style: { stroke: "#818cf8", strokeWidth: 2 },
      })));
    }).catch(() => router.push("/workflows"));
  }, [id, setNodes, setEdges, router]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "#818cf8", strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    const selected = nodes.length === 1 ? nodes[0] : null;
    if (selected && (!selectedNode || selectedNode.id !== selected.id)) {
      setSelectedNode(selected);
      setConfigDraft({ ...selected.data.config, label: selected.data.label, description: selected.data.description });
    } else if (!selected && selectedNode) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  const addNode = (template: typeof NODE_TEMPLATES[0]) => {
    const newNode: Node = {
      id: `${template.type}_${Date.now()}`,
      type: "custom",
      position: { x: 250 + Math.random() * 200, y: 100 + nodes.length * 120 },
      data: { label: `${template.label} ${nodes.length + 1}`, nodeType: template.type, config: {} },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const applyNodeConfig = () => {
    if (!selectedNode) return;
    
    setNodes((nds) => nds.map((n) => {
      if (n.id === selectedNode.id) {
        return {
          ...n,
          data: {
            ...n.data,
            label: configDraft.label || n.data.label,
            description: configDraft.description || n.data.description,
            config: { ...configDraft },
          }
        };
      }
      return n;
    }));
    
    setSelectedNode(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const dag = {
      nodes: nodes.map((n) => ({
        id: n.id, type: n.data.nodeType || "action", label: n.data.label,
        config: n.data.config || {}, position: n.position,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
    await api.updateWorkflow(id, { dag_definition: dag });
    setSaving(false);
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await handleSave();
      await api.executeWorkflow(id);
      router.push(`/workflows/${id}/executions`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExecuting(false);
    }
  };

  if (!workflow) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 animate-fade-in relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/workflows")} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{workflow.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={handleExecute} disabled={executing}>
            <Play className="w-4 h-4" /> {executing ? "Running..." : "Execute"}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative overflow-hidden flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
        
        {/* React Flow Canvas */}
        <div className={`glass-card overflow-hidden transition-all duration-300 flex-1 ${selectedNode ? 'mr-[320px]' : ''}`}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView className="bg-[var(--color-surface)]"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2130" />
            <Controls className="!bg-[var(--color-surface-elevated)] !border-[var(--color-border)] !rounded-lg [&>button]:!bg-[var(--color-surface-overlay)] [&>button]:!border-[var(--color-border)] [&>button]:!text-gray-400" />
            <MiniMap className="!bg-[var(--color-surface-elevated)] !border-[var(--color-border)] !rounded-lg" nodeColor="#4f46e5" maskColor="rgba(0,0,0,0.6)" />

            {/* Node Toolbar */}
            <Panel position="top-left">
              <div className="glass-card p-3 space-y-1.5">
                <p className="text-xs text-gray-500 font-medium px-2 mb-2">ADD NODE</p>
                {NODE_TEMPLATES.map((t) => (
                  <button key={t.type} onClick={() => addNode(t)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors">
                    <t.icon className={`w-4 h-4 ${t.color}`} /> {t.label}
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Configuration Sidebar */}
        <div className={`absolute top-0 right-0 w-[300px] h-full glass-card border-l border-white/5 shadow-2xl transition-transform duration-300 flex flex-col z-10 ${selectedNode ? 'translate-x-0' : 'translate-x-[110%]'}`}>
          {selectedNode && (
            <>
              {/* Sidebar Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold">Node Settings</h3>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Node Label</label>
                  <input type="text" className="input-field text-sm p-2" 
                    value={configDraft.label || ''} 
                    onChange={e => setConfigDraft({...configDraft, label: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description (Optional)</label>
                  <input type="text" className="input-field text-sm p-2" 
                    value={configDraft.description || ''} 
                    onChange={e => setConfigDraft({...configDraft, description: e.target.value})} />
                </div>

                {/* Node-specific configurations */}
                {selectedNode.data.nodeType === 'action' && (
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Action Type</label>
                      <select className="input-field text-sm p-2" 
                        value={configDraft.action_type || 'http_request'} 
                        onChange={e => setConfigDraft({...configDraft, action_type: e.target.value})}>
                        <option value="http_request">HTTP Request</option>
                        <option value="transform">Data Transform</option>
                        <option value="log">Log Output</option>
                      </select>
                    </div>

                    {(configDraft.action_type === 'http_request' || !configDraft.action_type) && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Method</label>
                          <select className="input-field text-sm p-2" 
                            value={configDraft.method || 'GET'} 
                            onChange={e => setConfigDraft({...configDraft, method: e.target.value})}>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">URL</label>
                          <input type="text" className="input-field text-sm p-2 font-mono" placeholder="https://api.example.com/data"
                            value={configDraft.url || ''} 
                            onChange={e => setConfigDraft({...configDraft, url: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">JSON Payload</label>
                          <textarea className="input-field text-sm p-2 font-mono h-24 resize-none" placeholder="{}"
                            value={configDraft.payload || ''} 
                            onChange={e => setConfigDraft({...configDraft, payload: e.target.value})} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {selectedNode.data.nodeType === 'trigger' && (
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Trigger Type</label>
                      <select className="input-field text-sm p-2" 
                        value={configDraft.trigger_type || 'webhook'} 
                        onChange={e => setConfigDraft({...configDraft, trigger_type: e.target.value})}>
                        <option value="webhook">Webhook</option>
                        <option value="cron">Scheduled (Cron)</option>
                        <option value="event">App Event</option>
                      </select>
                    </div>
                    {configDraft.trigger_type === 'cron' && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Cron Expression</label>
                        <input type="text" className="input-field text-sm p-2 font-mono" placeholder="* * * * *"
                          value={configDraft.cron || ''} 
                          onChange={e => setConfigDraft({...configDraft, cron: e.target.value})} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                <button className="btn-primary w-full" onClick={applyNodeConfig}>
                  Apply Changes
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
