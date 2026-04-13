"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import DatePicker from "@/components/DatePicker";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";

const toLocalYMD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const STATUS_OPTIONS = [
  { value: "to_be_done", label: "To Be Done", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "closed", label: "Closed", color: "bg-green-100 text-green-700 border-green-200" },
];

const POLL_INTERVAL_MS = 5000;

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCreatedDate(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ACTION_LABELS = {
  created: { label: "Created", color: "text-green-700 bg-green-50 border-green-200" },
  updated: { label: "Updated", color: "text-blue-700 bg-blue-50 border-blue-200" },
  status_changed: { label: "Status Changed", color: "text-purple-700 bg-purple-50 border-purple-200" },
  deleted: { label: "Deleted", color: "text-red-700 bg-red-50 border-red-200" },
};

function ChangeItem({ field, oldVal, newVal }) {
  const fieldLabels = {
    due_date: "Due Date",
    status: "Status",
    ticket_number: "Ticket #",
    description: "Description",
  };
  const label = fieldLabels[field] || field;

  const format = (val) => {
    if (val === null || val === undefined) return "—";
    if (field === "due_date") return formatDate(val);
    if (field === "status") {
      const opt = STATUS_OPTIONS.find((s) => s.value === val);
      return opt ? opt.label : val;
    }
    return String(val);
  };

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="font-semibold text-muted w-20 shrink-0">{label}</span>
      <span className="text-red-500 line-through">{format(oldVal)}</span>
      <svg className="w-3 h-3 text-muted shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span className="text-green-600 font-medium">{format(newVal)}</span>
    </div>
  );
}

