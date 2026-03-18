"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";

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
  const prevTicketsRef = useRef(null);

  const fetchTickets = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/admin/tickets", {
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
  }, []);

  useEffect(() => {
    if (user) fetchTickets();
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-accent">All Tickets</h1>
            <p className="text-sm text-muted mt-1">
              View all tickets across all users, organized by team
            </p>
          </div>
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
                        className="p-6 hover:bg-primary-light/5 transition-colors"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <UserAvatar
                            url={u.user_avatar_url}
                            name={u.user_name}
                          />
                          <div>
                            <p className="font-semibold text-foreground">
                              {u.user_name || "Unknown"}
                            </p>
                            <p className="text-sm text-muted">{u.user_email}</p>
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

                        <div className="pl-16 space-y-2">
                          {u.tickets.map((ticket) => {
                            const statusOpt =
                              STATUS_OPTIONS.find(
                                (s) => s.value === ticket.status
                              ) || STATUS_OPTIONS[0];
                            return (
                              <div
                                key={ticket.id}
                                className="flex flex-wrap items-start justify-between gap-3 py-3 px-4 rounded-xl bg-background border border-card-border"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground">
                                    {ticket.ticket_number}
                                  </p>
                                  {ticket.due_date && (
                                    <span className="text-xs text-muted">
                                      Due: {formatDate(ticket.due_date)}
                                    </span>
                                  )}
                                  {ticket.description && (
                                    <p className="text-sm text-muted mt-1 whitespace-pre-wrap line-clamp-2">
                                      {ticket.description}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${statusOpt.color}`}
                                >
                                  {statusOpt.label}
                                </span>
                              </div>
                            );
                          })}
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
                      className="p-6 hover:bg-primary-light/5 transition-colors"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <UserAvatar
                          url={u.user_avatar_url}
                          name={u.user_name}
                        />
                        <div>
                          <p className="font-semibold text-foreground">
                            {u.user_name || "Unknown"}
                          </p>
                          <p className="text-sm text-muted">{u.user_email}</p>
                        </div>
                      </div>
                      <div className="pl-16 space-y-2">
                        {u.tickets.map((ticket) => {
                          const statusOpt =
                            STATUS_OPTIONS.find(
                              (s) => s.value === ticket.status
                            ) || STATUS_OPTIONS[0];
                          return (
                            <div
                              key={ticket.id}
                              className="flex flex-wrap items-start justify-between gap-3 py-3 px-4 rounded-xl bg-background border border-card-border"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">
                                  {ticket.ticket_number}
                                </p>
                                {ticket.due_date && (
                                  <span className="text-xs text-muted">
                                    Due: {formatDate(ticket.due_date)}
                                  </span>
                                )}
                                {ticket.description && (
                                  <p className="text-sm text-muted mt-1 whitespace-pre-wrap line-clamp-2">
                                    {ticket.description}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${statusOpt.color}`}
                              >
                                {statusOpt.label}
                              </span>
                            </div>
                          );
                        })}
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
