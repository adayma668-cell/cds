"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";

const ALLOWED_ROLES = ["scrum_master"];
const TIMER_SECONDS = 120;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Timer({ seconds, isRunning, isWarning }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / TIMER_SECONDS;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-card-border"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-1000 ease-linear ${
            isWarning ? "text-danger" : "text-primary"
          }`}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-2xl font-bold tabular-nums ${
            isWarning ? "text-danger" : "text-foreground"
          }`}
        >
          {formatTime(seconds)}
        </span>
        <span className="text-[10px] text-muted uppercase tracking-wider mt-0.5">
          {isRunning ? "Speaking" : seconds === TIMER_SECONDS ? "Ready" : "Paused"}
        </span>
      </div>
    </div>
  );
}

export default function StartMeeting() {
  const { user, loading: authLoading } = useAuth({ allowedRoles: ALLOWED_ROLES });

  const [phase, setPhase] = useState("lobby");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seconds, setSeconds] = useState(TIMER_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const [submittedAll, setSubmittedAll] = useState([]);
  const [pendingAll, setPendingAll] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch("/api/meeting", {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load meeting data");
        }

        const data = await res.json();
        setSubmittedAll(data.submitted || []);
        setPendingAll(data.pending || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setDataLoading(false);
      }
    })();
  }, [authLoading, user]);

  const filteredStandups =
    selectedTeam === "all"
      ? submittedAll
      : submittedAll.filter((m) => (m.teams || []).includes(selectedTeam));

  const filteredPending =
    selectedTeam === "all"
      ? pendingAll
      : pendingAll.filter((m) => (m.teams || []).includes(selectedTeam));

  const currentMember = filteredStandups[currentIndex];
  const totalMembers = filteredStandups.length;
  const totalAll = totalMembers + filteredPending.length;
  const isWarning = seconds <= 30 && seconds > 0;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return clearTimer;
  }, [isRunning, clearTimer]);

  const startMeeting = () => {
    if (filteredStandups.length === 0) return;
    setPhase("active");
    setCurrentIndex(0);
    setSeconds(TIMER_SECONDS);
    setIsRunning(true);
  };

  const handleNext = () => {
    clearTimer();
    if (currentIndex < totalMembers - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSeconds(TIMER_SECONDS);
      setIsRunning(true);
    } else {
      setPhase("completed");
      setIsRunning(false);
    }
  };

  const handlePauseResume = () => {
    if (seconds === 0) return;
    setIsRunning((prev) => !prev);
  };

  const handleRestart = () => {
    setPhase("lobby");
    setCurrentIndex(0);
    setSeconds(TIMER_SECONDS);
    setIsRunning(false);
    clearTimer();
  };

  const handleRefresh = async () => {
    setDataLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/meeting", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load meeting data");
      }
      const data = await res.json();
      setSubmittedAll(data.submitted || []);
      setPendingAll(data.pending || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">Loading meeting data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-foreground">Failed to load</h2>
          <p className="text-sm text-muted">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <div className="space-y-8">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-accent">
                Standup Meeting
              </h1>
              <p className="text-sm text-muted">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                &middot; Select a team and start the standup
              </p>
            </div>

            {/* Team Filter */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setSelectedTeam("all")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  selectedTeam === "all"
                    ? "bg-accent text-white border-accent"
                    : "bg-card text-muted border-card-border hover:bg-background"
                }`}
              >
                All Teams ({submittedAll.length})
              </button>
              {TEAMS.map((team) => {
                const count = submittedAll.filter((m) =>
                  (m.teams || []).includes(team.id)
                ).length;
                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      selectedTeam === team.id
                        ? team.color
                        : "bg-card text-muted border-card-border hover:bg-background"
                    }`}
                  >
                    {team.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Submission Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-xl border border-card-border p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{totalAll}</p>
                <p className="text-xs text-muted mt-0.5">Total Members</p>
              </div>
              <div className="bg-primary-light/50 rounded-xl border border-primary/10 p-4 text-center">
                <p className="text-2xl font-bold text-primary-dark">
                  {totalMembers}
                </p>
                <p className="text-xs text-primary-dark/70 mt-0.5">Submitted</p>
              </div>
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {filteredPending.length}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Pending</p>
              </div>
            </div>

            {/* Pending Members */}
            {filteredPending.length > 0 && (
              <div className="bg-card rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-200 bg-amber-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider">
                      Pending Submissions
                    </h2>
                  </div>
                  <span className="text-xs text-amber-600 font-medium">
                    {filteredPending.length} remaining
                  </span>
                </div>
                <div className="divide-y divide-amber-100">
                  {filteredPending.map((member) => (
                    <div
                      key={member.id}
                      className="px-6 py-3.5 flex items-center gap-4"
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-amber-700">
                          {(member.name || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted truncate">
                            {member.email}
                          </p>
                          {(member.teams || []).map((t) => (
                            <span
                              key={t}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${getTeamColor(
                                t
                              )}`}
                            >
                              {getTeamLabel(t)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                        NOT SUBMITTED
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submitted - Ready for Meeting */}
            <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-card-border bg-primary-light/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-primary-dark uppercase tracking-wider">
                    Submitted &mdash; Ready
                  </h2>
                </div>
                <span className="text-xs text-primary-dark/70">
                  {totalMembers} member{totalMembers !== 1 ? "s" : ""}
                </span>
              </div>
              {filteredStandups.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted">
                  No submissions yet for{" "}
                  {selectedTeam === "all" ? "any team" : getTeamLabel(selectedTeam)}
                </div>
              ) : (
                <div className="divide-y divide-card-border/50">
                  {filteredStandups.map((member) => (
                    <div
                      key={member.id}
                      className="px-6 py-3.5 flex items-center gap-4"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary-dark">
                          {(member.name || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted truncate">
                            {member.email}
                          </p>
                          {(member.teams || []).map((t) => (
                            <span
                              key={t}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${getTeamColor(
                                t
                              )}`}
                            >
                              {getTeamLabel(t)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-light text-primary-dark border border-primary/20 shrink-0">
                        SUBMITTED
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                className="rounded-xl border border-card-border bg-card text-muted py-3.5 px-5 text-sm font-semibold hover:bg-background transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 inline-block mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={startMeeting}
                disabled={filteredStandups.length === 0}
                className="flex-1 rounded-xl bg-accent text-white py-3.5 text-sm font-semibold hover:bg-accent-dark transition-colors shadow-lg shadow-accent/20 cursor-pointer disabled:opacity-50"
              >
                Start Meeting ({totalMembers} submitted member{totalMembers !== 1 ? "s" : ""})
              </button>
            </div>
          </div>
        )}

        {/* ── ACTIVE MEETING ── */}
        {phase === "active" && currentMember && (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  Member {currentIndex + 1} of {totalMembers}
                </span>
                <span>
                  {Math.round(((currentIndex + 1) / totalMembers) * 100)}%
                  complete
                </span>
              </div>
              <div className="w-full h-2 bg-card-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${((currentIndex + 1) / totalMembers) * 100}%`,
                  }}
                />
              </div>

              {/* Member Dots */}
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {filteredStandups.map((m, i) => (
                  <div
                    key={m.id}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i === currentIndex
                        ? "bg-primary text-white scale-110 shadow-md shadow-primary/30"
                        : i < currentIndex
                        ? "bg-primary-light text-primary-dark"
                        : "bg-card-border text-muted"
                    }`}
                  >
                    {(m.name || "?").charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Member Card */}
            <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
              <div className="px-6 sm:px-8 py-6 border-b border-card-border bg-accent-light/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center">
                    <span className="text-lg font-bold text-accent">
                      {(currentMember.name || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {currentMember.name}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <p className="text-sm text-muted">{currentMember.email}</p>
                      {(currentMember.teams || []).map((t) => (
                        <span
                          key={t}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${getTeamColor(t)}`}
                        >
                          {getTeamLabel(t)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <Timer
                  seconds={seconds}
                  isRunning={isRunning}
                  isWarning={isWarning}
                />
              </div>

              {/* Standup Content */}
              <div className="p-6 sm:p-8 space-y-4">
                {(currentMember.ticket_number || currentMember.due_date) && (
                  <div className="rounded-xl bg-background border border-card-border p-4 flex flex-wrap gap-6">
                    {currentMember.ticket_number && (
                      <div>
                        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                          Ticket
                        </p>
                        <p className="text-sm font-medium text-foreground">{currentMember.ticket_number}</p>
                      </div>
                    )}
                    {currentMember.due_date && (
                      <div>
                        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                          Due Date
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(currentMember.due_date + "T12:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-xl bg-primary-light/50 border border-primary/10 p-4">
                  <p className="text-xs font-semibold text-primary-dark uppercase tracking-wide mb-1.5">
                    Yesterday
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {currentMember.yesterday}
                  </p>
                </div>

                <div className="rounded-xl bg-accent-light/50 border border-accent/10 p-4">
                  <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">
                    Today
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {currentMember.today}
                  </p>
                </div>

                {currentMember.blockers && currentMember.blockers.trim() && (
                  <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
                    <p className="text-xs font-semibold text-danger uppercase tracking-wide mb-1.5">
                      Blockers
                    </p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {currentMember.blockers}
                    </p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="px-6 sm:px-8 py-5 border-t border-card-border bg-background/50 flex items-center gap-3">
                <button
                  onClick={handlePauseResume}
                  disabled={seconds === 0}
                  className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-card transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {seconds === 0
                    ? "Time's up"
                    : isRunning
                    ? "Pause"
                    : "Resume"}
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors shadow-md shadow-primary/20 cursor-pointer"
                >
                  {currentIndex < totalMembers - 1
                    ? "Next Member"
                    : "Finish Meeting"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLETED ── */}
        {phase === "completed" && (
          <div className="space-y-8">
            <div className="bg-card rounded-2xl border border-card-border shadow-sm p-8 sm:p-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-accent">
                Meeting Complete
              </h1>
              <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
                All {totalMembers} team member{totalMembers !== 1 ? "s" : ""} have
                presented their standup updates. Great job keeping the meeting on
                track!
              </p>
            </div>

            {/* Summary */}
            <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-card-border">
                <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">
                  Meeting Summary
                </h2>
              </div>
              <div className="divide-y divide-card-border/50">
                {filteredStandups.map((member) => (
                  <div key={member.id} className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-dark">
                          {(member.name || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-foreground">
                        {member.name}
                      </p>
                      {(member.teams || []).map((t) => (
                        <span
                          key={t}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${getTeamColor(t)}`}
                        >
                          {getTeamLabel(t)}
                        </span>
                      ))}
                      {member.blockers && member.blockers.trim() && (
                        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-danger border border-red-100">
                          HAS BLOCKERS
                        </span>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 pl-11">
                      <div className="text-xs">
                        <span className="font-semibold text-primary-dark">
                          Today:{" "}
                        </span>
                        <span className="text-muted">
                          {member.today?.length > 80
                            ? member.today.slice(0, 80) + "..."
                            : member.today}
                        </span>
                      </div>
                      {member.blockers && member.blockers.trim() && (
                        <div className="text-xs">
                          <span className="font-semibold text-danger">
                            Blocker:{" "}
                          </span>
                          <span className="text-muted">
                            {member.blockers.length > 80
                              ? member.blockers.slice(0, 80) + "..."
                              : member.blockers}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending reminder */}
            {pendingAll.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-amber-800">
                  {pendingAll.length} member{pendingAll.length !== 1 ? "s" : ""}{" "}
                  still haven&apos;t submitted their standup today
                </p>
              </div>
            )}

            <button
              onClick={handleRestart}
              className="w-full rounded-xl bg-accent text-white py-3.5 text-sm font-semibold hover:bg-accent-dark transition-colors shadow-lg shadow-accent/20 cursor-pointer"
            >
              Start New Meeting
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
