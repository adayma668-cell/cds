"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingChannel } from "@/hooks/useMeetingChannel";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";

const ALLOWED_ROLES = ["scrum_master", "super_admin"];
const TIMER_SECONDS = 120;
const MEETING_STORAGE_KEY = "standup-meeting-sm-state";

function saveMeetingToStorage(state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      MEETING_STORAGE_KEY,
      JSON.stringify({ ...state, savedDate: new Date().toISOString().split("T")[0] })
    );
  } catch {}
}

function loadMeetingFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MEETING_STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state.savedDate !== new Date().toISOString().split("T")[0]) {
      localStorage.removeItem(MEETING_STORAGE_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function clearMeetingStorage() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(MEETING_STORAGE_KEY); } catch {}
}

const WORK_ITEM_COLORS = {
  "User Story": { badge: "bg-blue-50 text-blue-700 border-blue-200", icon: "📘" },
  Task: { badge: "bg-amber-50 text-amber-700 border-amber-200", icon: "📋" },
  Bug: { badge: "bg-red-50 text-red-600 border-red-200", icon: "🐛" },
  Feature: { badge: "bg-purple-50 text-purple-700 border-purple-200", icon: "✨" },
  Epic: { badge: "bg-orange-50 text-orange-700 border-orange-200", icon: "🏔" },
};