function TicketCard({ ticket }) {
  const [expanded, setExpanded] = useState(false);
  const [auditLogs, setAuditLogs] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === ticket.status) || STATUS_OPTIONS[0];

  const fetchAuditLogs = async () => {
    if (auditLogs) return;
    setAuditLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/admin/audit?entity_type=ticket&entity_id=${ticket.id}&limit=50`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) fetchAuditLogs();
    setExpanded((prev) => !prev);
  };

  return (
    <div className="rounded-xl bg-background border border-card-border overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full text-left flex flex-wrap items-start justify-between gap-3 py-3 px-4 cursor-pointer hover:bg-primary-light/5 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground text-[15px]">
            {ticket.ticket_number}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            {ticket.created_at && (
              <span className="inline-flex items-center gap-1 text-xs text-muted/80">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Created: {formatCreatedDate(ticket.created_at)}
              </span>
            )}
            {ticket.due_date && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Due: {formatDate(ticket.due_date)}
              </span>
            )}
          </div>
          {ticket.description && (
            <p className="text-sm text-foreground/70 mt-2 whitespace-pre-wrap line-clamp-2 leading-relaxed border-l-2 border-accent/30 pl-2.5">
              {ticket.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${statusOpt.color}`}>
            {statusOpt.label}
          </span>
          <svg
            className={`w-4 h-4 text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 pt-1 border-t border-card-border/50">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">Activity Log</p>
          </div>

          {auditLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted">Loading history...</span>
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <div className="relative pl-4 space-y-0">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-card-border" />
              {auditLogs.map((log, i) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "text-gray-700 bg-gray-50 border-gray-200" };
                const changes = log.changes || {};
                const changeKeys = Object.keys(changes);

                return (
                  <div key={log.id || i} className="relative pb-3 last:pb-0">
                    <div className="absolute -left-[9px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-card bg-accent-light ring-2 ring-card" />
                    <div className="ml-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                        <span className="text-[11px] text-muted">
                          by {log.actor_name || "Unknown"}
                        </span>
                        <span className="text-[10px] text-muted/70">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>
                      {changeKeys.length > 0 && (
                        <div className="mt-1.5 space-y-1 bg-card/50 rounded-lg p-2 border border-card-border/50">
                          {changeKeys.map((key) => (
                            <ChangeItem
                              key={key}
                              field={key}
                              oldVal={changes[key].old}
                              newVal={changes[key].new}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted py-2">No activity recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ url, name }) {
  if (url) {
    return (
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-card-border shrink-0 aspect-square">
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover object-center"
        />
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center border-2 border-card-border shrink-0">
      <span className="text-base font-bold text-accent">
        {(name || "?").charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export default function AdminTicketsPage() {
  const { user, loading: authLoading } = useAuth({
    allowedRoles: ["super_admin"],
  });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => toLocalYMD());
  const prevTicketsRef = useRef(null);

  const fetchTickets = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const dateParam = selectedDate === toLocalYMD() ? "today" : selectedDate;
      const res = await fetch(`/api/admin/tickets?date=${dateParam}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const incoming = data.tickets || [];

      const prevHash = JSON.stringify(prevTicketsRef.current);
      const newHash = JSON.stringify(incoming);
      if (prevHash !== newHash) {
        prevTicketsRef.current = incoming;
        setTickets(incoming);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchTickets();
    }
  }, [user, fetchTickets]);

  // Supabase Realtime subscription for instant updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("admin-tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => fetchTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTickets]);

  // Polling fallback to guarantee live updates
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchTickets, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchTickets]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const groupedByUser = tickets.reduce((acc, t) => {
    const id = t.user_id;
    if (!acc[id]) {
      acc[id] = {
        user_id: id,
        user_name: t.user_name,
        user_email: t.user_email,
        user_avatar_url: t.user_avatar_url,
        user_teams: t.user_teams || [],
        tickets: [],
      };
    }
    acc[id].tickets.push(t);
    return acc;
  }, {});

  const userList = Object.values(groupedByUser);

  const filteredUsers =
    selectedTeam === "all"
      ? userList
      : userList.filter((u) => (u.user_teams || []).includes(selectedTeam));

  const byTeam = {};
  const noTeamUsers = [];

  filteredUsers.forEach((u) => {
    const teams = u.user_teams || [];
    if (teams.length === 0) {
      noTeamUsers.push(u);
      return;
    }
    const firstTeam = TEAMS.find((t) => teams.includes(t.id))?.id;
    if (firstTeam) {
      if (!byTeam[firstTeam]) byTeam[firstTeam] = [];
      byTeam[firstTeam].push(u);
    } else {
      noTeamUsers.push(u);
    }
  });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-accent">All Tickets</h1>
            <p className="text-sm text-muted mt-1">
              {selectedDate === toLocalYMD()
                ? "Today"
                : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
              {" "}&middot; {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} with tickets
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 0V3m0 4h-4a2 2 0 00-2 2v1m6-3h4a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h4m0 0V5" />
            </svg>
          </div>
        </div>

        <div className="relative z-10 space-y-3">
          <DatePicker value={selectedDate} onChange={setSelectedDate} />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTeam("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                selectedTeam === "all"
                  ? "bg-accent text-white border-accent"
                  : "bg-card border-card-border text-muted hover:bg-background"
              }`}
            >
              All
            </button>
            {TEAMS.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                  selectedTeam === team.id ? team.color : "bg-card border-card-border text-muted hover:bg-background"
                }`}
              >
                {team.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted mt-3">Loading tickets...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-card rounded-2xl border border-card-border p-12 text-center">
            <p className="text-muted">
              {selectedTeam === "all"
                ? "No tickets found."
                : "No users with tickets in this team."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {TEAMS.map((team) => {
              const users = byTeam[team.id] || [];
              if (users.length === 0) return null;

              return (
                <div
                  key={team.id}
                  className="bg-card rounded-2xl border border-card-border overflow-hidden"
                >
                  <div
                    className={`px-6 py-4 border-b border-card-border ${getTeamColor(
                      team.id
                    )}`}
                  >
                    <h2 className="text-lg font-bold">
                      {getTeamLabel(team.id)}
                    </h2>
                    <p className="text-sm opacity-80 mt-0.5">
                      {users.length} user{users.length !== 1 ? "s" : ""} with
                      tickets
                    </p>
                  </div>
                  <div className="divide-y divide-card-border/50">
                    {users.map((u) => (
                      <div
                        key={u.user_id}
                        className="p-4 sm:p-6 hover:bg-primary-light/5 transition-colors"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <UserAvatar
                            url={u.user_avatar_url}
                            name={u.user_name}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {u.user_name || "Unknown"}
                            </p>
                            <p className="text-sm text-muted truncate">{u.user_email}</p>
                            {(u.user_teams || []).length > 1 && (
                              <div className="flex gap-1.5 mt-1 flex-wrap">
                                {(u.user_teams || [])
                                  .filter((t) => t !== team.id)
                                  .map((tid) => (
                                    <span
                                      key={tid}
                                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getTeamColor(
                                        tid
                                      )}`}
                                    >
                                      {getTeamLabel(tid)}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pl-0 sm:pl-16 space-y-2 mt-3 sm:mt-0">
                          {u.tickets.map((ticket) => (
                            <TicketCard key={ticket.id} ticket={ticket} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {noTeamUsers.length > 0 && (
              <div className="bg-card rounded-2xl border border-card-border overflow-hidden">
                <div className="px-6 py-4 border-b border-card-border bg-gray-100 text-gray-700">
                  <h2 className="text-lg font-bold">No Team</h2>
                  <p className="text-sm opacity-80 mt-0.5">
                    {noTeamUsers.length} user
                    {noTeamUsers.length !== 1 ? "s" : ""} with tickets
                  </p>
                </div>
                <div className="divide-y divide-card-border/50">
                  {noTeamUsers.map((u) => (
                    <div
                      key={u.user_id}
                      className="p-4 sm:p-6 hover:bg-primary-light/5 transition-colors"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <UserAvatar
                          url={u.user_avatar_url}
                          name={u.user_name}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {u.user_name || "Unknown"}
                          </p>
                          <p className="text-sm text-muted truncate">{u.user_email}</p>
                        </div>
                      </div>
                      <div className="pl-0 sm:pl-16 space-y-2">
                        {u.tickets.map((ticket) => (
                          <TicketCard key={ticket.id} ticket={ticket} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
