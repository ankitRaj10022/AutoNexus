"use client";

import { useEffect, useState } from "react";
import { Check, Copy, CreditCard, Key, Plus, Shield, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApiKey, PlanDetails } from "@/lib/types";

export default function SettingsPage() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getPlan().then(setPlan).catch(() => {});
    api
      .getApiKeys()
      .then((data) => setApiKeys(data.keys || []))
      .catch(() => {});
  }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) {
      return;
    }

    const response = await api.createApiKey({ name: newKeyName });
    setCreatedKey(response.key);
    setNewKeyName("");
    setShowNewKey(false);

    const keys = await api.getApiKeys();
    setApiKeys(keys.keys || []);
  };

  const revokeKey = async (keyId: string) => {
    await api.revokeApiKey(keyId);
    setApiKeys((currentKeys) => currentKeys.filter((key) => key.id !== keyId));
  };

  const copyKey = async () => {
    if (!createdKey) {
      return;
    }
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-3xl animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-indigo-400" /> Profile
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Name:</span>{" "}
            <span className="ml-2">{user?.full_name}</span>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>{" "}
            <span className="ml-2">{user?.email}</span>
          </div>
          <div>
            <span className="text-gray-500">Role:</span>{" "}
            <span className="ml-2 badge badge-info">{user?.role}</span>
          </div>
        </div>
      </div>

      {plan && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-purple-400" /> Plan
          </h2>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-2xl font-bold capitalize">{plan.plan}</span>
            <span className="badge badge-info">
              {plan.task_limit === -1
                ? "Unlimited"
                : `${plan.task_limit} tasks/mo`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.features.map((feature) => (
              <span
                key={feature}
                className="text-xs bg-white/5 px-2.5 py-1 rounded-full text-gray-400"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" /> API Keys
          </h2>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={() => setShowNewKey(true)}
          >
            <Plus className="w-3.5 h-3.5" /> New Key
          </button>
        </div>

        {createdKey && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
            <p className="text-xs text-emerald-400 mb-1.5">
              Save this key. It will not be shown again:
            </p>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-black/30 px-3 py-1.5 rounded flex-1 text-emerald-300 font-mono truncate">
                {createdKey}
              </code>
              <button onClick={copyKey} className="btn-secondary !p-2">
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {showNewKey && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Key name"
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void createKey()}
              autoFocus
            />
            <button className="btn-primary" onClick={() => void createKey()}>
              Create
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowNewKey(false)}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/3 hover:bg-white/5 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{key.name}</p>
                <p className="text-xs text-gray-500">
                  {key.key_prefix}... | {key.is_active ? "Active" : "Revoked"}
                </p>
              </div>
              <button
                onClick={() => void revokeKey(key.id)}
                className="text-gray-500 hover:text-red-400 transition-colors"
                title="Revoke"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {apiKeys.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No API keys</p>
          )}
        </div>
      </div>
    </div>
  );
}
