"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, GitBranch, Play, Plus, Search, Webhook } from "lucide-react";

import { api } from "@/lib/api";
import type { Workflow } from "@/lib/types";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const router = useRouter();

  useEffect(() => {
    api
      .getWorkflows()
      .then((data) => setWorkflows(data.workflows || []))
      .catch(() => {});
  }, []);

  const filtered = workflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = async () => {
    if (!newName.trim()) {
      return;
    }

    const workflow = await api.createWorkflow({
      name: newName,
      trigger_type: "manual",
    });
    router.push(`/workflows/${workflow.id}`);
  };

  const triggerIcon = (type: string) => {
    switch (type) {
      case "cron":
        return <Clock className="w-3.5 h-3.5" />;
      case "webhook":
        return <Webhook className="w-3.5 h-3.5" />;
      default:
        return <Play className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-gray-400 mt-1">
            Build and manage automation workflows
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          className="input-field pl-10"
          placeholder="Search workflows..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="glass-card p-6 w-full max-w-md animate-fade-in"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Create Workflow</h3>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="Workflow name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && void handleCreate()}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={() => void handleCreate()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((workflow) => (
          <a
            key={workflow.id}
            href={`/workflows/${workflow.id}`}
            className="glass-card p-5 cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-indigo-400" />
              </div>
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1 ${
                  workflow.is_active ? "bg-emerald-400" : "bg-gray-500"
                }`}
              />
            </div>
            <h3 className="font-semibold group-hover:text-indigo-400 transition-colors">
              {workflow.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {workflow.description || "No description"}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="badge badge-info flex items-center gap-1">
                {triggerIcon(workflow.trigger_type)} {workflow.trigger_type}
              </span>
              {workflow.schedule && (
                <span className="badge badge-warning">{workflow.schedule}</span>
              )}
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">No workflows found</p>
          <p className="text-sm mt-1">
            Create your first workflow to start automating
          </p>
        </div>
      )}
    </div>
  );
}
