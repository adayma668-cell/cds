"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingChannel } from "@/hooks/useMeetingChannel";
import StandupForm from "@/components/StandupForm";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { getTeamLabel, getTeamColor } from "@/lib/teams";

const TIMER_SECONDS = 120;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ALLOWED_ROLES = ["employee", "scrum_master"];

function TicketEntries({ entries, ticketMap, badgeClass, bgClass }) {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {entries.map((entry, i) => {
        const inlineNumber = entry.ticket_number;
        const inlineTitle = entry.title;
        const t = entry.ticket_id ? ticketMap?.[entry.ticket_id] : null;
        const displayNumber = inlineNumber || t?.ticket_number;
        const displayTitle = inlineTitle || t?.title || t?.description?.split("\n")[0]?.slice(0, 60);
        if (!displayNumber && !entry.description) return null;
        return (
          <div
            key={i}
            className={`rounded-lg bg-white/60 border overflow-hidden ${bgClass || "border-card-border/30"}`}
          >
            {displayNumber && (
              <div className="flex items-start gap-2 px-3 py-2 border-b border-inherit">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${badgeClass || "text-primary-dark bg-primary-light"}`}>
                  #{displayNumber}
                </span>
                {displayTitle && (
                  <span className="text-xs text-foreground/70 leading-snug pt-0.5">
                    {displayTitle}
                  </span>
                )}
              </div>
            )}
            {entry.description && (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed px-3 py-2">
                {entry.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WaitingRoom({ submittedData }) {
  const [showUpdates, setShowUpdates] = useState(false);
  const ticketMap = submittedData._ticketMap || {};

  return (
    <div className="space-y-5">
      {/* ── Hero Card ── */}
      <div className="lobby-stagger-1 bg-card rounded-2xl border border-card-border shadow-sm p-8 sm:p-10 text-center space-y-5">
        {/* Orbital waiting animation */}
        <div className="relative w-32 h-32 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-primary/15 lobby-ripple" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/10 lobby-ripple-delayed" />
          <div className="absolute inset-0 rounded-full border border-primary/8 lobby-ripple-delayed-2" />

          {/* Outer orbit */}
          <div className="absolute inset-[-4px] lobby-orbit">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-md shadow-primary/40" />
          </div>

          {/* Reverse orbit */}
          <div className="absolute inset-1 lobby-orbit-reverse">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent/50" />
          </div>

          {/* Center icon */}
          <div className="absolute inset-5 rounded-full bg-primary-light flex items-center justify-center lobby-breath">
            <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-accent">You&apos;re All Set</h1>
        <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
          Standup submitted successfully. This page will update automatically when the meeting begins.
        </p>

        {/* Status pill */}
        <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-primary-light/60 border border-primary/15">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 rounded-full bg-primary lobby-connected-pulse" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="text-xs font-semibold text-primary-dark tracking-wide">
            Waiting for Scrum Master
          </span>
          <span className="flex items-center gap-0.5 ml-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.2s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.2s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.2s" }} />
          </span>
        </div>
      </div>

      {/* ── Submitted Updates (collapsible, original theme) ── */}
      <div className="lobby-stagger-2 rounded-2xl border border-card-border bg-card shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowUpdates(!showUpdates)}
          className="w-full px-5 sm:px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-background/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Your Submitted Updates</p>
              <p className="text-xs text-muted mt-0.5">
                {showUpdates ? "Tap to collapse" : "Tap to review what you submitted"}
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
            <svg
              className={`w-4 h-4 text-muted transition-transform duration-300 ${showUpdates ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        <div
          className={`transition-all duration-400 ease-in-out overflow-hidden ${
            showUpdates ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-5 sm:px-6 pb-5 space-y-3 border-t border-card-border/50 pt-4 max-h-[calc(80vh-60px)] overflow-y-auto">
            <div className="rounded-xl bg-primary-light/50 border border-primary/10 p-4">
              <p className="text-xs font-semibold text-primary-dark uppercase tracking-wide mb-1.5">
                Yesterday
              </p>
              {submittedData.yesterday_tickets?.length > 0 ? (
                <TicketEntries entries={submittedData.yesterday_tickets} ticketMap={ticketMap} badgeClass="text-primary-dark bg-primary-light" bgClass="border-primary/10" />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {submittedData.yesterday}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-accent-light/50 border border-accent/10 p-4">
              <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">
                Today
              </p>
              {submittedData.today_tickets?.length > 0 ? (
                <TicketEntries entries={submittedData.today_tickets} ticketMap={ticketMap} badgeClass="text-accent bg-accent-light" bgClass="border-accent/10" />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {submittedData.today}
                </p>
              )}
            </div>

            {(submittedData.blockers || (submittedData.blocker_tickets && submittedData.blocker_tickets.length > 0)) && (
              <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
                <p className="text-xs font-semibold text-danger uppercase tracking-wide mb-1.5">
                  Blockers
                </p>
                {submittedData.blocker_tickets?.length > 0 ? (
                  <TicketEntries entries={submittedData.blocker_tickets} ticketMap={ticketMap} badgeClass="text-danger bg-red-50" bgClass="border-red-100" />
                ) : submittedData.blockers ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {submittedData.blockers}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeTimer({ timerSeconds, isTimerRunning, timerEndTime }) {
  const endTimeRef = useRef(isTimerRunning && timerEndTime ? timerEndTime : null);
  const intervalRef = useRef(null);

  const [seconds, setSeconds] = useState(() => {
    if (isTimerRunning && timerEndTime) {
      return Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
    }
    return timerSeconds ?? TIMER_SECONDS;
  });
  const [running, setRunning] = useState(isTimerRunning ?? false);

  useEffect(() => {
    if (isTimerRunning && timerEndTime) {
      endTimeRef.current = timerEndTime;
      const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      setSeconds(remaining);
    } else if (timerSeconds != null) {
      endTimeRef.current = null;
      setSeconds(timerSeconds);
    }
  }, [timerSeconds, timerEndTime, isTimerRunning]);

  useEffect(() => {
    setRunning(isTimerRunning ?? false);
    if (isTimerRunning && timerEndTime) {
      endTimeRef.current = timerEndTime;
    } else if (!isTimerRunning) {
      endTimeRef.current = null;
    }
  }, [isTimerRunning, timerEndTime]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (running && endTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setSeconds(remaining);
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && endTimeRef.current && running) {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setSeconds(remaining);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [running]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / TIMER_SECONDS;
  const offset = circumference * (1 - progress);
  const isWarning = seconds <= 30 && seconds > 0;
  const isFinished = seconds === 0;

  const statusLabel = isFinished
    ? "Time's up"
    : running
    ? "Speaking"
    : seconds === TIMER_SECONDS
    ? "Ready"
    : "Paused";

  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32">
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 ${
          isFinished
            ? "timer-glow-red"
            : isWarning
            ? "timer-glow-red timer-pulse-glow"
            : running
            ? "timer-glow-green timer-pulse-glow"
            : "timer-glow-idle"
        }`}
      />
      {running && !isFinished && (
        <div
          className={`absolute inset-0 rounded-full timer-pulse-ring ${
            isWarning ? "border-danger/40" : "border-primary/30"
          }`}
        />
      )}
      <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="emp-timer-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="50%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
          <linearGradient id="emp-timer-warn" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <filter id="emp-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="emp-glow-warn">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-card-border/40" />
        <circle
          cx="60" cy="60" r={radius} fill="none" strokeWidth="5.5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          stroke={`url(#${isWarning ? "emp-timer-warn" : "emp-timer-grad"})`}
          filter={`url(#${isWarning ? "emp-glow-warn" : "emp-glow"})`}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className={`text-2xl sm:text-[1.7rem] font-extrabold tabular-nums tracking-tight transition-colors duration-300 ${
          isFinished ? "text-danger" : isWarning ? "text-danger timer-text-pulse" : "text-foreground"
        }`}>
          {formatTime(seconds)}
        </span>
        <span className={`text-[9px] font-semibold uppercase tracking-[0.15em] mt-1 transition-colors duration-300 ${
          isFinished ? "text-danger/70" : isWarning ? "text-danger/70" : running ? "text-primary" : "text-muted"
        }`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function ActiveMeetingView({ meetingState, userId }) {
  const { currentMember, currentIndex, totalMembers, allMembers, timerSeconds, isRunning: isTimerRunning } = meetingState;

  if (!currentMember) return null;

  const isMyTurn = userId && currentMember?.user_id === userId;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-accent">Meeting In Progress</h1>
        <p className="text-sm text-muted">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {isMyTurn && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center space-y-1 animate-in fade-in">
          <p className="text-sm font-bold text-primary-dark">It&apos;s Your Turn!</p>
          <p className="text-xs text-primary-dark/70">You&apos;re up — share your standup update with the team</p>
        </div>
      )}

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Member {currentIndex + 1} of {totalMembers}</span>
          <span>{Math.round(((currentIndex + 1) / totalMembers) * 100)}% complete</span>
        </div>
        <div className="w-full h-2 bg-card-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / totalMembers) * 100}%` }}
          />
        </div>

        {/* Member Dots */}
        {allMembers && allMembers.length > 0 && (
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            {allMembers.map((m, i) => (
              <div
                key={m.id}
                title={m.name}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all overflow-hidden shrink-0 ${
                  i === currentIndex
                    ? "bg-primary text-white scale-110 shadow-md shadow-primary/30 ring-2 ring-primary"
                    : i < currentIndex
                    ? "bg-primary-light text-primary-dark"
                    : "bg-card-border text-muted"
                }`}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (m.name || "?").charAt(0).toUpperCase()
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Now Speaking Card */}
      <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-card-border bg-accent-light/20 flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto sm:flex-1">
            {currentMember.avatar_url ? (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border-2 border-accent/20">
                <img src={currentMember.avatar_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent-light flex items-center justify-center shrink-0">
                <span className="text-base sm:text-lg font-bold text-accent">
                  {(currentMember.name || "?").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                  {currentMember.name}
                </h2>
                <span className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary text-white animate-pulse">
                  NOW SPEAKING
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs sm:text-sm text-muted truncate">{currentMember.email}</p>
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
          <EmployeeTimer key={currentIndex} timerSeconds={timerSeconds} isTimerRunning={isTimerRunning} timerEndTime={meetingState.timerEndTime} />
        </div>

        <div className="p-4 sm:p-6 md:p-8 space-y-4">
          {(currentMember.ticket_number || currentMember.due_date) && (
            <div className="rounded-xl bg-background border border-card-border p-4 flex flex-wrap gap-6">
              {currentMember.ticket_number && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">Ticket</p>
                  <p className="text-sm font-medium text-foreground">{currentMember.ticket_number}</p>
                </div>
              )}
              {currentMember.due_date && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">Due Date</p>
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
            <p className="text-xs font-semibold text-primary-dark uppercase tracking-wide mb-1.5">Yesterday</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{currentMember.yesterday}</p>
          </div>

          <div className="rounded-xl bg-accent-light/50 border border-accent/10 p-4">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">Today</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{currentMember.today}</p>
          </div>

          {currentMember.blockers && currentMember.blockers.trim() && (
            <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
              <p className="text-xs font-semibold text-danger uppercase tracking-wide mb-1.5">Blockers</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{currentMember.blockers}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompletedMeetingView({ meetingState, onNewStandup }) {
  const { totalMembers, allMembers } = meetingState;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-card rounded-2xl border border-card-border shadow-sm p-8 sm:p-10 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-accent">Meeting Complete</h1>
        <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
          All {totalMembers} team member{totalMembers !== 1 ? "s" : ""} have
          presented their standup updates. Great work today!
        </p>
        <button
          type="button"
          onClick={onNewStandup}
          className="btn-press inline-flex items-center gap-2 rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-all shadow-md shadow-primary/20 cursor-pointer mt-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Submit New Standup
        </button>
      </div>

      {allMembers && allMembers.length > 0 && (
        <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border">
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">
              Meeting Summary
            </h2>
          </div>
          <div className="divide-y divide-card-border/50">
            {allMembers.map((member) => (
              <div key={member.id} className="px-6 py-4">
                <div className="flex items-center gap-3 mb-3">
                  {member.avatar_url ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-primary/20">
                      <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-dark">
                        {(member.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <p className="font-semibold text-sm text-foreground">{member.name}</p>
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
                    <span className="font-semibold text-primary-dark">Today: </span>
                    <span className="text-muted">
                      {member.today?.length > 80 ? member.today.slice(0, 80) + "..." : member.today}
                    </span>
                  </div>
                  {member.blockers && member.blockers.trim() && (
                    <div className="text-xs">
                      <span className="font-semibold text-danger">Blocker: </span>
                      <span className="text-muted">
                        {member.blockers.length > 80 ? member.blockers.slice(0, 80) + "..." : member.blockers}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Submit() {
  const { user, loading } = useAuth({ allowedRoles: ALLOWED_ROLES });
  const { meetingState } = useMeetingChannel("employee");
  const [submittedData, setSubmittedData] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [resubmitting, setResubmitting] = useState(false);
  const prevPhaseRef = useRef(null);

  useEffect(() => {
    async function checkTodaySubmission() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setCheckingExisting(false); return; }

        const res = await fetch("/api/standup?scope=mine&date=today&presented=false", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) { setCheckingExisting(false); return; }

        const { standups } = await res.json();
        if (standups && standups.length > 0) {
          const s = standups[0];

          const extractIds = (arr) =>
            (arr || []).map((e) => (typeof e === "string" ? e : e.ticket_id)).filter(Boolean);
          const allTicketIds = [
            ...extractIds(s.yesterday_tickets),
            ...extractIds(s.today_tickets),
            ...extractIds(s.blocker_tickets),
          ];

          let ticketMap = {};
          if (allTicketIds.length > 0) {
            try {
              const tRes = await fetch("/api/tickets", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (tRes.ok) {
                const { tickets } = await tRes.json();
                ticketMap = Object.fromEntries((tickets || []).map((t) => [t.id, t]));
              }
            } catch { /* ignore */ }
          }

          setSubmittedData({
            yesterday: s.yesterday,
            today: s.today,
            blockers: s.blockers,
            yesterday_tickets: s.yesterday_tickets || [],
            today_tickets: s.today_tickets || [],
            blocker_tickets: s.blocker_tickets || [],
            _ticketMap: ticketMap,
          });
        }
      } catch {
        // ignore – let user submit if check fails
      } finally {
        setCheckingExisting(false);
      }
    }
    if (!loading) checkTodaySubmission();
  }, [loading]);

  const meetingPhase = meetingState?.phase;

  useEffect(() => {
    if (prevPhaseRef.current === "completed" && (meetingPhase === "lobby" || !meetingPhase)) {
      setSubmittedData(null);
      setResubmitting(false);
    }
    if (meetingPhase === "active") {
      setResubmitting(false);
    }
    prevPhaseRef.current = meetingPhase;
  }, [meetingPhase]);

  const handleSubmitted = (data) => {
    setSubmittedData(data);
  };

  const handleNewStandup = () => {
    setSubmittedData(null);
    setResubmitting(true);
  };

  if (loading || checkingExisting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const effectivePhase = resubmitting && meetingPhase === "completed" ? null : meetingPhase;
  const isInMeeting = submittedData && effectivePhase && effectivePhase !== "lobby";

  return (
    <AppLayout>
      <div className={`mx-auto px-4 sm:px-6 py-10 space-y-6 ${isInMeeting ? "max-w-3xl" : "max-w-2xl"}`}>
        {/* Form phase — not yet submitted */}
        {!submittedData && (
          <>
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-accent">Submit Standup</h1>
              <p className="text-sm text-muted">Share your daily update</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-card-border/60 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.02)] p-5 sm:p-7">
              <StandupForm onSubmitted={handleSubmitted} />
            </div>
          </>
        )}

        {/* Submitted + meeting not started or in lobby */}
        {submittedData && (!effectivePhase || effectivePhase === "lobby") && (
          <WaitingRoom submittedData={submittedData} />
        )}

        {/* Meeting active — show current speaker in sync */}
        {submittedData && effectivePhase === "active" && (
          <ActiveMeetingView meetingState={meetingState} userId={user?.id} />
        )}

        {/* Meeting completed */}
        {submittedData && effectivePhase === "completed" && (
          <CompletedMeetingView
            meetingState={meetingState}
            onNewStandup={handleNewStandup}
          />
        )}
      </div>
    </AppLayout>
  );
}
