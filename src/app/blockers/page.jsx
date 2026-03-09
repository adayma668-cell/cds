"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { TEAMS } from "@/lib/teams";
import Navbar from "@/components/Navbar";

function BlockerCard({ item, todayStr }) {
  return (
    <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between border-b border-card-border bg-red-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600">
            {(item.employee_name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              {item.employee_name || "Unknown"}
            </p>
            <p className="text-xs text-muted">
              {new Date(item.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              at{" "}
              {new Date(item.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        {new Date(item.created_at).toDateString() === todayStr && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            Today
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {item.blockers}
        </p>
        {item.today && (
          <div className="mt-3 pt-3 border-t border-card-border">
            <p className="text-xs font-semibold text-accent mb-1">Working on</p>
            <p className="text-xs text-muted">{item.today}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlockersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [blockers, setBlockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState("all");

  const isLeader = role === "super_admin" || role === "scrum_master";

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const url = isLeader
        ? "/api/standup?scope=all&include=teams"
        : "/api/standup?scope=all";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      const withBlockers = (data.standups || []).filter(
        (s) => s.blockers && s.blockers.trim().length > 0
      );
      setBlockers(withBlockers);
      setLoading(false);
    })();
  }, [authLoading, user, isLeader]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const todayStr = new Date().toDateString();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  let displayed = blockers;

  if (filter === "today") {
    displayed = displayed.filter(
      (b) => new Date(b.created_at).toDateString() === todayStr
    );
  } else if (filter === "week") {
    displayed = displayed.filter((b) => new Date(b.created_at) >= weekAgo);
  }

  if (isLeader && selectedTeam !== "all") {
    displayed = displayed.filter((b) =>
      (b.teams || []).includes(selectedTeam)
    );
  }

  const uniqueBlockerOwners = [
    ...new Set(displayed.map((b) => b.employee_name)),
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-accent">Blocker Board</h1>
            <p className="text-sm text-muted mt-1">
              {displayed.length} blocker{displayed.length !== 1 && "s"} from{" "}
              {uniqueBlockerOwners.length} team member
              {uniqueBlockerOwners.length !== 1 && "s"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>

        {/* Team Tabs — leaders only */}
        {isLeader && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTeam("all")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                selectedTeam === "all"
                  ? "bg-accent text-white"
                  : "bg-card border border-card-border text-muted hover:text-foreground"
              }`}
            >
              All Teams
            </button>
            {TEAMS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  selectedTeam === t.id
                    ? "bg-accent text-white"
                    : "bg-card border border-card-border text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Time Filter */}
        <div className="flex gap-2">
          {[
            { key: "all", label: "All Time" },
            { key: "week", label: "This Week" },
            { key: "today", label: "Today" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                filter === tab.key
                  ? "bg-primary text-white"
                  : "bg-card border border-card-border text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Blocker Cards */}
        {displayed.length === 0 ? (
          <div className="bg-card rounded-2xl border border-card-border shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">No blockers!</h3>
            <p className="text-sm text-muted">
              {isLeader && selectedTeam !== "all"
                ? "No blockers reported for this team."
                : "Everything looks clear."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((item) => (
              <BlockerCard key={item.id} item={item} todayStr={todayStr} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
