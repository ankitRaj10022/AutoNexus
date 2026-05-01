"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Zap } from "lucide-react";

import { api } from "@/lib/api";
import type { UsageSummary } from "@/lib/types";

const PLAN_COPY = {
  free: {
    title: "Free",
    price: "$0",
    limit: "100 tasks/month",
    features: ["100 tasks/month", "5 workflows", "Standard support"],
    cta: "Current Plan",
  },
  pro: {
    title: "Pro",
    price: "$49",
    limit: "10,000 tasks/month",
    features: [
      "10,000 tasks/month",
      "Unlimited workflows",
      "Priority support",
      "Webhooks and API keys",
    ],
    cta: "Upgrade to Pro",
  },
  enterprise: {
    title: "Enterprise",
    price: "Custom",
    limit: "Unlimited tasks",
    features: [
      "Unlimited tasks",
      "Dedicated infrastructure",
      "SLA guarantee",
      "Account manager",
    ],
    cta: "Contact Sales",
  },
} as const;

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    api.getUsage().then(setUsage).catch(console.error);
  }, []);

  const limitStr = usage?.task_limit === -1 ? "Unlimited" : usage?.task_limit;
  const percent =
    usage?.task_limit === -1
      ? 0
      : Math.min(
          100,
          ((usage?.task_executions || 0) / (usage?.task_limit || 1)) * 100,
        );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Billing & Usage</h1>
        <p className="text-gray-400 mt-1">Manage your workspace subscription</p>
      </div>

      <div className="glass-card p-6 border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" /> Current Usage
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Task executions reset on the 1st of every month.
            </p>
          </div>
          <span className="badge bg-indigo-500/20 text-indigo-300 border-indigo-500/30 px-3 py-1 font-semibold text-sm">
            {usage?.plan?.toUpperCase() || "FREE"} PLAN
          </span>
        </div>

        <div className="mt-8 relative z-10">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300 font-medium">Task Executions</span>
            <span className="font-bold">
              {usage?.task_executions || 0}{" "}
              <span className="text-gray-500 font-normal">/ {limitStr}</span>
            </span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 relative"
              style={{ width: `${percent || 5}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(PLAN_COPY).map(([planKey, plan]) => {
          const isCurrentPlan = usage?.plan === planKey;
          const isProPlan = planKey === "pro";

          return (
            <div
              key={planKey}
              className={`glass-card p-6 flex flex-col ${
                isProPlan
                  ? "relative border-indigo-500/50 shadow-[0_0_30px_-10px_rgba(99,102,241,0.3)]"
                  : ""
              }`}
            >
              {isProPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}
              <h3
                className={`text-xl font-bold ${
                  isProPlan ? "text-indigo-400" : ""
                }`}
              >
                {plan.title}
              </h3>
              <p className="text-3xl font-extrabold mt-4 mb-2">
                {plan.price}
                {plan.price.startsWith("$") && (
                  <span className="text-sm font-normal text-gray-400">
                    {" "}
                    / mo
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-400 mb-6 flex-1">{plan.limit}</p>

              <ul className="space-y-3 mb-8 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-gray-300">
                    <Check
                      className={`w-4 h-4 flex-shrink-0 ${
                        isProPlan ? "text-indigo-400" : "text-emerald-400"
                      }`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-2.5 rounded-lg font-medium ${
                  isCurrentPlan
                    ? "border border-white/10 text-gray-400 cursor-not-allowed bg-white/5"
                    : isProPlan
                      ? "btn-primary flex items-center justify-center gap-2"
                      : "border border-white/10 hover:bg-white/5 transition-colors"
                }`}
                disabled={isCurrentPlan}
              >
                {isProPlan && !isCurrentPlan && (
                  <CreditCard className="w-4 h-4" />
                )}
                {isCurrentPlan ? "Current Plan" : plan.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
