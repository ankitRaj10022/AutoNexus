"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Key, Plus, ShieldAlert, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import type { ApiKey } from "@/lib/types";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api
      .getApiKeys()
      .then((data) => setKeys(data.keys || []))
      .catch(() => {});
  }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) {
      return;
    }

    const response = await api.createApiKey({ name: newKeyName.trim() });
    setCreatedKey(response.key);
    setNewKeyName("");
    setShowNewKey(false);

    const data = await api.getApiKeys();
    setKeys(data.keys || []);
  };

  const revokeKey = async (keyId: string) => {
    await api.revokeApiKey(keyId);
    setKeys((currentKeys) => currentKeys.filter((key) => key.id !== keyId));
  };

  const copyKey = async () => {
    if (!createdKey) {
      return;
    }

    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "Never";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-gray-400 mt-1">
            Manage API keys for external integrations
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowNewKey(true)}
        >
          <Plus className="w-4 h-4" /> Generate New Key
        </button>
      </div>

      {createdKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-sm text-emerald-400 mb-2">
            Save this key now. It will not be shown again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-black/40 text-emerald-200 font-mono text-sm truncate">
              {createdKey}
            </code>
            <button
              className="btn-secondary !p-2"
              onClick={() => void copyKey()}
              title="Copy key"
            >
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
        <div className="glass-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Production Key"
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void createKey()}
            autoFocus
          />
          <div className="flex gap-2">
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
        </div>
      )}

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-200">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
        <div>
          <p className="font-semibold text-amber-400">Keep your keys secret</p>
          <p className="text-sm mt-1 opacity-80">
            Do not expose these keys in client-side code. If a key is
            compromised, revoke it immediately.
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-gray-400">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Key Prefix</th>
              <th className="px-6 py-4 font-medium">Created</th>
              <th className="px-6 py-4 font-medium">Last Used</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {keys.map((key) => (
              <tr
                key={key.id}
                className="hover:bg-white/[0.02] transition-colors group"
              >
                <td className="px-6 py-4 font-medium flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  {key.name}
                </td>
                <td className="px-6 py-4">
                  <code className="px-2 py-1 bg-black/40 rounded-md text-gray-300 font-mono tracking-wider">
                    {key.key_prefix}...
                  </code>
                </td>
                <td className="px-6 py-4 text-gray-400">
                  {formatDate(key.created_at)}
                </td>
                <td className="px-6 py-4 text-gray-400">
                  {formatDate(key.last_used_at)}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300"
                      onClick={() => void copyKey()}
                      disabled={!createdKey}
                      title="Copy latest created key"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      onClick={() => void revokeKey(key.id)}
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No API keys yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
