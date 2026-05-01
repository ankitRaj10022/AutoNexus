"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, TrendingUp, Zap } from "lucide-react";

import { api } from "@/lib/api";
import type { UsageSummary, Workflow } from "@/lib/types";

export default function DashboardPage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  useEffect(() => {
    api.getUsage().then(setUsage).catch(() => {});
    api
      .getWorkflows()
      .then((data) => setWorkflows(data.workflows || []))
      .catch(() => {});
  }, []);

  const stats = [
    {
      label: "Total Workflows",
      value: workflows.length,
      icon: Zap,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Active",
      value: workflows.filter((workflow) => workflow.is_active).length,
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Tasks This Month",
      value: usage?.task_executions ?? 0,
      icon: TrendingUp,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Task Limit",
      value: usage?.task_limit === -1 ? "Infinity" : usage?.task_limit ?? 100,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your workspace</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div
                className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Workflows</h2>
        {workflows.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No workflows yet. Create your first workflow to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.slice(0, 5).map((workflow) => (
              <a
                key={workflow.id}
                href={`/workflows/${workflow.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      workflow.is_active ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                  />
                  <span className="font-medium group-hover:text-indigo-400 transition-colors">
                    {workflow.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="badge badge-info">
                    {workflow.trigger_type}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {usage && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Usage This Month</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-400">Task Executions</span>
                <span>
                  {usage.task_executions} /{" "}
                  {usage.task_limit === -1 ? "Infinity" : usage.task_limit}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      usage.task_limit === -1
                        ? 5
                        : Math.min(
                            100,
                            (usage.task_executions / usage.task_limit) * 100,
                          )
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
