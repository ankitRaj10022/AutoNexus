"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  ArrowLeft,
  Filter,
  GitBranch,
  type LucideIcon,
  Play,
  Save,
  Send,
  Settings2,
  X,
  Zap,
} from "lucide-react";

import { api } from "@/lib/api";
import type {
  Workflow,
  WorkflowDagDefinition,
  WorkflowDagEdge,
  WorkflowDagNode,
  WorkflowNodeType,
} from "@/lib/types";
import "@xyflow/react/dist/style.css";

type WorkflowCanvasNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
  description?: string;
  config: Record<string, unknown>;
};

type WorkflowCanvasNode = Node<WorkflowCanvasNodeData, "custom">;
type WorkflowCanvasEdge = Edge;

type NodeConfigDraft = {
  label?: string;
  description?: string;
  action_type?: string;
  method?: string;
  url?: string;
  payload?: string;
  trigger_type?: string;
  cron?: string;
  [key: string]: string | undefined;
};

type NodeTemplate = {
  type: WorkflowNodeType;
  label: string;
  icon: LucideIcon;
  color: string;
};

const NODE_TEMPLATES: NodeTemplate[] = [
  { type: "trigger", label: "Trigger", icon: Zap, color: "text-amber-400" },
  { type: "action", label: "Action", icon: GitBranch, color: "text-indigo-400" },
  {
    type: "condition",
    label: "Condition",
    icon: Filter,
    color: "text-purple-400",
  },
  { type: "output", label: "Output", icon: Send, color: "text-emerald-400" },
];

function getNodeDescription(config: Record<string, unknown>): string | undefined {
  return typeof config.description === "string" ? config.description : undefined;
}

function toDraft(
  config: Record<string, unknown>,
  label: string,
  description?: string,
): NodeConfigDraft {
  const stringEntries = Object.entries(config).filter(
    ([, value]) => typeof value === "string",
  );

  return {
    ...(Object.fromEntries(stringEntries) as Record<string, string>),
    label,
    description: description ?? "",
  };
}

function buildConfigFromDraft(draft: NodeConfigDraft): Record<string, unknown> {
  const entries = Object.entries(draft).filter(([key, value]) => {
    if (key === "label") {
      return false;
    }
    return Boolean(value);
  });

  return Object.fromEntries(entries);
}