function TicketEntry({ entry }) {
  const num = entry.ticket_number;
  const title = entry.title;
  const desc = entry.description;
  const type = entry.type;
  const colors = WORK_ITEM_COLORS[type] || null;

  if (!num && !desc) return null;

  return (
    <div className="rounded-lg bg-white/70 border border-card-border/40 overflow-hidden hover:border-card-border/70 transition-colors">
      {num && (
        <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-card-border/30 bg-gray-50/40">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${colors?.badge || "bg-gray-50 text-gray-600 border-gray-200"}`}>
            #{num}
          </span>
          {type && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors?.badge || "bg-gray-50 text-gray-600"}`}>
              {type}
            </span>
          )}
          {title && (
            <span className="text-sm text-foreground/75 truncate flex-1">{title}</span>
          )}
        </div>
      )}
      {desc && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap px-3.5 py-2.5">{desc}</p>
      )}
    </div>
  );
}

function TicketEntriesBlock({ entries, fallbackText, sectionBg, sectionBorder, labelColor, label }) {
  const hasTickets = entries && entries.length > 0 && entries.some((e) => e.ticket_number || e.description);

  return (
    <div className={`rounded-xl ${sectionBg} border ${sectionBorder} p-4`}>
      <p className={`text-xs font-semibold ${labelColor} uppercase tracking-wide mb-2.5`}>
        {label}
      </p>
      {hasTickets ? (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <TicketEntry key={i} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {fallbackText}
        </p>
      )}
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Timer({ seconds, isRunning, isWarning }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / TIMER_SECONDS;
  const offset = circumference * (1 - progress);
  const isFinished = seconds === 0;
  const gradientId = isWarning ? "timer-gradient-warn" : "timer-gradient";
  const glowId = isWarning ? "timer-glow-warn" : "timer-glow";

  const tickCount = 60;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const angle = (i / tickCount) * 360;
    const isMajor = i % 5 === 0;
    return { angle, isMajor };
  });

  const statusLabel = isFinished
    ? "Time's up"
    : isRunning
    ? "Speaking"
    : seconds === TIMER_SECONDS
    ? "Ready"
    : "Paused";

  return (
    <div className="relative w-32 h-32 sm:w-36 sm:h-36 group">
      {/* Ambient glow behind the timer */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 ${
          isFinished
            ? "timer-glow-red"
            : isWarning
            ? "timer-glow-red timer-pulse-glow"
            : isRunning
            ? "timer-glow-green timer-pulse-glow"
            : "timer-glow-idle"
        }`}
      />

      {/* Pulse ring when running */}
      {isRunning && !isFinished && (
        <div
          className={`absolute inset-0 rounded-full timer-pulse-ring ${
            isWarning ? "border-danger/40" : "border-primary/30"
          }`}
        />
      )}

      <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="50%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
          <linearGradient id="timer-gradient-warn" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <filter id="timer-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="timer-glow-warn">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Tick marks */}
        {ticks.map(({ angle, isMajor }, i) => {
          const rad = (angle * Math.PI) / 180;
          const outerR = 58;
          const innerR = isMajor ? 54 : 55.5;
          return (
            <line
              key={i}
              x1={60 + outerR * Math.cos(rad)}
              y1={60 + outerR * Math.sin(rad)}
              x2={60 + innerR * Math.cos(rad)}
              y2={60 + innerR * Math.sin(rad)}
              stroke="currentColor"
              strokeWidth={isMajor ? 1.2 : 0.6}
              className="text-card-border/60"
              strokeLinecap="round"
            />
          );
        })}

        {/* Background track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-card-border/40"
        />

        {/* Progress arc */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={`url(#${gradientId})`}
          filter={`url(#${glowId})`}
          className="transition-all duration-1000 ease-linear"
        />

        {/* Leading dot on the progress arc */}
        {seconds > 0 && seconds < TIMER_SECONDS && (
          <circle
            cx={60 + radius * Math.cos(2 * Math.PI * progress - Math.PI / 2)}
            cy={60 + radius * Math.sin(2 * Math.PI * progress - Math.PI / 2)}
            r="3.5"
            fill={isWarning ? "#ef4444" : "var(--primary)"}
            className="timer-dot-pulse"
            style={{ transformOrigin: "center" }}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span
          className={`text-[1.7rem] sm:text-3xl font-extrabold tabular-nums tracking-tight transition-colors duration-300 ${
            isFinished
              ? "text-danger"
              : isWarning
              ? "text-danger timer-text-pulse"
              : "text-foreground"
          }`}
        >
          {formatTime(seconds)}
        </span>
        <span
          className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] mt-1 transition-colors duration-300 ${
            isFinished
              ? "text-danger/70"
              : isWarning
              ? "text-danger/70"
              : isRunning
              ? "text-primary"
              : "text-muted"
          }`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

export default function StartMeeting() {
  const { user, loading: authLoading } = useAuth({ allowedRoles: ALLOWED_ROLES });
  const { broadcastState } = useMeetingChannel("scrum_master");

  const [phase, setPhase] = useState("lobby");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seconds, setSeconds] = useState(TIMER_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const endTimeRef = useRef(null);
  const [timerEpoch, setTimerEpoch] = useState(0);
  const meetingInfoRef = useRef({});
  const prevSecondsRef = useRef(TIMER_SECONDS);
  const restoredRef = useRef(false);

  const [submittedAll, setSubmittedAll] = useState([]);
  const [pendingAll, setPendingAll] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  useEffect(() => {
    const saved = loadMeetingFromStorage();
    if (!saved || !saved.phase || saved.phase === "lobby") return;

    restoredRef.current = true;
    setPhase(saved.phase);
    setSelectedTeam(saved.selectedTeam || "all");
    setCurrentIndex(saved.currentIndex || 0);
    setSubmittedAll(saved.submittedAll || []);
    setPendingAll(saved.pendingAll || []);
    setDataLoading(false);

    const filtered =
      saved.selectedTeam === "all"
        ? saved.submittedAll || []
        : (saved.submittedAll || []).filter((m) => (m.teams || []).includes(saved.selectedTeam));
    const idx = saved.currentIndex || 0;

    if (saved.phase === "active") {
      let restoredEndTime = null;
      let restoredRunning = false;
      let restoredSeconds = saved.seconds ?? 0;

      if (saved.isRunning && saved.timerEndTime) {
        const remaining = Math.max(0, Math.ceil((saved.timerEndTime - Date.now()) / 1000));
        if (remaining > 0) {
          restoredEndTime = saved.timerEndTime;
          restoredRunning = true;
          restoredSeconds = remaining;
        }
      }

      endTimeRef.current = restoredEndTime;
      setSeconds(restoredSeconds);
      setIsRunning(restoredRunning);
      setTimerEpoch((e) => e + 1);

      setTimeout(() => {
        broadcastState({
          phase: "active",
          currentIndex: idx,
          totalMembers: filtered.length,
          currentMember: filtered[idx],
          allMembers: filtered,
          timerSeconds: restoredEndTime
            ? Math.max(0, Math.ceil((restoredEndTime - Date.now()) / 1000))
            : restoredSeconds,
          timerEndTime: restoredEndTime,
          isRunning: restoredRunning,
        });
      }, 1500);
    } else if (saved.phase === "completed") {
      setTimeout(() => {
        broadcastState({
          phase: "completed",
          totalMembers: filtered.length,
          allMembers: filtered,
        });
      }, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (restoredRef.current) return;
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

  meetingInfoRef.current = { phase, currentIndex, totalMembers, filteredStandups, selectedTeam, submittedAll, pendingAll };

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (!isRunning || !endTimeRef.current) return;

    const sync = () => {
      if (!endTimeRef.current) { clearTimer(); return; }
      const r = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setSeconds(r);
      if (r <= 0) {
        clearTimer();
        setIsRunning(false);
        endTimeRef.current = null;
      }
    };

    sync();
    intervalRef.current = setInterval(sync, 200);
    return clearTimer;
  }, [isRunning, timerEpoch, clearTimer]);

  useEffect(() => {
    if (prevSecondsRef.current > 0 && seconds === 0) {
      const info = meetingInfoRef.current;
      if (info.phase === "active") {
        broadcastState({
          phase: "active",
          currentIndex: info.currentIndex,
          totalMembers: info.totalMembers,
          currentMember: info.filteredStandups[info.currentIndex],
          allMembers: info.filteredStandups,
          timerSeconds: 0,
          timerEndTime: null,
          isRunning: false,
        });
        saveMeetingToStorage({
          phase: "active", selectedTeam: info.selectedTeam,
          currentIndex: info.currentIndex, seconds: 0,
          isRunning: false, timerEndTime: null,
          submittedAll: info.submittedAll, pendingAll: info.pendingAll,
        });
      }
    }
    prevSecondsRef.current = seconds;
  }, [seconds, broadcastState]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && endTimeRef.current && isRunning) {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setSeconds(remaining);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isRunning]);

  const startMeeting = () => {
    if (filteredStandups.length === 0) return;
    const endTime = Date.now() + TIMER_SECONDS * 1000;
    endTimeRef.current = endTime;
    setPhase("active");
    setCurrentIndex(0);
    setSeconds(TIMER_SECONDS);
    setIsRunning(true);
    setTimerEpoch(e => e + 1);
    broadcastState({
      phase: "active",
      currentIndex: 0,
      totalMembers: filteredStandups.length,
      currentMember: filteredStandups[0],
      allMembers: filteredStandups,
      timerSeconds: TIMER_SECONDS,
      timerEndTime: endTime,
      isRunning: true,
    });
    saveMeetingToStorage({
      phase: "active", selectedTeam, currentIndex: 0,
      seconds: TIMER_SECONDS, isRunning: true, timerEndTime: endTime,
      submittedAll, pendingAll,
    });
  };

  const handleNext = () => {
    clearTimer();
    if (currentIndex < totalMembers - 1) {
      const nextIdx = currentIndex + 1;
      const endTime = Date.now() + TIMER_SECONDS * 1000;
      endTimeRef.current = endTime;
      setCurrentIndex(nextIdx);
      setSeconds(TIMER_SECONDS);
      setIsRunning(true);
      setTimerEpoch(e => e + 1);
      broadcastState({
        phase: "active",
        currentIndex: nextIdx,
        totalMembers,
        currentMember: filteredStandups[nextIdx],
        allMembers: filteredStandups,
        timerSeconds: TIMER_SECONDS,
        timerEndTime: endTime,
        isRunning: true,
      });
      saveMeetingToStorage({
        phase: "active", selectedTeam, currentIndex: nextIdx,
        seconds: TIMER_SECONDS, isRunning: true, timerEndTime: endTime,
        submittedAll, pendingAll,
      });
    } else {
      setPhase("completed");
      setIsRunning(false);
      broadcastState({
        phase: "completed",
        totalMembers,
        allMembers: filteredStandups,
      });
      saveMeetingToStorage({
        phase: "completed", selectedTeam, currentIndex,
        seconds: 0, isRunning: false, timerEndTime: null,
        submittedAll, pendingAll,
      });

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch("/api/meeting/finish", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              memberCount: totalMembers,
              team: selectedTeam === "all" ? null : selectedTeam,
              standupIds: filteredStandups.map((m) => m.id),
            }),
          }).catch(() => {});
        }
      });
    }
  };

  const handlePauseResume = () => {
    if (seconds === 0) return;
    const nextRunning = !isRunning;
    let endTime = null;
    if (nextRunning) {
      endTime = Date.now() + seconds * 1000;
      endTimeRef.current = endTime;
    } else {
      endTimeRef.current = null;
    }
    setIsRunning(nextRunning);
    setTimerEpoch(e => e + 1);
    broadcastState({
      phase: "active",
      currentIndex,
      totalMembers,
      currentMember: filteredStandups[currentIndex],
      allMembers: filteredStandups,
      timerSeconds: seconds,
      timerEndTime: endTime,
      isRunning: nextRunning,
    });
    saveMeetingToStorage({
      phase: "active", selectedTeam, currentIndex,
      seconds, isRunning: nextRunning, timerEndTime: endTime,
      submittedAll, pendingAll,
    });
  };

  const handleRestart = async () => {
    setPhase("lobby");
    setCurrentIndex(0);
    setSeconds(TIMER_SECONDS);
    setIsRunning(false);
    clearTimer();
    endTimeRef.current = null;
    broadcastState({ phase: "lobby" });
    clearMeetingStorage();
    await handleRefresh();
  };

  const handleAbandon = async () => {
    setAbandoning(true);
    clearTimer();
    setIsRunning(false);
    endTimeRef.current = null;
    broadcastState({ phase: "lobby" });
    clearMeetingStorage();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/meeting/finish", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            memberCount: currentIndex + 1,
            team: selectedTeam === "all" ? null : selectedTeam,
            abandoned: true,
            abandonedAt: currentIndex + 1,
            totalMembers,
            standupIds: filteredStandups.map((m) => m.id),
          }),
        });
      }
    } catch {}

    setPhase("lobby");
    setCurrentIndex(0);
    setSeconds(TIMER_SECONDS);
    setShowAbandonConfirm(false);
    setAbandoning(false);
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
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">Loading meeting data...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
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
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
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
                      {member.avatar_url ? (
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-amber-200">
                          <img
                            src={member.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-amber-700">
                            {(member.name || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
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
                      {member.avatar_url ? (
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-primary/20">
                          <img
                            src={member.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary-dark">
                            {(member.name || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
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
                <div className="flex items-center gap-3">
                  <span>
                    {Math.round(((currentIndex + 1) / totalMembers) * 100)}%
                    complete
                  </span>
                  <button
                    onClick={() => setShowAbandonConfirm(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 hover:text-white hover:bg-danger border border-red-200 hover:border-danger transition-all cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    End Meeting
                  </button>
                </div>
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
            </div>

            {/* Current Member Card */}
            <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 md:px-8 py-5 sm:py-6 border-b border-card-border bg-accent-light/20 flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
                <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                  {currentMember.avatar_url ? (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border-2 border-accent/20">
                      <img
                        src={currentMember.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent-light flex items-center justify-center shrink-0">
                      <span className="text-base sm:text-lg font-bold text-accent">
                        {(currentMember.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                      {currentMember.name}
                    </h2>
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
                <Timer
                  seconds={seconds}
                  isRunning={isRunning}
                  isWarning={isWarning}
                />
              </div>

              {/* Standup Content */}
              <div className="p-4 sm:p-6 md:p-8 space-y-4">
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
                <TicketEntriesBlock
                  entries={currentMember.yesterday_tickets}
                  fallbackText={currentMember.yesterday}
                  sectionBg="bg-primary-light/50"
                  sectionBorder="border-primary/10"
                  labelColor="text-primary-dark"
                  label="Yesterday"
                />

                <TicketEntriesBlock
                  entries={currentMember.today_tickets}
                  fallbackText={currentMember.today}
                  sectionBg="bg-accent-light/50"
                  sectionBorder="border-accent/10"
                  labelColor="text-accent"
                  label="Today"
                />

                {(currentMember.blockers?.trim() || (currentMember.blocker_tickets && currentMember.blocker_tickets.length > 0)) && (
                  <TicketEntriesBlock
                    entries={currentMember.blocker_tickets}
                    fallbackText={currentMember.blockers}
                    sectionBg="bg-red-50/50"
                    sectionBorder="border-red-100"
                    labelColor="text-danger"
                    label="Blockers"
                  />
                )}
              </div>

              {/* Controls */}
              <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 border-t border-card-border bg-background/50 flex items-center gap-3">
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

            {/* Abandon Confirmation Modal */}
            {showAbandonConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  onClick={() => !abandoning && setShowAbandonConfirm(false)}
                />
                <div className="relative bg-card rounded-2xl border border-card-border shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                      <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      Abandon Meeting?
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">
                      This will end the meeting immediately. Progress for{" "}
                      <span className="font-semibold text-foreground">
                        {currentIndex + 1} of {totalMembers}
                      </span>{" "}
                      members will be saved, but remaining members will be skipped.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAbandonConfirm(false)}
                      disabled={abandoning}
                      className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAbandon}
                      disabled={abandoning}
                      className="flex-1 rounded-lg bg-danger text-white py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {abandoning ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Ending...
                        </span>
                      ) : (
                        "Yes, Abandon"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                      {member.avatar_url ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-primary/20">
                          <img
                            src={member.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
                          <span className="text-xs font-bold text-primary-dark">
                            {(member.name || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
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
                    <div className="space-y-2 pl-11">
                      <div>
                        <p className="text-[10px] font-semibold text-primary-dark uppercase tracking-wide mb-1">Today</p>
                        {member.today_tickets && member.today_tickets.length > 0 ? (
                          <div className="space-y-1.5">
                            {member.today_tickets.map((t, ti) => (
                              <div key={ti} className="flex items-center gap-2 text-xs">
                                {t.ticket_number && (
                                  <span className="font-bold text-primary-dark bg-primary-light/60 px-1.5 py-0.5 rounded text-[10px]">
                                    #{t.ticket_number}
                                  </span>
                                )}
                                <span className="text-foreground/70 truncate">
                                  {t.title || t.description?.replace(/^• /gm, "").slice(0, 80) || ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted">
                            {member.today?.length > 100 ? member.today.slice(0, 100) + "..." : member.today}
                          </p>
                        )}
                      </div>
                      {(member.blockers?.trim() || (member.blocker_tickets && member.blocker_tickets.length > 0)) && (
                        <div>
                          <p className="text-[10px] font-semibold text-danger uppercase tracking-wide mb-1">Blockers</p>
                          {member.blocker_tickets && member.blocker_tickets.length > 0 ? (
                            <div className="space-y-1.5">
                              {member.blocker_tickets.map((t, ti) => (
                                <div key={ti} className="flex items-center gap-2 text-xs">
                                  {t.ticket_number && (
                                    <span className="font-bold text-danger bg-red-50 px-1.5 py-0.5 rounded text-[10px]">
                                      #{t.ticket_number}
                                    </span>
                                  )}
                                  <span className="text-foreground/70 truncate">
                                    {t.title || t.description?.replace(/^• /gm, "").slice(0, 80) || ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted">
                              {member.blockers?.length > 100 ? member.blockers.slice(0, 100) + "..." : member.blockers}
                            </p>
                          )}
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
      </div>
    </AppLayout>
  );
}
