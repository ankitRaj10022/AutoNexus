"use client";

import { useEffect, useState } from "react";
import { Mail, MoreVertical, Shield, UserPlus, Users } from "lucide-react";

import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getUsers()
      .then((data) => {
        setUsers(data.users || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-gray-400 mt-1">
            Manage workspace members and roles
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 opacity-60 cursor-not-allowed"
          disabled
          title="Invite flow is not implemented yet"
        >
          <UserPlus className="w-4 h-4" /> Invite Soon
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Workspace Members
          </h2>
          <span className="badge badge-info">{users.length} members</span>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                    {user.full_name.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="font-medium">{user.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-400">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`badge ${
                      user.role === "admin"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "badge-info"
                    }`}
                  >
                    <Shield className="w-3 h-3 inline mr-1" />
                    {user.role}
                  </span>
                  <button className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
