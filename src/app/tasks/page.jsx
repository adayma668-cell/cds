"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

const STATUS_OPTIONS = [
  { value: "to_be_done", label: "To Be Done", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "closed", label: "Closed", color: "bg-green-100 text-green-700 border-green-200" },
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
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    ticket_number: "",
    due_date: "",
    status: "to_be_done",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchTickets = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const url = filter === "all" ? "/api/tickets" : `/api/tickets?status=${filter}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const data = await res.json();
    setTickets(data.tickets || []);
    setLoading(false);
  }, [filter]);

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
      setForm({ ticket_number: "", due_date: "", status: "to_be_done", description: "" });
      fetchTickets();
    }
    setSubmitting(false);
  };

  const startEdit = (ticket) => {
    setEditingId(ticket.id);
    setEditForm({
      ticket_number: ticket.ticket_number,
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTickets();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this ticket?")) return;
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
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
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-accent">My Tasks</h1>
            <p className="text-sm text-muted mt-1">
              Add tickets and track status. Update at end of day.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {STATUS_OPTIONS.map((s) => (
            <div
              key={s.value}
              onClick={() => setFilter(filter === s.value ? "all" : s.value)}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                filter === s.value ? s.color : "bg-card border-card-border hover:bg-background"
              }`}
            >
              <p className="text-2xl font-bold">{statusCounts[s.value]}</p>
              <p className={`text-xs font-semibold mt-0.5 ${filter === s.value ? "" : "text-muted"}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Add form */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-6">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
            Add New Ticket
          </h2>
          <form onSubmit={handleAdd} className="space-y-4">
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
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Status
              </label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s.value }))}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      form.status === s.value ? s.color : "border-card-border bg-card text-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
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
              disabled={submitting}
              className="rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 cursor-pointer"
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
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted">
              No tickets yet. Add your first ticket above.
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
                            Status
                          </label>
                          <div className="flex gap-2">
                            {STATUS_OPTIONS.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                onClick={() => setEditForm((f) => ({ ...f, status: s.value }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  editForm.status === s.value ? s.color : "border-card-border"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
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
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{ticket.ticket_number}</p>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusOpt.color}`}
                            >
                              {statusOpt.label}
                            </span>
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
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <div className="flex gap-1">
                            {STATUS_OPTIONS.filter((s) => s.value !== ticket.status).map((s) => (
                              <button
                                key={s.value}
                                onClick={() => handleStatusChange(ticket, s.value)}
                                className={`px-2 py-1 text-xs font-semibold rounded cursor-pointer border hover:opacity-90 ${s.color}`}
                              >
                                → {s.label}
                              </button>
                            ))}
                          </div>
                          <span className="text-xs text-muted">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(ticket)}
                              className="px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-light rounded cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(ticket.id)}
                              className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded cursor-pointer"
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
      </main>
    </div>
  );
}
