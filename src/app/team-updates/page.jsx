"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { TEAMS } from "@/lib/teams";
import Navbar from "@/components/Navbar";

const MOODS = {
  great: { emoji: "😊", label: "Great", color: "bg-green-100 text-green-700" },
  good: { emoji: "🙂", label: "Good", color: "bg-primary-light text-primary-dark" },
  okay: { emoji: "😐", label: "Okay", color: "bg-amber-100 text-amber-700" },
  struggling: { emoji: "😟", label: "Struggling", color: "bg-orange-100 text-orange-700" },
  blocked: { emoji: "😤", label: "Blocked", color: "bg-red-100 text-red-700" },
};

function StandupCard({ standup }) {
  const moodData = MOODS[standup.mood] || MOODS.good;
  return (
    <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-card-border bg-background/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent-light flex items-center justify-center text-sm font-bold text-accent">
            {(standup.employee_name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              {standup.employee_name || "Unknown"}
            </p>
            <p className="text-xs text-muted">
              {new Date(standup.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{moodData.emoji}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${moodData.color}`}
          >
            {moodData.label}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold text-primary-dark mb-1">Yesterday</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {standup.yesterday}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-accent mb-1">Today</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {standup.today}
          </p>
        </div>
        {standup.blockers && standup.blockers.trim() && (
          <div>
            <p className="text-xs font-semibold text-danger mb-1">Blockers</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {standup.blockers}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamUpdatesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [standups, setStandups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");

  const isLeader = role === "super_admin" || role === "scrum_master";

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const url = isLeader
        ? "/api/standup?date=today&include=teams"
        : "/api/standup?date=today";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setStandups(data.standups || []);
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

  const displayed =
    isLeader && selectedTeam !== "all"
      ? standups.filter((s) => (s.teams || []).includes(selectedTeam))
      : standups;

  const displayedMoodSummary = displayed.reduce((acc, s) => {
    const m = s.mood || "good";
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  const displayedBlockerCount = displayed.filter(
    (s) => s.blockers?.trim()
  ).length;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-accent">
              Today&apos;s Team Updates
            </h1>
            <p className="text-sm text-muted mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              &middot; {displayed.length} update
              {displayed.length !== 1 && "s"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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

        {/* Mood Summary for current selection */}
        {displayed.length > 0 && (
          <div className="bg-card rounded-xl border border-card-border shadow-sm p-5">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              {isLeader && selectedTeam !== "all"
                ? `${TEAMS.find((t) => t.id === selectedTeam)?.label || selectedTeam} Mood`
                : "Team Mood"}
            </h3>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(displayedMoodSummary).map(([mood, count]) => {
                const m = MOODS[mood] || MOODS.good;
                return (
                  <div
                    key={mood}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${m.color}`}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span className="text-sm font-bold">{count}</span>
                    <span className="text-xs font-medium">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Blocker Alert */}
        {displayedBlockerCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-800">
              {displayedBlockerCount} team member
              {displayedBlockerCount !== 1 && "s"} reported blockers today
            </p>
          </div>
        )}

        {/* Standup Cards */}
        {displayed.length === 0 ? (
          <div className="bg-card rounded-2xl border border-card-border shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              No updates yet{isLeader && selectedTeam !== "all" ? " for this team" : " today"}
            </h3>
            <p className="text-sm text-muted">
              {isLeader && selectedTeam !== "all"
                ? "No members from this team have submitted their standup yet."
                : "Team members haven\u0027t submitted their standups yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((standup) => (
              <StandupCard key={standup.id} standup={standup} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
