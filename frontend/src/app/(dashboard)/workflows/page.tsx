"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Clock,
  Copy,
  GitBranch,
  Play,
  Plus,
  Search,
  Trash2,
  Webhook,
} from "lucide-react";

import { api } from "@/lib/api";
import type { Workflow } from "@/lib/types";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
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

  const handleDuplicate = async (workflow: Workflow) => {
    setBusyId(workflow.id);
    setError("");

    try {
      const duplicated = await api.createWorkflow({
        name: `${workflow.name} Copy`,
        description: workflow.description ?? undefined,
        dag_definition: workflow.dag_definition,
        trigger_type: workflow.trigger_type,
        schedule: workflow.schedule,
      });

      setWorkflows((current) => [duplicated, ...current]);
    } catch (errorValue: unknown) {
      setError(
        errorValue instanceof Error
          ? errorValue.message
          : "Could not duplicate workflow",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (workflow: Workflow) => {
    setBusyId(workflow.id);
    setError("");

    try {
      const updated = await api.updateWorkflow(workflow.id, {
        is_active: false,
      });

      setWorkflows((current) =>
        current.map((item) => (item.id === workflow.id ? updated : item)),
      );
    } catch (errorValue: unknown) {
      setError(
        errorValue instanceof Error
          ? errorValue.message
          : "Could not archive workflow",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (workflow: Workflow) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete "${workflow.name}"? This cannot be undone.`)
    ) {
      return;
    }

    setBusyId(workflow.id);
    setError("");

    try {
      await api.deleteWorkflow(workflow.id);
      setWorkflows((current) =>
        current.filter((item) => item.id !== workflow.id),
      );
    } catch (errorValue: unknown) {
      setError(
        errorValue instanceof Error
          ? errorValue.message
          : "Could not delete workflow",
      );
    } finally {
      setBusyId(null);
    }
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

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

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
          <Link
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
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold group-hover:text-indigo-400 transition-colors">
                {workflow.name}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDuplicate(workflow);
                  }}
                  disabled={busyId === workflow.id}
                  title="Duplicate workflow"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-amber-300"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleArchive(workflow);
                  }}
                  disabled={busyId === workflow.id || !workflow.is_active}
                  title="Archive workflow"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-red-300"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDelete(workflow);
                  }}
                  disabled={busyId === workflow.id}
                  title="Delete workflow"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {workflow.description || "No description"}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="badge badge-info flex items-center gap-1">
                {triggerIcon(workflow.trigger_type)} {workflow.trigger_type}
              </span>
              {!workflow.is_active && (
                <span className="badge badge-warning">archived</span>
              )}
              {workflow.schedule && (
                <span className="badge badge-warning">{workflow.schedule}</span>
              )}
            </div>
          </Link>
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
