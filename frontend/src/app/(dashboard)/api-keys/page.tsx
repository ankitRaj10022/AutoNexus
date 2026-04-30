"use client";

import { useState } from "react";
import { Key, Plus, Copy, Trash2, ShieldAlert } from "lucide-react";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState([
    { id: "1", name: "Production Key", key: "anx_live_9a8b...3f2e", created_at: "2026-04-01", last_used: "2 Hours ago" },
    { id: "2", name: "Development Key", key: "anx_test_1c2d...4e5f", created_at: "2026-04-15", last_used: "Just now" }
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-gray-400 mt-1">Manage API keys for external integrations</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Generate New Key
        </button>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-200">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
        <div>
          <p className="font-semibold text-amber-400">Keep your keys secret</p>
          <p className="text-sm mt-1 opacity-80">Do not expose these keys in client-side code. If a key is compromised, revoke it immediately.</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-gray-400">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Secret Key</th>
              <th className="px-6 py-4 font-medium">Created</th>
              <th className="px-6 py-4 font-medium">Last Used</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-4 font-medium flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  {k.name}
                </td>
                <td className="px-6 py-4">
                  <code className="px-2 py-1 bg-black/40 rounded-md text-gray-300 font-mono tracking-wider">
                    {k.key}
                  </code>
                </td>
                <td className="px-6 py-4 text-gray-400">{k.created_at}</td>
                <td className="px-6 py-4 text-gray-400">{k.last_used}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