function CustomNode({ data, selected }: NodeProps<WorkflowCanvasNode>) {
  const colors: Record<
    WorkflowNodeType,
    { bg: string; border: string; icon: LucideIcon }
  > = {
    trigger: {
      bg: "bg-amber-500/15",
      border: "border-amber-500/40",
      icon: Zap,
    },
    action: {
      bg: "bg-indigo-500/15",
      border: "border-indigo-500/40",
      icon: GitBranch,
    },
    condition: {
      bg: "bg-purple-500/15",
      border: "border-purple-500/40",
      icon: Filter,
    },
    output: {
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/40",
      icon: Send,
    },
  };

  const color = colors[data.nodeType];
  const Icon = color.icon;
  const glowClass = selected
    ? "shadow-[0_0_15px_rgba(255,255,255,0.2)] border-white/40 scale-[1.02]"
    : "shadow-lg border";

  return (
    <div
      className={`${color.bg} ${glowClass} ${color.border} rounded-xl px-4 py-3 min-w-[160px] backdrop-blur-sm transition-all duration-200 relative`}
    >
      {data.nodeType !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-indigo-400 !border-2 !border-[#1e2130]"
        />
      )}

      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-300" />
        <span className="text-sm font-medium text-gray-200">
          {data.label || "Node"}
        </span>
      </div>
      {data.description && (
        <p className="text-xs text-gray-500 mt-1">{data.description}</p>
      )}

      {data.nodeType !== "output" && (
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

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowCanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowCanvasEdge>([]);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkflowCanvasNode | null>(
    null,
  );
  const [configDraft, setConfigDraft] = useState<NodeConfigDraft>({});
  const nextNodeSequenceRef = useRef(1);

  useEffect(() => {
    api
      .getWorkflow(id)
      .then((currentWorkflow) => {
        setWorkflow(currentWorkflow);
        const dag = currentWorkflow.dag_definition || { nodes: [], edges: [] };
        nextNodeSequenceRef.current = dag.nodes.length + 1;

        setNodes(
          dag.nodes.map((node: WorkflowDagNode) => ({
            id: node.id,
            type: "custom",
            position: node.position || { x: 0, y: 0 },
            data: {
              label: node.label,
              nodeType: node.type,
              description: getNodeDescription(node.config),
              config: node.config || {},
            },
          })),
        );
        setEdges(
          dag.edges.map((edge: WorkflowDagEdge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            animated: true,
            style: { stroke: "#818cf8", strokeWidth: 2 },
          })),
        );
      })
      .catch(() => router.push("/workflows"));
  }, [id, router, setEdges, setNodes]);

  const onConnect = (connection: Connection) => {
    setEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: "#818cf8", strokeWidth: 2 },
        },
        currentEdges,
      ),
    );
  };

  const onSelectionChange = ({ nodes: selectedNodes }: { nodes: WorkflowCanvasNode[] }) => {
    const selected = selectedNodes.length === 1 ? selectedNodes[0] : null;
    if (selected && selectedNode?.id !== selected.id) {
      setSelectedNode(selected);
      setConfigDraft(
        toDraft(selected.data.config, selected.data.label, selected.data.description),
      );
      return;
    }

    if (!selected && selectedNode) {
      setSelectedNode(null);
    }
  };

  const addNode = (template: NodeTemplate) => {
    const sequence = nextNodeSequenceRef.current++;
    const column = (sequence - 1) % 3;
    const row = Math.floor((sequence - 1) / 3);

    const newNode: WorkflowCanvasNode = {
      id: `${template.type}_${sequence}`,
      type: "custom",
      position: { x: 180 + column * 220, y: 80 + row * 140 },
      data: {
        label: `${template.label} ${sequence}`,
        nodeType: template.type,
        config: {},
      },
    };

    setNodes((currentNodes) => [...currentNodes, newNode]);
  };

  const applyNodeConfig = () => {
    if (!selectedNode) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== selectedNode.id) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            label: configDraft.label || node.data.label,
            description: configDraft.description || undefined,
            config: buildConfigFromDraft(configDraft),
          },
        };
      }),
    );

    setSelectedNode(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dag: WorkflowDagDefinition = {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.data.nodeType,
          label: node.data.label,
          config: node.data.config,
          position: node.position,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
        })),
      };

      await api.updateWorkflow(id, { dag_definition: dag });
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await handleSave();
      await api.executeWorkflow(id);
      router.push(`/workflows/${id}/executions`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  };

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/workflows")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{workflow.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => void handleExecute()}
            disabled={executing}
          >
            <Play className="w-4 h-4" />{" "}
            {executing ? "Running..." : "Execute"}
          </button>
        </div>
      </div>

      <div
        className="relative overflow-hidden flex gap-4"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <div
          className={`glass-card overflow-hidden transition-all duration-300 flex-1 ${
            selectedNode ? "mr-[320px]" : ""
          }`}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[var(--color-surface)]"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#1e2130"
            />
            <Controls className="!bg-[var(--color-surface-elevated)] !border-[var(--color-border)] !rounded-lg [&>button]:!bg-[var(--color-surface-overlay)] [&>button]:!border-[var(--color-border)] [&>button]:!text-gray-400" />
            <MiniMap
              className="!bg-[var(--color-surface-elevated)] !border-[var(--color-border)] !rounded-lg"
              nodeColor="#4f46e5"
              maskColor="rgba(0,0,0,0.6)"
            />

            <Panel position="top-left">
              <div className="glass-card p-3 space-y-1.5">
                <p className="text-xs text-gray-500 font-medium px-2 mb-2">
                  ADD NODE
                </p>
                {NODE_TEMPLATES.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => addNode(template)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <template.icon className={`w-4 h-4 ${template.color}`} />{" "}
                    {template.label}
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        <div
          className={`absolute top-0 right-0 w-[300px] h-full glass-card border-l border-white/5 shadow-2xl transition-transform duration-300 flex flex-col z-10 ${
            selectedNode ? "translate-x-0" : "translate-x-[110%]"
          }`}
        >
          {selectedNode && (
            <>
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold">Node Settings</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Node Label
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm p-2"
                    value={configDraft.label || ""}
                    onChange={(event) =>
                      setConfigDraft({
                        ...configDraft,
                        label: event.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm p-2"
                    value={configDraft.description || ""}
                    onChange={(event) =>
                      setConfigDraft({
                        ...configDraft,
                        description: event.target.value,
                      })
                    }
                  />
                </div>

                {selectedNode.data.nodeType === "action" && (
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Action Type
                      </label>
                      <select
                        className="input-field text-sm p-2"
                        value={configDraft.action_type || "http_request"}
                        onChange={(event) =>
                          setConfigDraft({
                            ...configDraft,
                            action_type: event.target.value,
                          })
                        }
                      >
                        <option value="http_request">HTTP Request</option>
                        <option value="transform">Data Transform</option>
                        <option value="log">Log Output</option>
                      </select>
                    </div>

                    {(configDraft.action_type === "http_request" ||
                      !configDraft.action_type) && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Method
                          </label>
                          <select
                            className="input-field text-sm p-2"
                            value={configDraft.method || "GET"}
                            onChange={(event) =>
                              setConfigDraft({
                                ...configDraft,
                                method: event.target.value,
                              })
                            }
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            URL
                          </label>
                          <input
                            type="text"
                            className="input-field text-sm p-2 font-mono"
                            placeholder="https://api.example.com/data"
                            value={configDraft.url || ""}
                            onChange={(event) =>
                              setConfigDraft({
                                ...configDraft,
                                url: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            JSON Payload
                          </label>
                          <textarea
                            className="input-field text-sm p-2 font-mono h-24 resize-none"
                            placeholder="{}"
                            value={configDraft.payload || ""}
                            onChange={(event) =>
                              setConfigDraft({
                                ...configDraft,
                                payload: event.target.value,
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {selectedNode.data.nodeType === "trigger" && (
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Trigger Type
                      </label>
                      <select
                        className="input-field text-sm p-2"
                        value={configDraft.trigger_type || "webhook"}
                        onChange={(event) =>
                          setConfigDraft({
                            ...configDraft,
                            trigger_type: event.target.value,
                          })
                        }
                      >
                        <option value="webhook">Webhook</option>
                        <option value="cron">Scheduled (Cron)</option>
                        <option value="event">App Event</option>
                      </select>
                    </div>
                    {configDraft.trigger_type === "cron" && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Cron Expression
                        </label>
                        <input
                          type="text"
                          className="input-field text-sm p-2 font-mono"
                          placeholder="* * * * *"
                          value={configDraft.cron || ""}
                          onChange={(event) =>
                            setConfigDraft({
                              ...configDraft,
                              cron: event.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

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
