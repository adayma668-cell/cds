"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";
import ConfirmModal from "@/components/ConfirmModal";

const ROLES = ["employee", "scrum_master", "super_admin"];

const ROLE_BADGE = {
  super_admin: "bg-accent-light text-accent",
  scrum_master: "bg-primary-light text-primary-dark",
  employee: "bg-background text-muted",
};

export default function AdminPage() {
  const { user, role, loading } = useAuth({ allowedRoles: ["super_admin"] });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "employee",
    teams: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editMessage, setEditMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [resendingInvite, setResendingInvite] = useState(null);

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

  const toggleTeam = (teamId) => {
    setForm((prev) => ({
      ...prev,
      teams: prev.teams.includes(teamId)
        ? prev.teams.filter((t) => t !== teamId)
        : [...prev.teams, teamId],
    }));
  };

  const toggleEditTeam = (teamId) => {
    setEditForm((prev) => ({
      ...prev,
      teams: prev.teams.includes(teamId)
        ? prev.teams.filter((t) => t !== teamId)
        : [...prev.teams, teamId],
    }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const token = await getToken();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage({
        type: "success",
        text: `Invite sent to ${form.email} successfully`,
      });
      setForm({ name: "", email: "", role: "employee", teams: [] });
      fetchUsers();
    } else {
      setMessage({ type: "error", text: data.error });
    }
    setSubmitting(false);
  };

  const openEdit = (u) => {
    setEditingUser(u.id);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      password: "",
      role: u.role || "employee",
      teams: u.teams || [],
    });
    setEditMessage(null);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditForm(null);
    setEditMessage(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    setEditMessage(null);

    const payload = { userId: editingUser };
    const original = users.find((u) => u.id === editingUser);

    if (editForm.name !== original.name) payload.name = editForm.name;
    if (editForm.email !== original.email) payload.email = editForm.email;
    if (editForm.password) payload.password = editForm.password;
    if (editForm.role !== original.role) payload.role = editForm.role;
    if (JSON.stringify(editForm.teams) !== JSON.stringify(original.teams || []))
      payload.teams = editForm.teams;

    const token = await getToken();
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setEditMessage({ type: "success", text: "User updated successfully" });
      fetchUsers();
      setTimeout(closeEdit, 1000);
    } else {
      const data = await res.json();
      setEditMessage({ type: "error", text: data.error });
    }
    setEditSubmitting(false);
  };

  const handleDeleteUser = async (userId) => {
    setDeleteConfirm(null);
    const token = await getToken();
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleResendInvite = async (u) => {
    setResendingInvite(u.id);
    const token = await getToken();
    try {
      const res = await fetch("/api/admin/users/resend-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: u.email, name: u.name }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Invite resent to ${u.email}` });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to resend invite" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to resend invite" });
    }
    setResendingInvite(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q)
      )
    : users;

  return (
    <AppLayout>
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDeleteUser(deleteConfirm?.userId)}
        title="Delete user"
        message={`${deleteConfirm ? `Delete ${deleteConfirm.email}? This will permanently remove their account and cannot be undone.` : ""}`}
        confirmLabel="Delete"
        variant="danger"
      />
      {/* Edit Modal */}
      {editingUser && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={closeEdit}
          />
          <div className="relative bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-md p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-accent">Edit User</h2>
              <button
                onClick={closeEdit}
                className="text-muted hover:text-foreground transition-colors cursor-pointer p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  New Password{" "}
                  <span className="text-muted font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm({ ...editForm, password: e.target.value })
                  }
                  placeholder="••••••••"
                  minLength={editForm.password ? 6 : undefined}
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Teams
                </label>
                <div className="flex flex-wrap gap-2">
                  {TEAMS.map((team) => {
                    const selected = editForm.teams.includes(team.id);
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => toggleEditTeam(team.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          selected
                            ? team.color
                            : "bg-card text-muted border-card-border hover:bg-background"
                        }`}
                      >
                        {selected && <span className="mr-1">&#10003;</span>}
                        {team.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editMessage && (
                <p
                  className={`text-sm rounded-lg px-3.5 py-2.5 border ${
                    editMessage.type === "success"
                      ? "text-primary-dark bg-primary-light border-primary/20"
                      : "text-danger bg-red-50 border-red-100"
                  }`}
                >
                  {editMessage.text}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-accent">Admin Panel</h1>
          <p className="text-sm text-muted mt-1">
            Manage users, assign roles, and set teams
          </p>
        </div>

        {/* Add User Form */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Invite User
              </h2>
              <p className="text-xs text-muted">
                They&apos;ll receive an email to set their own password
              </p>
            </div>
          </div>

          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Role <span className="text-danger">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Teams
              </label>
              <div className="flex flex-wrap gap-2">
                {TEAMS.map((team) => {
                  const selected = form.teams.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeam(team.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        selected
                          ? team.color
                          : "bg-card text-muted border-card-border hover:bg-background"
                      }`}
                    >
                      {selected && <span className="mr-1">&#10003;</span>}
                      {team.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {message && (
              <p
                className={`text-sm rounded-lg px-3.5 py-2.5 border ${
                  message.type === "success"
                    ? "text-primary-dark bg-primary-light border-primary/20"
                    : "text-danger bg-red-50 border-red-100"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer inline-flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending Invite...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Invite
                </>
              )}
            </button>
          </form>
        </div>

        {/* Search & User Matrix */}
        <div className="space-y-4">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full rounded-lg border border-card-border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-primary-light/50 border border-primary/10 rounded-xl p-4">
              <p className="text-2xl font-bold text-primary-dark">
                {users.filter((u) => u.role === "scrum_master").length}
              </p>
              <p className="text-sm text-primary-dark/70 mt-0.5">Scrum Masters</p>
            </div>
            <div className="bg-accent-light/50 border border-accent/10 rounded-xl p-4">
              <p className="text-2xl font-bold text-accent">
                {users.filter((u) => u.role === "employee").length}
              </p>
              <p className="text-sm text-accent/70 mt-0.5">Employees</p>
            </div>
            <div className="bg-background border border-card-border rounded-xl p-4">
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.role === "super_admin").length}
              </p>
              <p className="text-sm text-muted mt-0.5">Super Admins</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-sm text-muted mt-0.5">Total Users</p>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 py-5 border-b border-card-border flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              All Users
              <span className="ml-2 text-sm font-normal text-muted">
                ({filteredUsers.length}{searchQuery ? ` of ${users.length}` : ""})
              </span>
            </h2>
          </div>

          {loadingUsers ? (
            <div className="px-8 py-12 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted mt-3">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-8 py-12 text-center text-sm text-muted">
              {users.length === 0
                ? "No users found. Add your first user above."
                : "No users match your search."}
            </div>
          ) : (
            <div className="divide-y divide-card-border/50">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="px-4 sm:px-8 py-4 hover:bg-primary-light/20 transition-colors"
                >
                  {/* Desktop layout */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.avatar_url ? (
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-card-border">
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-accent-light flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-accent">
                              {(u.name || u.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.name || "—"}</p>
                          <p className="text-xs text-muted truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4 flex-wrap justify-end">
                        {!u.password_set && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            Invite Pending
                          </span>
                        )}
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role] || ROLE_BADGE.employee}`}>
                          {u.role.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-muted">
                          {new Date(u.created_at).toLocaleDateString()}
                        </span>
                        {u.id !== user.id && (
                          <>
                            <button
                              onClick={() => handleResendInvite(u)}
                              disabled={resendingInvite === u.id}
                              className="text-xs font-medium text-primary hover:text-primary-dark hover:bg-primary-light px-2 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {resendingInvite === u.id ? (
                                <div className="w-3 h-3 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              )}
                              Resend
                            </button>
                            <button
                              onClick={() => openEdit(u)}
                              className="text-xs font-medium text-accent hover:text-accent-dark hover:bg-accent-light px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ userId: u.id, email: u.email })}
                              className="text-xs font-medium text-danger hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {u.id === user.id && (
                          <span className="text-xs font-medium text-primary">You</span>
                        )}
                      </div>
                    </div>
                    {(u.teams || []).length > 0 && (
                      <div className="flex items-center gap-1.5 pl-12">
                        {u.teams.map((teamId) => (
                          <span
                            key={teamId}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getTeamColor(teamId)}`}
                          >
                            {getTeamLabel(teamId)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-3">
                    <div className="flex items-start gap-3">
                      {u.avatar_url ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-card-border">
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-accent">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{u.name || "—"}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[u.role] || ROLE_BADGE.employee}`}>
                            {u.role.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted truncate mt-0.5">{u.email}</p>
                        {!u.password_set && (
                          <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            Invite Pending
                          </span>
                        )}
                        {(u.teams || []).length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {u.teams.map((teamId) => (
                              <span
                                key={teamId}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getTeamColor(teamId)}`}
                              >
                                {getTeamLabel(teamId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {u.id !== user.id ? (
                      <div className="flex items-center gap-1 pl-[52px] border-t border-card-border/30 pt-2">
                        <button
                          onClick={() => handleResendInvite(u)}
                          disabled={resendingInvite === u.id}
                          className="text-xs font-medium text-primary hover:bg-primary-light px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {resendingInvite === u.id ? (
                            <div className="w-3 h-3 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                          Resend
                        </button>
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs font-medium text-accent hover:bg-accent-light px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ userId: u.id, email: u.email })}
                          className="text-xs font-medium text-danger hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="pl-[52px]">
                        <span className="text-xs font-medium text-primary">You</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
