"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { getTeamLabel, getTeamColor } from "@/lib/teams";

const ASSIGNABLE_ROLES = ["employee", "scrum_master"];

export default function RolesPage() {
  const { user, loading } = useAuth({ allowedRoles: ["super_admin"] });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchUsers = async () => {
    const token = await getToken();
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.users) setUsers(data.users);
    setLoadingUsers(false);
  };

  useEffect(() => {
    if (user) fetchUsers();
  }, [user]);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    const token = await getToken();
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, role: newRole }),
    });
    await fetchUsers();
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const teamMembers = users.filter((u) => u.id !== user.id);
  const scrumMasters = teamMembers.filter((u) => u.role === "scrum_master");
  const employees = teamMembers.filter((u) => u.role === "employee");

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-accent">Assign Roles</h1>
          <p className="text-sm text-muted mt-1">
            Set each team member as a Scrum Master or Employee
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary-light/50 border border-primary/10 rounded-xl p-4">
            <p className="text-2xl font-bold text-primary-dark">
              {scrumMasters.length}
            </p>
            <p className="text-sm text-primary-dark/70 mt-0.5">
              Scrum Masters
            </p>
          </div>
          <div className="bg-accent-light/50 border border-accent/10 rounded-xl p-4">
            <p className="text-2xl font-bold text-accent">{employees.length}</p>
            <p className="text-sm text-accent/70 mt-0.5">Employees</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 py-5 border-b border-card-border">
            <h2 className="text-lg font-semibold text-foreground">
              Team Members
              <span className="ml-2 text-sm font-normal text-muted">
                ({teamMembers.length})
              </span>
            </h2>
          </div>

          {loadingUsers ? (
            <div className="px-8 py-12 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted mt-3">Loading team...</p>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-accent-light flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-muted">
                No team members yet. Add users from the Admin Panel first.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-card-border/50">
              {teamMembers.map((u) => {
                const isUpdating = updatingId === u.id;

                return (
                  <div
                    key={u.id}
                    className="px-6 sm:px-8 py-4 hover:bg-primary-light/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-accent">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {u.name || "Unnamed"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs text-muted truncate">
                              {u.email}
                            </p>
                            {(u.teams || []).map((teamId) => (
                              <span
                                key={teamId}
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${getTeamColor(
                                  teamId
                                )}`}
                              >
                                {getTeamLabel(teamId)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {isUpdating ? (
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="flex rounded-lg border border-card-border overflow-hidden">
                            {ASSIGNABLE_ROLES.map((r) => (
                              <button
                                key={r}
                                onClick={() =>
                                  u.role !== r && handleRoleChange(u.id, r)
                                }
                                className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                  u.role === r
                                    ? r === "scrum_master"
                                      ? "bg-primary text-white"
                                      : "bg-accent text-white"
                                    : "bg-card text-muted hover:bg-background"
                                }`}
                              >
                                {r === "scrum_master"
                                  ? "Scrum Master"
                                  : "Employee"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
