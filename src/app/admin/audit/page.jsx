"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const ENTITY_TYPES = [
  { value: "", label: "All Types" },
  { value: "meeting", label: "Meetings" },
  { value: "standup", label: "Standups" },
  { value: "retro_session", label: "Retro Sessions" },
  { value: "retro_item", label: "Retro Items" },
  { value: "retro_mood", label: "Retro Moods" },
  { value: "retro_vote", label: "Retro Votes" },
];

const ACTION_COLORS = {
  created: "bg-emerald-100 text-emerald-700",
  submitted: "bg-emerald-100 text-emerald-700",
  started: "bg-emerald-100 text-emerald-700",
  cast: "bg-emerald-100 text-emerald-700",
  updated: "bg-blue-100 text-blue-700",
  status_changed: "bg-amber-100 text-amber-700",
  phase_changed: "bg-amber-100 text-amber-700",
  changed: "bg-amber-100 text-amber-700",
  completed: "bg-primary-light text-primary-dark",
  reopened: "bg-orange-100 text-orange-700",
  finished: "bg-indigo-100 text-indigo-700",
  deleted: "bg-red-100 text-red-700",
  removed: "bg-red-100 text-red-700",
  cleared_all: "bg-red-100 text-red-700",
};

const ENTITY_ICONS = {
  meeting: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  ticket: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  standup: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  retro_session: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  retro_item: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
  retro_mood: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  retro_vote: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
};

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEntityType(type) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ChangesDetail({ changes, oldData, newData, action }) {
  if (changes && Object.keys(changes).length > 0) {
    return (
      <div className="mt-2 space-y-1">
        {Object.entries(changes).map(([key, val]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="font-medium text-muted min-w-[80px]">{key}:</span>
            <span className="text-red-500 line-through break-all">
              {val.old !== null && val.old !== undefined ? String(val.old) : "—"}
            </span>
            <svg className="w-3 h-3 text-muted flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-emerald-600 break-all">
              {val.new !== null && val.new !== undefined ? String(val.new) : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (action === "created" || action === "submitted" || action === "started") {
    const data = newData;
    if (!data) return null;
    const preview = Object.entries(data)
      .filter(([k]) => !["id", "user_id", "created_at", "updated_at", "avatar_url"].includes(k))
      .slice(0, 4);
    if (preview.length === 0) return null;
    return (
      <div className="mt-2 space-y-0.5">
        {preview.map(([key, val]) => (
          <div key={key} className="text-xs text-muted">
            <span className="font-medium">{key}:</span>{" "}
            <span className="text-foreground/70">{val !== null && val !== undefined ? String(val).slice(0, 80) : "—"}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default function AuditLogPage() {
  const { user, role, loading } = useAuth({ allowedRoles: ["super_admin"] });
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    const token = await getToken();
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (entityType) params.set("entity_type", entityType);

    const res = await fetch(`/api/admin/audit?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.logs) {
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    }
    setLoadingLogs(false);
  }, [page, entityType]);

  useEffect(() => {
    if (user) fetchLogs();
  }, [user, fetchLogs]);

  const handleFilterChange = (type) => {
    setEntityType(type);
    setPage(1);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-card-border" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (role !== "super_admin") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted text-sm">Access denied. Super admin only.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-primary/15 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Audit Trail
            </h1>
            <p className="text-sm text-muted mt-1">
              {total} total event{total !== 1 ? "s" : ""} tracked across the application
            </p>
          </div>

          <button
            onClick={fetchLogs}
            className="self-start flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted hover:text-foreground bg-card border border-card-border rounded-xl hover:shadow-sm transition-all shrink-0"
          >
            <svg className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {ENTITY_TYPES.map((et) => (
            <button
              key={et.value}
              onClick={() => handleFilterChange(et.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                entityType === et.value
                  ? "bg-accent text-white border-accent shadow-sm"
                  : "bg-card text-muted border-card-border hover:bg-background hover:text-foreground"
              }`}
            >
              {et.label}
            </button>
          ))}
        </div>

        {/* Log entries */}
        {loadingLogs ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-card-border" />
              <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
            <p className="text-muted text-sm">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-card-border/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-muted text-sm font-medium">No audit logs yet</p>
            <p className="text-muted/70 text-xs mt-1">Events will appear here as users interact with the app</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
            <div className="divide-y divide-card-border/60">
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <div
                    key={log.id}
                    className="hover:bg-background/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="px-4 sm:px-5 py-3.5 flex items-start gap-3 sm:gap-4">
                      {/* Entity icon */}
                      <div className="mt-0.5 w-8 h-8 rounded-lg bg-gradient-to-br from-accent/10 to-primary/10 flex items-center justify-center text-accent flex-shrink-0">
                        {ENTITY_ICONS[log.entity_type] || (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {log.actor_name || "System"}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted">
                            {formatEntityType(log.entity_type)}
                          </span>
                        </div>

                        {/* Inline preview of key data */}
                        {log.action === "status_changed" && log.changes?.status && (
                          <p className="text-xs text-muted mt-1">
                            {log.changes.status.old?.replace(/_/g, " ")} → <span className="font-medium text-foreground/80">{log.changes.status.new?.replace(/_/g, " ")}</span>
                          </p>
                        )}
                        {log.action === "phase_changed" && log.metadata && (
                          <p className="text-xs text-muted mt-1">
                            Phase {log.metadata.from_phase} → <span className="font-medium text-foreground/80">Phase {log.metadata.to_phase}</span>
                          </p>
                        )}
                        {log.entity_type === "meeting" && log.action === "completed" && log.metadata && (
                          <p className="text-xs text-muted mt-1">
                            {log.metadata.memberCount && <span>{log.metadata.memberCount} members</span>}
                            {log.metadata.team && <span> &middot; Team: <span className="font-medium text-foreground/80">{log.metadata.team}</span></span>}
                          </p>
                        )}
                        {(log.new_data?.ticket_number || log.old_data?.ticket_number) && (
                          <p className="text-xs text-muted mt-0.5">
                            Ticket: <span className="font-mono text-foreground/70">{log.new_data?.ticket_number || log.old_data?.ticket_number}</span>
                          </p>
                        )}
                        {(log.new_data?.content || log.old_data?.content) && (
                          <p className="text-xs text-muted mt-0.5 truncate max-w-md">
                            &quot;{(log.new_data?.content || log.old_data?.content)?.slice(0, 80)}&quot;
                          </p>
                        )}

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 p-3 bg-background/80 border border-card-border/50 rounded-xl text-xs space-y-2 overflow-x-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-muted">
                              <span>Entity ID:</span>
                              <span className="font-mono text-foreground/70 break-all">{log.entity_id}</span>
                              <span>Actor ID:</span>
                              <span className="font-mono text-foreground/70 break-all">{log.actor_id || "—"}</span>
                              <span>Timestamp:</span>
                              <span className="text-foreground/70">{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                            <ChangesDetail
                              changes={log.changes}
                              oldData={log.old_data}
                              newData={log.new_data}
                              action={log.action}
                            />
                            {log.metadata && (
                              <div>
                                <span className="font-medium text-muted">Metadata:</span>
                                <pre className="mt-1 p-2 bg-card rounded-lg text-[11px] text-foreground/70 overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="text-xs text-muted whitespace-nowrap flex-shrink-0 hidden sm:flex items-center gap-1.5">
                        <span>{formatDate(log.created_at)}</span>
                        <svg
                          className={`w-3.5 h-3.5 text-card-border transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 bg-background/30 border-t border-card-border/50">
                <span className="text-xs text-muted">
                  Page {page} of {totalPages} ({total} events)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border bg-card text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border bg-card text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
