"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { TasksSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import ConfirmModal from "@/components/ConfirmModal";
import AzureWorkItemPicker from "@/components/AzureWorkItemPicker";

const STATUS_OPTIONS = [
  { value: "to_be_done", label: "To Be Done", color: "bg-amber-100 text-amber-700 border-amber-200", hoverColor: "hover:bg-amber-100 hover:text-amber-700 hover:border-amber-200" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200", hoverColor: "hover:bg-blue-100 hover:text-blue-700 hover:border-blue-200" },
  { value: "closed", label: "Closed", color: "bg-green-100 text-green-700 border-green-200", hoverColor: "hover:bg-green-100 hover:text-green-700 hover:border-green-200" },
];

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    ticket_number: "",
    title: "",
    due_date: "",
    status: "to_be_done",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [manualMode, setManualMode] = useState(false);

  const fetchTickets = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/tickets", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const data = await res.json();
    setTickets(data.tickets || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      setLoading(true);
      fetchTickets();
    }
  }, [authLoading, user, fetchTickets]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.ticket_number.trim()) return;
    setSubmitting(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ ticket_number: "", title: "", due_date: "", status: "to_be_done", description: "" });
      fetchTickets();
    }
    setSubmitting(false);
  };

  const startEdit = (ticket) => {
    setEditingId(ticket.id);
    setEditForm({
      ticket_number: ticket.ticket_number,
      title: ticket.title || "",
      due_date: ticket.due_date ? ticket.due_date.slice(0, 10) : "",
      status: ticket.status,
      description: ticket.description || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch(`/api/tickets/${editingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    setEditForm({});
    setSaving(false);
    fetchTickets();
  };

  const handleStatusChange = async (ticket, newStatus) => {
    const prevTickets = [...tickets];
    setTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t))
    );
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) setTickets(prevTickets);
    } catch {
      setTickets(prevTickets);
    }
  };

  const handleDelete = async (id) => {
    setDeleteConfirm(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch(`/api/tickets/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchTickets();
  };

  if (authLoading) {
    return (
      <AppLayout>
        <TasksSkeleton />
      </AppLayout>
    );
  }

  if (!user) return null;

  const displayed = tickets;
  const statusCounts = {
    to_be_done: tickets.filter((t) => t.status === "to_be_done").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <AppLayout>
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm)}
        title="Delete ticket"
        message="This ticket will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-accent">My Tasks</h1>
            <p className="text-sm text-muted mt-1">
              Add tickets and track status. Update at end of day.
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {STATUS_OPTIONS.map((s) => (
            <div
              key={s.value}
              className={`rounded-xl border p-4 bg-card border-card-border transition-all ${s.hoverColor}`}
            >
              <p className="text-2xl font-bold">{statusCounts[s.value]}</p>
              <p className="text-xs font-semibold mt-0.5 text-muted">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Add form — Azure DevOps picker + manual fallback */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">
              {manualMode ? "Add Ticket Manually" : "Add from Azure DevOps"}
            </h2>
            <button
              type="button"
              onClick={() => setManualMode((m) => !m)}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {manualMode ? "Import from Azure DevOps" : "Enter manually"}
            </button>
          </div>

          {!manualMode && (
            <div className="mb-4">
              <AzureWorkItemPicker
                disabled={submitting}
                onSelect={({ ticket_number, title, status, due_date }) => {
                  setForm((f) => ({
                    ...f,
                    ticket_number,
                    title,
                    status: status || f.status,
                    due_date: due_date || f.due_date,
                  }));
                }}
              />
              {form.ticket_number && (
                <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-primary-light/30 border border-primary/20 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      #{form.ticket_number} — {form.title || "No title"}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Selected — fill in details below and click Add Ticket
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ticket_number: "", title: "", due_date: "", status: "to_be_done", description: "" })}
                    className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted/50 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer mt-0.5"
                    title="Clear selection"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-4">
            {manualMode && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                      Ticket Number
                    </label>
                    <input
                      type="text"
                      required
                      value={form.ticket_number}
                      onChange={(e) => setForm((f) => ({ ...f, ticket_number: e.target.value }))}
                      placeholder="e.g. PROJ-123"
                      className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                      Title
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Brief summary of this ticket"
                      className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%235f7a6e%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Description (optional)
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Details about this task..."
                className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || (!manualMode && !form.ticket_number)}
              className="btn-press rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 cursor-pointer transition-transform"
            >
              {submitting ? "Adding..." : "Add Ticket"}
            </button>
          </form>
        </div>

        {/* Task list */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border">
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">
              All Tickets ({displayed.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <div className="w-5 h-5 rounded bg-muted/30 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
                      <div className="h-3 w-48 bg-muted/30 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : displayed.length === 0 ? (
            <div className="p-8">
              <EmptyState
                type="tasks"
                title="No tickets yet"
                description="Add your first ticket to start tracking your work. Tickets help you stay organized and update your standup."
                action={
                  <p className="text-sm text-muted">
                    Use the form above to add a ticket.
                  </p>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-card-border/50">
              {displayed.map((ticket) => {
                const statusOpt = STATUS_OPTIONS.find((s) => s.value === ticket.status) || STATUS_OPTIONS[0];
                const isEditing = editingId === ticket.id;

                return (
                  <div
                    key={ticket.id}
                    className="px-6 py-4 hover:bg-primary-light/10 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-muted uppercase mb-1">
                              Ticket Number
                            </label>
                            <input
                              type="text"
                              value={editForm.ticket_number || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, ticket_number: e.target.value }))
                              }
                              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted uppercase mb-1">
                              Due Date
                            </label>
                            <input
                              type="date"
                              value={editForm.due_date || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, due_date: e.target.value }))
                              }
                              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted uppercase mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            value={editForm.title || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, title: e.target.value }))
                            }
                            placeholder="Brief summary of this ticket"
                            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted uppercase mb-1">
                            Status
                          </label>
                          <select
                            value={editForm.status || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, status: e.target.value }))
                            }
                            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%235f7a6e%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted uppercase mb-1">
                            Description
                          </label>
                          <textarea
                            rows={2}
                            value={editForm.description || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, description: e.target.value }))
                            }
                            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 rounded-lg border border-card-border text-sm font-semibold text-muted hover:bg-background cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 cursor-pointer"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                        <div className="space-y-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{ticket.ticket_number}</p>
                            {ticket.title && (
                              <span className="text-sm text-foreground/70">&mdash; {ticket.title}</span>
                            )}
                            {ticket.due_date && (
                              <span className="text-xs text-muted">
                                Due: {formatDate(ticket.due_date)}
                              </span>
                            )}
                          </div>
                          {ticket.description && (
                            <p className="text-sm text-muted mt-1 whitespace-pre-wrap">
                              {ticket.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <select
                            value={ticket.status}
                            onChange={(e) => handleStatusChange(ticket, e.target.value)}
                            className={`rounded-lg border px-3 py-2 text-xs font-semibold appearance-none cursor-pointer pr-8 min-w-[130px] outline-none focus:ring-2 focus:ring-primary/20 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22currentColor%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat ${statusOpt.color}`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-muted">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex gap-1 ml-auto sm:ml-0">
                            <button
                              onClick={() => startEdit(ticket)}
                              className="px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-light rounded cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(ticket.id)}
                              className="btn-press px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded cursor-pointer transition-transform"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
