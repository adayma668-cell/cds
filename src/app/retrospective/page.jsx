"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/context/AuthContext";
import AppLayout from "@/components/AppLayout";
import { useRetroChannel } from "@/hooks/useRetroChannel";
import { useOpenActionsChannel } from "@/hooks/useOpenActionsChannel";
import { useRetroBoardChannel } from "@/hooks/useRetroBoardChannel";
import { useRetroGroupChannel } from "@/hooks/useRetroGroupChannel";
import { useVoteTrackerChannel } from "@/hooks/useVoteTrackerChannel";
import { useRetroPhaseSyncChannel } from "@/hooks/useRetroPhaseSyncChannel";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";
import {
  DiceIcon, TargetIcon, PinIcon, NotepadIcon, BallotIcon, ChartBarIcon,
  RocketIcon, HandHeartIcon, ClipboardCheckIcon, BellAlertIcon, SparklesIcon,
  TrophyIcon, WarningIcon, StarIcon, UsersIcon, HeartIcon, ArrowPathIcon, MedalIcon,
  CheckCircleIcon, XCircleIcon, LightbulbIcon, HelpCircleIcon,
  FaceGreatIcon, FaceGoodIcon, FaceNeutralIcon, FaceConcernedIcon, FaceFrustratedIcon,
  ScaleIcon, DownloadIcon,
} from "@/lib/icons";
import WaitingLobbyGame from "@/components/WaitingLobbyGame";

const SessionContext = createContext(null);
function useSessionId() { return useContext(SessionContext); }

const ALLOWED_ROLES = ["scrum_master", "super_admin"];

const PHASES = [
  { id: 0, label: "Ice Breaker", icon: (cls = "w-4 h-4") => <DiceIcon className={cls} />, short: "Ice Breaker" },
  { id: 1, label: "Set the Stage", icon: (cls = "w-4 h-4") => <TargetIcon className={cls} />, short: "Stage" },
  { id: 2, label: "Open Actions", icon: (cls = "w-4 h-4") => <PinIcon className={cls} />, short: "Actions" },
  { id: 3, label: "Retro Board", icon: (cls = "w-4 h-4") => <NotepadIcon className={cls} />, short: "Board" },
  { id: 4, label: "AI Group", icon: (cls = "w-4 h-4") => <SparklesIcon className={cls} />, short: "Group" },
  { id: 5, label: "Vote", icon: (cls = "w-4 h-4") => <BallotIcon className={cls} />, short: "Vote" },
  { id: 6, label: "Results", icon: (cls = "w-4 h-4") => <ChartBarIcon className={cls} />, short: "Results" },
  { id: 7, label: "Action Items", icon: (cls = "w-4 h-4") => <RocketIcon className={cls} />, short: "New Actions" },
  { id: 8, label: "Appreciation", icon: (cls = "w-4 h-4") => <HandHeartIcon className={cls} />, short: "Thanks" },
  { id: 9, label: "Time Check", icon: (cls = "w-4 h-4") => <ScaleIcon className={cls} />, short: "Worth It?" },
  { id: 10, label: "Close & Summary", icon: (cls = "w-4 h-4") => <ClipboardCheckIcon className={cls} />, short: "Summary" },
];

/* ------------------------------------------------------------------ */
/*  Phase Timer with auto-start, reset, tick & finish sounds           */
/* ------------------------------------------------------------------ */
const PHASE_DURATIONS = {
  0: 5 * 60,   // Ice Breaker: 5 min
  1: 3 * 60,   // Set the Stage: 3 min
  2: 5 * 60,   // Open Actions: 5 min
  3: 10 * 60,  // Retro Board: 10 min
  4: 3 * 60,   // AI Group: 3 min
  5: 5 * 60,   // Vote: 5 min
  6: 3 * 60,   // Results: 3 min
  7: 7 * 60,   // Action Items: 7 min
  8: 3 * 60,   // Appreciation: 3 min
  9: 3 * 60,   // Time Check: 3 min
  10: 2 * 60,  // Summary: 2 min
};

function useTimerSounds() {
  const audioCtxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playTick = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }, [getCtx]);

  const playFinish = useCallback(() => {
    try {
      const ctx = getCtx();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.type = "sine";
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch {}
  }, [getCtx]);

  return { playTick, playFinish };
}

const TIMER_STORAGE_KEY = "retro_phase_timers";

function _loadTimerCache() {
  try {
    const raw = sessionStorage.getItem(TIMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function _saveTimerCache(state) {
  try { sessionStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

let _phaseTimerState = null;
function _getTimerState() {
  if (!_phaseTimerState) _phaseTimerState = _loadTimerCache();
  return _phaseTimerState;
}

function PhaseTimer({ phaseIndex, isFacilitator = true, broadcastTimer, timerEvent, timerRequestEvent, requestTimer }) {
  const { playTick, playFinish } = useTimerSounds();
  const endTimeRef = useRef(0);
  const pausedMsRef = useRef(null);
  const finishedFiredRef = useRef(false);
  const prevPhaseRef = useRef(null);
  const timerStateRef = useRef({});

  const [duration, setDuration] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editMin, setEditMin] = useState("");
  const [editSec, setEditSec] = useState("");

  /* ---- Facilitator: init timer on phase change (local + sessionStorage) ---- */
  useEffect(() => {
    if (!isFacilitator) return;
    const d = PHASE_DURATIONS[phaseIndex] || 5 * 60;
    const cache = _getTimerState();
    const cached = cache[phaseIndex];

    if (cached && prevPhaseRef.current !== phaseIndex) {
      endTimeRef.current = cached.endTime;
      pausedMsRef.current = cached.pausedMs;
      finishedFiredRef.current = cached.finished;
      setDuration(cached.duration);

      if (cached.finished) {
        setRunning(false);
        setFinished(true);
        setTimeLeft(0);
      } else if (cached.pausedMs != null) {
        setRunning(false);
        setFinished(false);
        setTimeLeft(Math.max(0, Math.ceil(cached.pausedMs / 1000)));
      } else {
        const remaining = Math.max(0, Math.ceil((cached.endTime - Date.now()) / 1000));
        if (remaining <= 0) {
          finishedFiredRef.current = true;
          setRunning(false);
          setFinished(true);
          setTimeLeft(0);
        } else {
          setRunning(true);
          setFinished(false);
          setTimeLeft(remaining);
        }
      }
    } else if (prevPhaseRef.current !== phaseIndex) {
      endTimeRef.current = Date.now() + d * 1000;
      pausedMsRef.current = null;
      finishedFiredRef.current = false;
      setDuration(d);
      setTimeLeft(d);
      setRunning(true);
      setFinished(false);
    }

    prevPhaseRef.current = phaseIndex;
    setEditing(false);
  }, [phaseIndex, isFacilitator]);

  /* ---- Facilitator: persist timer to sessionStorage ---- */
  useEffect(() => {
    if (!isFacilitator) return;
    const cache = _getTimerState();
    cache[phaseIndex] = {
      endTime: endTimeRef.current,
      pausedMs: pausedMsRef.current,
      duration,
      running,
      finished,
    };
    _phaseTimerState = cache;
    _saveTimerCache(cache);
  }, [phaseIndex, duration, running, finished, isFacilitator]);

  /* ---- Facilitator: broadcast timer state on meaningful changes ---- */
  useEffect(() => {
    if (!isFacilitator || !broadcastTimer) return;
    const snapshot = {
      phaseIndex,
      endTime: endTimeRef.current,
      pausedMs: pausedMsRef.current,
      duration,
      running,
      finished,
    };
    timerStateRef.current = snapshot;
    broadcastTimer(snapshot);
  }, [isFacilitator, broadcastTimer, phaseIndex, duration, running, finished]);

  /* ---- Facilitator: respond to timer_request from late joiners ---- */
  useEffect(() => {
    if (!isFacilitator || !broadcastTimer || !timerRequestEvent) return;
    broadcastTimer(timerStateRef.current);
  }, [timerRequestEvent, isFacilitator, broadcastTimer]);

  /* ---- Non-facilitator: init defaults on phase change ---- */
  useEffect(() => {
    if (isFacilitator) return;
    if (prevPhaseRef.current !== phaseIndex) {
      const d = PHASE_DURATIONS[phaseIndex] || 5 * 60;
      endTimeRef.current = Date.now() + d * 1000;
      pausedMsRef.current = null;
      finishedFiredRef.current = false;
      setDuration(d);
      setTimeLeft(d);
      setRunning(false);
      setFinished(false);
      prevPhaseRef.current = phaseIndex;
      if (requestTimer) setTimeout(() => requestTimer(), 100);
    }
  }, [phaseIndex, isFacilitator, requestTimer]);

  /* ---- Non-facilitator: request timer state on mount ---- */
  useEffect(() => {
    if (isFacilitator || !requestTimer) return;
    const timeout = setTimeout(() => requestTimer(), 300);
    return () => clearTimeout(timeout);
  }, [isFacilitator, requestTimer]);

  /* ---- Non-facilitator: apply incoming timer sync from facilitator ---- */
  useEffect(() => {
    if (isFacilitator || !timerEvent) return;
    endTimeRef.current = timerEvent.endTime;
    pausedMsRef.current = timerEvent.pausedMs ?? null;
    setDuration(timerEvent.duration);

    if (timerEvent.finished) {
      finishedFiredRef.current = true;
      setRunning(false);
      setFinished(true);
      setTimeLeft(0);
    } else if (timerEvent.pausedMs != null) {
      finishedFiredRef.current = false;
      setRunning(false);
      setFinished(false);
      setTimeLeft(Math.max(0, Math.ceil(timerEvent.pausedMs / 1000)));
    } else {
      const remaining = Math.max(0, Math.ceil((timerEvent.endTime - Date.now()) / 1000));
      if (remaining <= 0) {
        finishedFiredRef.current = true;
        setRunning(false);
        setFinished(true);
        setTimeLeft(0);
      } else {
        finishedFiredRef.current = false;
        setRunning(true);
        setFinished(false);
        setTimeLeft(remaining);
      }
    }
  }, [timerEvent, isFacilitator]);

  /* ---- Countdown interval (both modes) ---- */
  useEffect(() => {
    if (!running || finished) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 10 && remaining > 0 && !finishedFiredRef.current) playTick();
      if (remaining <= 0 && !finishedFiredRef.current) {
        finishedFiredRef.current = true;
        setRunning(false);
        setFinished(true);
        playFinish();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, finished, playTick, playFinish]);

  /* ---- Facilitator-only action handlers ---- */
  const openEditor = () => {
    pausedMsRef.current = Math.max(0, endTimeRef.current - Date.now());
    setRunning(false);
    const remaining = pausedMsRef.current != null
      ? Math.max(0, Math.ceil(pausedMsRef.current / 1000))
      : Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setEditMin(String(Math.floor(remaining / 60)));
    setEditSec(String(remaining % 60));
    setEditing(true);
  };

  const applyCustomTime = () => {
    const m = Math.max(0, parseInt(editMin) || 0);
    const s = Math.max(0, Math.min(59, parseInt(editSec) || 0));
    const total = m * 60 + s;
    if (total > 0) {
      setDuration(total);
      setTimeLeft(total);
      endTimeRef.current = Date.now() + total * 1000;
      pausedMsRef.current = null;
      setFinished(false);
      setRunning(true);
      finishedFiredRef.current = false;
    }
    setEditing(false);
  };

  const togglePause = () => {
    if (finished) {
      endTimeRef.current = Date.now() + duration * 1000;
      pausedMsRef.current = null;
      setTimeLeft(duration);
      setFinished(false);
      setRunning(true);
      finishedFiredRef.current = false;
      return;
    }
    if (running) {
      pausedMsRef.current = Math.max(0, endTimeRef.current - Date.now());
      setRunning(false);
    } else {
      const ms = pausedMsRef.current ?? timeLeft * 1000;
      endTimeRef.current = Date.now() + ms;
      pausedMsRef.current = null;
      setRunning(true);
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const pct = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const isWarning = timeLeft <= 30 && timeLeft > 10;
  const isCritical = timeLeft <= 10;

  const ringColor = finished || isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-accent";

  const circumference = 2 * Math.PI * 20;
  const progressOffset = circumference * (1 - pct / 100);

  return (
    <div className={`inline-flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all duration-500 backdrop-blur-sm ${
      finished
        ? "border-red-200/50 retro-timer-critical"
        : isCritical
        ? "border-red-200/50 retro-timer-critical"
        : isWarning
        ? "border-amber-200/50"
        : "border-white/30"
    }`} style={{
      background: finished || isCritical
        ? "linear-gradient(145deg, rgba(254, 242, 242, 0.88), rgba(254, 226, 226, 0.82))"
        : isWarning
        ? "linear-gradient(145deg, rgba(255, 251, 235, 0.88), rgba(254, 243, 199, 0.82))"
        : "linear-gradient(145deg, rgba(255, 255, 255, 0.85), rgba(240, 247, 244, 0.82))",
      boxShadow: finished || isCritical
        ? "0 8px 32px rgba(220, 38, 38, 0.1), 0 2px 8px rgba(220, 38, 38, 0.05)"
        : isWarning
        ? "0 8px 32px rgba(245, 158, 11, 0.1), 0 2px 8px rgba(245, 158, 11, 0.05)"
        : "0 8px 32px rgba(0, 50, 100, 0.06), 0 2px 8px rgba(6, 194, 134, 0.04)"
    }}>
      {/* Gradient progress ring */}
      <div className="relative w-12 h-12 flex-shrink-0">
        {running && !finished && (
          <div className={`absolute inset-0 rounded-full timer-pulse-ring ${isCritical ? "border-red-400/40" : isWarning ? "border-amber-400/40" : "border-accent/25"}`} />
        )}
        <svg className="w-12 h-12 -rotate-90 relative z-10" viewBox="0 0 48 48">
          <defs>
            <linearGradient id="rtimer-g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="50%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
            <linearGradient id="rtimer-w" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <filter id="rtimer-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-card-border/30" />
          <circle
            cx="24" cy="24" r="20" fill="none" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            stroke={`url(#${(finished || isCritical || isWarning) ? "rtimer-w" : "rtimer-g"})`}
            filter="url(#rtimer-glow)"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center z-20">
          {finished ? (
            <span className="retro-icon-pulse"><BellAlertIcon className="w-4 h-4" /></span>
          ) : (
            <span>{PHASES[phaseIndex]?.icon("w-4 h-4")}</span>
          )}
        </div>
      </div>

      {/* Time display / editor — controls only for facilitator */}
      {editing && isFacilitator ? (
        <div className="flex items-center gap-1.5" style={{ animation: "fadeInScale 0.15s ease-out" }}>
          <input
            type="number"
            value={editMin}
            onChange={(e) => setEditMin(e.target.value)}
            className="w-11 px-1.5 py-1.5 text-center text-sm font-mono font-bold bg-white/80 border border-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/40"
            min="0" max="99"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && applyCustomTime()}
          />
          <span className="text-sm font-bold text-muted">:</span>
          <input
            type="number"
            value={editSec}
            onChange={(e) => setEditSec(e.target.value)}
            className="w-11 px-1.5 py-1.5 text-center text-sm font-mono font-bold bg-white/80 border border-accent/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/40"
            min="0" max="59"
            onKeyDown={(e) => e.key === "Enter" && applyCustomTime()}
          />
          <button
            onClick={applyCustomTime}
            className="ml-1 px-3 py-1.5 bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold rounded-xl hover:shadow-md transition-all btn-press"
          >
            Set
          </button>
          <button
            onClick={() => { setEditing(false); setRunning(true); }}
            className="px-2 py-1.5 text-muted text-[10px] font-bold rounded-xl hover:bg-card-border/30 transition-all"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ) : isFacilitator ? (
        <button onClick={openEditor} className="flex flex-col cursor-pointer group" title="Click to set custom time">
          <span className={`text-2xl font-mono font-extrabold tracking-wider leading-none tabular-nums transition-colors group-hover:text-accent ${
            finished ? "text-red-500" : isCritical ? "text-red-500 timer-text-pulse" : isWarning ? "text-amber-600" : "text-foreground"
          }`}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className={`text-[9px] font-semibold uppercase tracking-[0.15em] mt-1 transition-colors ${
            finished ? "text-red-400" : running ? "text-primary" : "text-muted"
          }`}>
            {finished ? "Time's up!" : running ? "Running" : "Paused"}
          </span>
        </button>
      ) : (
        <div className="flex flex-col">
          <span className={`text-2xl font-mono font-extrabold tracking-wider leading-none tabular-nums transition-colors ${
            finished ? "text-red-500" : isCritical ? "text-red-500 timer-text-pulse" : isWarning ? "text-amber-600" : "text-foreground"
          }`}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className={`text-[9px] font-semibold uppercase tracking-[0.15em] mt-1 transition-colors ${
            finished ? "text-red-400" : running ? "text-primary" : "text-muted"
          }`}>
            {finished ? "Time's up!" : running ? "Running" : "Paused"}
          </span>
        </div>
      )}

      {/* Pause / Play — facilitator only */}
      {!editing && isFacilitator && (
        <button
          onClick={togglePause}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
            finished
              ? "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35"
              : running
              ? "bg-white/60 text-muted hover:bg-white/80 hover:text-foreground border border-white/50"
              : "bg-gradient-to-br from-primary/15 to-accent/15 text-accent hover:from-primary/25 hover:to-accent/25 border border-accent/20"
          }`}
          title={finished ? "Restart" : running ? "Pause" : "Resume"}
        >
          {finished ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : running ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Premium Stepper Progress Bar                                       */
/* ------------------------------------------------------------------ */
function ProgressBar({ currentPhase }) {
  const progressPct = (currentPhase / (PHASES.length - 1)) * 100;
  return (
    <div className="relative rounded-[20px] px-6 py-5 retro-slide-in overflow-hidden backdrop-blur-sm" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.85) 0%, rgba(240, 247, 244, 0.82) 40%, rgba(230, 236, 247, 0.85) 100%)", border: "1px solid rgba(6, 194, 134, 0.12)", boxShadow: "0 8px 40px rgba(0, 50, 100, 0.06), 0 1px 3px rgba(6, 194, 134, 0.04)" }}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-accent/[0.02] pointer-events-none" />

      <div className="relative flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/70 border border-card-border/20 shadow-sm backdrop-blur-sm">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-card-border/20" />
                <circle
                  cx="16" cy="16" r="13" fill="none" strokeWidth="2.5" strokeLinecap="round"
                  stroke="url(#retro-progress-ring)"
                  strokeDasharray={2 * Math.PI * 13}
                  strokeDashoffset={2 * Math.PI * 13 * (1 - (currentPhase + 1) / PHASES.length)}
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="retro-progress-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="var(--primary)" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="relative text-[11px] font-extrabold tabular-nums bg-gradient-to-br from-accent to-primary bg-clip-text text-transparent">
                {currentPhase + 1}
              </span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted/50">Phase</span>
              <span className="text-xs font-bold tabular-nums text-foreground/80">
                {currentPhase + 1}<span className="text-muted/30 mx-0.5">/</span>{PHASES.length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl backdrop-blur-sm" style={{ background: "linear-gradient(135deg, rgba(6, 194, 134, 0.08) 0%, rgba(0, 50, 150, 0.06) 100%)", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
          <span className="retro-active-node">{PHASES[currentPhase].icon("w-4 h-4")}</span>
          <span className="text-xs font-bold text-accent tracking-tight">{PHASES[currentPhase].label}</span>
        </div>
      </div>

      <div className="relative flex items-center justify-between overflow-x-auto pb-2 -mb-2">
        <div className="absolute top-[18px] left-5 right-5 h-[3px] rounded-full bg-card-border/20" />
        <div
          className="absolute top-[18px] left-5 h-[3px] rounded-full transition-all duration-700 ease-out overflow-hidden"
          style={{
            width: `calc(${progressPct}% - 40px + ${currentPhase === PHASES.length - 1 ? "40px" : "0px"})`,
            background: "linear-gradient(90deg, var(--accent) 0%, var(--primary) 50%, var(--accent) 100%)",
            backgroundSize: "200% 100%",
            animation: "retroGradientShift 3s ease-in-out infinite",
            boxShadow: "0 0 16px rgba(6, 194, 134, 0.35), 0 0 6px rgba(0, 50, 150, 0.15)",
          }}
        />

        {PHASES.map((phase) => {
          const done = phase.id < currentPhase;
          const active = phase.id === currentPhase;
          return (
            <div key={phase.id} className="relative z-10 flex flex-col items-center" style={{ width: 36 }}>
              {active && (
                <>
                  <div className="absolute top-0 left-[2px] w-9 h-9 rounded-full" style={{ animation: "retroPulseRing 2.5s ease-out infinite", background: "radial-gradient(circle, rgba(6, 194, 134, 0.2) 0%, transparent 70%)" }} />
                  <div className="absolute -inset-1.5 rounded-full bg-accent/8 blur-lg" />
                </>
              )}
              <div
                className={`relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  done
                    ? "bg-gradient-to-br from-accent to-primary text-white shadow-md shadow-accent/20"
                    : active
                    ? "bg-gradient-to-br from-accent via-accent to-primary text-white shadow-xl shadow-accent/30 ring-[3px] ring-accent/15 ring-offset-2 ring-offset-transparent"
                    : "bg-white/80 border-2 border-card-border/30 text-muted/50"
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{phase.icon("w-4 h-4")}</span>
                )}
              </div>
              {/* Phase name shown in top-right badge; omitted here to declutter */}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase Header – reusable for every phase                            */
/* ------------------------------------------------------------------ */
function PhaseHeader({ icon, title, description }) {
  return (
    <div className="relative text-center mb-8 retro-phase-in">
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-36 rounded-full bg-gradient-to-br from-primary/10 via-accent/6 to-primary/4 blur-[60px] pointer-events-none" />

      <div className="relative">
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="absolute w-24 h-24 rounded-[20px] bg-gradient-to-br from-primary/15 to-accent/10 blur-2xl retro-icon-pulse" />
          <div className="absolute w-20 h-20 rounded-[18px] bg-gradient-to-br from-accent/8 to-primary/6 blur-xl animate-pulse" style={{ animationDuration: "3s" }} />
          <div className="relative w-[72px] h-[72px] rounded-[18px] flex items-center justify-center" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 247, 244, 0.92) 50%, rgba(230, 236, 247, 0.88) 100%)", border: "1.5px solid rgba(6, 194, 134, 0.18)", boxShadow: "0 12px 40px rgba(0, 50, 100, 0.1), 0 4px 12px rgba(6, 194, 134, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 rgba(0, 50, 100, 0.03)" }}>
            {icon}
          </div>
        </div>

        <h2 className="text-[26px] font-extrabold tracking-tight bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent bg-[length:200%_100%]" style={{ animation: "retroGradientShift 6s ease-in-out infinite" }}>
          {title}
        </h2>
        <p className="text-muted text-[13px] max-w-lg mx-auto mt-3 leading-relaxed font-medium">{description}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase Nav                                                          */
/* ------------------------------------------------------------------ */
function PhaseNav({ onPrev, onNext, nextLabel = "Next Phase" }) {
  if (!onPrev && !onNext) return null;
  return (
    <div className="flex items-center justify-between pt-7 mt-7 border-t border-card-border/20">
      <button
        onClick={onPrev}
        className="group flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-semibold text-muted hover:text-foreground transition-all duration-300 btn-press backdrop-blur-sm"
        style={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(240, 247, 244, 0.6))", border: "1px solid rgba(6, 194, 134, 0.1)", boxShadow: "0 2px 12px rgba(0, 50, 100, 0.04)" }}
      >
        <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Previous
      </button>
      <button
        onClick={onNext}
        className="group relative flex items-center gap-2.5 px-8 py-3 text-white rounded-2xl text-sm font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 btn-press overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--primary) 50%, var(--accent) 100%)", backgroundSize: "200% 100%", animation: "retroGradientShift 4s ease-in-out infinite", boxShadow: "0 8px 30px rgba(6, 194, 134, 0.3), 0 2px 8px rgba(0, 50, 150, 0.15)" }}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        <span className="relative">{nextLabel}</span>
        <svg className="relative w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Slot Machine – Lucky Draw Spinner                                  */
/* ------------------------------------------------------------------ */
function SlotMachine({ employees, readOnly, onSpinTriggered, triggerSpin }) {
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [displayIdx, setDisplayIdx] = useState(0);
  const intervalRef = useRef(null);
  const timeoutChain = useRef([]);
  const spinningRef = useRef(false);

  const runSpinAnimation = useCallback((winnerIdx) => {
    if (spinningRef.current || employees.length === 0) return;
    spinningRef.current = true;
    setSpinning(true);
    setWinner(null);

    let speed = 50;
    let current = 0;
    const totalDuration = 3000;
    let elapsed = 0;

    const clearAllTimeouts = () => {
      timeoutChain.current.forEach(clearTimeout);
      timeoutChain.current = [];
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

    clearAllTimeouts();

    const tick = () => {
      current = (current + 1) % employees.length;
      setDisplayIdx(current);
      elapsed += speed;

      if (elapsed >= totalDuration - 600) {
        speed = Math.min(speed + 30, 400);
      } else if (elapsed >= totalDuration * 0.5) {
        speed = Math.min(speed + 8, 200);
      }

      if (elapsed >= totalDuration) {
        const remaining = (winnerIdx - current + employees.length) % employees.length;
        let delay = speed;
        for (let i = 0; i < remaining; i++) {
          delay += Math.min(delay + 80, 500);
          const step = i;
          const t = setTimeout(() => {
            setDisplayIdx((winnerIdx - remaining + step + 1 + employees.length) % employees.length);
          }, delay * (i + 1) / remaining || delay);
          timeoutChain.current.push(t);
        }
        const finalDelay = delay + 300;
        const t = setTimeout(() => {
          setDisplayIdx(winnerIdx);
          setWinner(employees[winnerIdx]);
          setSpinning(false);
          spinningRef.current = false;
        }, finalDelay);
        timeoutChain.current.push(t);
        return;
      }

      const t = setTimeout(tick, speed);
      timeoutChain.current.push(t);
    };

    tick();
  }, [employees]);

  const spin = useCallback(() => {
    if (spinningRef.current || employees.length === 0) return;
    const winnerIdx = Math.floor(Math.random() * employees.length);
    if (onSpinTriggered) onSpinTriggered(winnerIdx);
    runSpinAnimation(winnerIdx);
  }, [employees, onSpinTriggered, runSpinAnimation]);

  const lastTriggerRef = useRef(null);
  useEffect(() => {
    if (triggerSpin && triggerSpin.ts !== lastTriggerRef.current) {
      lastTriggerRef.current = triggerSpin.ts;
      runSpinAnimation(triggerSpin.winnerIdx);
    }
  }, [triggerSpin, runSpinAnimation]);

  useEffect(() => {
    return () => {
      timeoutChain.current.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (employees.length === 0) return null;

  const current = employees[displayIdx] || employees[0];

  return (
    <div className="relative rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(251, 191, 36, 0.15)", boxShadow: "0 8px 40px rgba(251, 191, 36, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03)" }}>
      <div className="rounded-3xl p-6 space-y-5" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 251, 235, 0.5) 50%, rgba(240, 247, 244, 0.88) 100%)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground flex items-center gap-2.5 text-sm">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/20"><TrophyIcon className="w-4.5 h-4.5 text-white" /></span>
            <span className="tracking-tight">Lucky Draw</span>
          </h3>
          {winner && (
            <span className="text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 rounded-full shadow-md shadow-amber-500/20" style={{ animation: "retroWinnerCelebrate 0.5s ease-out" }}>
              Winner!
            </span>
          )}
        </div>

        {/* Slot window — the main visual */}
        <div className="relative">
          <div
            className={`relative overflow-hidden rounded-2xl transition-all duration-500 ${
              spinning
                ? "shadow-xl shadow-accent/15"
                : winner
                ? "shadow-xl shadow-primary/15"
                : "shadow-md"
            }`}
            style={{
              background: spinning
                ? "linear-gradient(135deg, rgba(6,194,134,0.04), rgba(0,50,150,0.04))"
                : winner
                ? "linear-gradient(135deg, rgba(6,194,134,0.06), rgba(0,50,150,0.06))"
                : "rgba(255,255,255,0.5)",
              border: spinning
                ? "1.5px solid rgba(6,194,134,0.3)"
                : winner
                ? "1.5px solid rgba(6,194,134,0.4)"
                : "1.5px solid rgba(212,228,220,0.6)",
            }}
          >
            {/* Fade edges */}
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/60 to-transparent z-10 pointer-events-none" />

            {/* Side glow indicators when spinning */}
            {spinning && (
              <>
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-transparent via-accent/50 to-transparent z-10 animate-pulse" />
                <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-transparent via-accent/50 to-transparent z-10 animate-pulse" />
              </>
            )}

            <div className="py-6 flex flex-col items-center justify-center min-h-[130px]">
              {/* Previous name */}
              <div className="text-muted/25 text-sm font-medium mb-3 h-5 transition-all duration-150">
                {employees[(displayIdx - 1 + employees.length) % employees.length]?.name}
              </div>

              {/* Current – center slot */}
              <div
                className={`flex items-center gap-4 px-8 py-4 rounded-2xl transition-all duration-300 ${
                  winner
                    ? "scale-105"
                    : spinning
                    ? "scale-100"
                    : ""
                }`}
                style={
                  winner
                    ? { background: "linear-gradient(135deg, rgba(6,194,134,0.12), rgba(0,50,150,0.08))", animation: "retroWinnerCelebrate 0.5s ease-out" }
                    : spinning
                    ? { background: "rgba(0,50,150,0.03)" }
                    : { background: "rgba(212,228,220,0.2)" }
                }
              >
                {current.avatar_url ? (
                  <img
                    src={current.avatar_url}
                    alt=""
                    className={`w-12 h-12 rounded-full object-cover shadow-md transition-all duration-300 ${
                      winner ? "ring-3 ring-primary/30 ring-offset-2" : spinning ? "ring-2 ring-accent/20 ring-offset-1" : "ring-2 ring-white"
                    }`}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shadow-md transition-all duration-300 ${
                    winner
                      ? "bg-gradient-to-br from-primary to-accent text-white ring-3 ring-primary/30 ring-offset-2"
                      : spinning
                      ? "bg-gradient-to-br from-accent/20 to-accent/10 text-accent ring-2 ring-accent/20 ring-offset-1"
                      : "bg-white text-muted ring-2 ring-card-border"
                  }`}>
                    {current.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                <span className={`text-lg font-bold transition-colors duration-300 ${
                  winner ? "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent" : "text-foreground"
                }`}>
                  {current.name}
                </span>
                {winner && (
                  <span style={{ animation: "retroFloat 2s ease-in-out infinite" }}><SparklesIcon className="w-6 h-6" /></span>
                )}
              </div>

              {/* Next name */}
              <div className="text-muted/25 text-sm font-medium mt-3 h-5 transition-all duration-150">
                {employees[(displayIdx + 1) % employees.length]?.name}
              </div>
            </div>
          </div>
        </div>

        {/* Spin button — gradient with shimmer (hidden in readOnly mode) */}
        {!readOnly && (
          <button
            onClick={spin}
            disabled={spinning}
            className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all btn-press btn-shimmer ${
              spinning
                ? "bg-accent/15 text-accent cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.01]"
            }`}
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Spinning...
              </span>
            ) : winner ? (
              <span className="inline-flex items-center gap-1.5"><TrophyIcon className="w-4 h-4" /> Spin Again</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><TrophyIcon className="w-4 h-4" /> Spin the Wheel!</span>
            )}
          </button>
        )}
        {readOnly && spinning && (
          <div className="w-full py-3.5 rounded-2xl text-sm font-bold bg-accent/10 text-accent text-center">
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Spinning...
            </span>
          </div>
        )}

        {/* Employee avatars — more refined */}
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {employees.map((emp, idx) => (
            <div
              key={emp.id}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                winner?.id === emp.id
                  ? "ring-2 ring-primary ring-offset-2 scale-110 shadow-lg shadow-primary/25"
                  : displayIdx === idx && spinning
                  ? "ring-2 ring-accent/50 ring-offset-1 scale-105"
                  : "ring-1 ring-card-border/50"
              }`}
              title={emp.name}
              style={
                winner?.id === emp.id
                  ? { background: "linear-gradient(135deg, var(--primary), var(--accent))", color: "white" }
                  : displayIdx === idx && spinning
                  ? { background: "linear-gradient(135deg, rgba(0,50,150,0.1), rgba(6,194,134,0.1))", color: "var(--accent)" }
                  : { background: "rgba(255,255,255,0.7)", color: "var(--muted)" }
              }
            >
              {emp.avatar_url ? (
                <img src={emp.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                emp.name?.charAt(0)?.toUpperCase() || "?"
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 0 – Ice Breaker                                              */
/* ------------------------------------------------------------------ */
const ICE_THEME_IDS = [
  "sprint_fun", "team_bonding", "creative_thinking", "gratitude",
  "energy_check", "random_fun", "movie_music", "food_travel",
];

function randomTheme() {
  return ICE_THEME_IDS[Math.floor(Math.random() * ICE_THEME_IDS.length)];
}

function IceBreakerPhase({ employees, onNext, broadcastIcebreakerState, broadcastSpin }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [source, setSource] = useState(null);
  const fetchIdRef = useRef(0);

  const fetchQuestions = useCallback(async () => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    if (broadcastIcebreakerState) broadcastIcebreakerState({ loading: true, questions: [], currentQ: 0, source: null });
    try {
      const res = await fetch("/api/retro/icebreaker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5, theme: randomTheme() }),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (id !== fetchIdRef.current) return;
      setQuestions(data.questions);
      setSource(data.source || "groq");
      setCurrentQ(0);
      if (broadcastIcebreakerState) broadcastIcebreakerState({ questions: data.questions, currentQ: 0, source: data.source || "groq", loading: false });
    } catch {
      if (id === fetchIdRef.current) setError("Could not load questions. Please try again.");
      if (broadcastIcebreakerState) broadcastIcebreakerState({ loading: false, questions: [], currentQ: 0, source: null });
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, [broadcastIcebreakerState]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const prevQ = () => {
    setCurrentQ((c) => {
      const newIdx = Math.max(c - 1, 0);
      if (broadcastIcebreakerState) broadcastIcebreakerState({ questions, currentQ: newIdx, source, loading: false });
      return newIdx;
    });
  };
  const nextQ = () => {
    setCurrentQ((c) => {
      const newIdx = Math.min(c + 1, questions.length - 1);
      if (broadcastIcebreakerState) broadcastIcebreakerState({ questions, currentQ: newIdx, source, loading: false });
      return newIdx;
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 relative">
      <div className="absolute -top-16 -right-24 w-48 h-48 rounded-full bg-gradient-to-br from-primary/8 to-transparent blur-3xl pointer-events-none retro-float-slow" />
      <div className="absolute -bottom-16 -left-20 w-40 h-40 rounded-full bg-gradient-to-tr from-accent/8 to-transparent blur-3xl pointer-events-none retro-float-reverse" />

      <PhaseHeader
        icon={<DiceIcon className="w-8 h-8" />}
        title="Ice Breaker"
        description="AI-generated questions — hit shuffle for a fresh set if you don't like these!"
      />

      {loading && (
        <div className="flex flex-col items-center gap-5 py-20 retro-slide-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 blur-lg" />
            <div className="absolute inset-0 rounded-full border-2 border-card-border/40" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-primary/30 border-b-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-muted text-sm font-medium">Generating questions...</p>
            <p className="text-muted/60 text-xs">Powered by Groq AI</p>
          </div>
        </div>
      )}

      {error && (
        <div className="retro-glass rounded-3xl p-6 text-center border border-red-200/60 retro-slide-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-danger/10 mb-3"><WarningIcon className="w-6 h-6 text-danger" /></div>
          <p className="text-danger text-sm font-medium">{error}</p>
          <button
            onClick={fetchQuestions}
            className="mt-4 px-6 py-2.5 bg-danger/10 text-danger rounded-xl text-sm font-semibold hover:bg-danger/20 transition-all btn-press"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && questions.length > 0 && (
        <>
          {/* Question Card */}
          <div className="retro-slide-in-delay-1">
            <div className="relative rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(6, 194, 134, 0.12)", boxShadow: "0 12px 48px rgba(0, 50, 100, 0.08), 0 2px 8px rgba(6, 194, 134, 0.04)" }}>
              <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(240, 247, 244, 0.92) 50%, rgba(230, 236, 247, 0.88) 100%)" }}>
                <div className="relative px-6 py-4 flex items-center justify-between">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
                  <span className="relative inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-accent to-primary text-white text-[10px] font-black shadow-sm">
                      {currentQ + 1}
                    </span>
                    <span className="text-muted/60">of {questions.length}</span>
                    {source === "groq" && (
                      <>
                        <span className="text-muted/30 mx-0.5">·</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent/8 text-accent/80 normal-case tracking-normal font-semibold text-[10px]">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          AI Generated
                        </span>
                      </>
                    )}
                  </span>
                  <button
                    onClick={fetchQuestions}
                    className="relative group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-accent hover:bg-accent/5 transition-all duration-200"
                  >
                    <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Shuffle
                  </button>
                </div>

                <div className="relative px-10 py-12 min-h-[180px] flex items-center justify-center">
                  <div className="absolute top-4 left-7 text-6xl text-accent/8 font-serif select-none leading-none">&ldquo;</div>
                  <div className="absolute bottom-4 right-7 text-6xl text-accent/8 font-serif select-none leading-none">&rdquo;</div>
                  <p
                    key={`${currentQ}-${questions[currentQ]}`}
                    className="relative text-xl font-semibold text-foreground text-center leading-relaxed max-w-lg"
                    style={{ animation: "retroSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
                  >
                    {questions[currentQ]}
                  </p>
                </div>

                <div className="px-6 py-4 flex items-center justify-between border-t border-card-border/20">
                  <button
                    onClick={prevQ}
                    disabled={currentQ === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-white/60 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed btn-press"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Prev
                  </button>

                  <div className="flex items-center gap-2">
                    {questions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentQ(idx)}
                        className={`rounded-full transition-all duration-500 ease-out ${
                          idx === currentQ
                            ? "w-8 h-2.5 bg-gradient-to-r from-accent to-primary shadow-md shadow-accent/25"
                            : "w-2.5 h-2.5 bg-card-border/40 hover:bg-muted/40 hover:scale-125"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={nextQ}
                    disabled={currentQ === questions.length - 1}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-white/60 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed btn-press"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lucky Draw */}
          <div className="retro-slide-in-delay-2">
            <SlotMachine employees={employees} onSpinTriggered={broadcastSpin} />
          </div>

          {/* Phase nav */}
          {onNext && (
            <div className="flex items-center justify-end pt-4 mt-2">
              <button
                onClick={onNext}
                className="group flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-2xl text-sm font-semibold shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:scale-[1.02] transition-all btn-press"
              >
                Next Phase
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Employee Ice Breaker View – read-only, synced from admin            */
/* ------------------------------------------------------------------ */
function EmployeeIceBreakerView({ employees, icebreakerState, spinTrigger }) {
  if (!icebreakerState) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 relative">
        <div className="absolute -top-16 -right-24 w-48 h-48 rounded-full bg-gradient-to-br from-primary/8 to-transparent blur-3xl pointer-events-none retro-float-slow" />
        <div className="absolute -bottom-16 -left-20 w-40 h-40 rounded-full bg-gradient-to-tr from-accent/8 to-transparent blur-3xl pointer-events-none retro-float-reverse" />
        <PhaseHeader icon={<DiceIcon className="w-8 h-8" />} title="Ice Breaker" description="Waiting for the facilitator to start..." />
        <div className="flex flex-col items-center gap-5 py-16 retro-slide-in">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 blur-lg" />
            <div className="absolute inset-0 rounded-full border-2 border-card-border/40" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <p className="text-muted text-sm font-medium">Syncing with facilitator...</p>
        </div>
      </div>
    );
  }

  const { questions, currentQ, source, loading } = icebreakerState;

  return (
    <div className="max-w-2xl mx-auto space-y-8 relative">
      <div className="absolute -top-16 -right-24 w-48 h-48 rounded-full bg-gradient-to-br from-primary/8 to-transparent blur-3xl pointer-events-none retro-float-slow" />
      <div className="absolute -bottom-16 -left-20 w-40 h-40 rounded-full bg-gradient-to-tr from-accent/8 to-transparent blur-3xl pointer-events-none retro-float-reverse" />

      <PhaseHeader icon={<DiceIcon className="w-8 h-8" />} title="Ice Breaker" description="Live from the facilitator — enjoy the fun!" />

      {loading && (
        <div className="flex flex-col items-center gap-5 py-20 retro-slide-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 blur-lg" />
            <div className="absolute inset-0 rounded-full border-2 border-card-border/40" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-primary/30 border-b-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-muted text-sm font-medium">Generating questions...</p>
            <p className="text-muted/60 text-xs">Powered by Groq AI</p>
          </div>
        </div>
      )}

      {!loading && questions && questions.length > 0 && (
        <>
          {/* Question Card -- read-only */}
          <div className="retro-slide-in-delay-1">
            <div className="relative retro-gradient-border rounded-3xl overflow-hidden retro-glow">
              <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.96), rgba(230, 236, 247, 0.92))" }}>
                <div className="relative px-6 py-4 flex items-center justify-between">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-transparent to-accent/8" />
                  <span className="relative inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-primary to-accent text-white text-[10px] font-black">
                      {currentQ + 1}
                    </span>
                    <span className="text-muted">of {questions.length}</span>
                    {source === "groq" && (
                      <>
                        <span className="text-muted/50 mx-1">·</span>
                        <span className="inline-flex items-center gap-1 text-accent/70 normal-case tracking-normal font-semibold">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          AI
                        </span>
                      </>
                    )}
                  </span>
                  <span className="relative inline-flex items-center gap-1.5 text-[10px] font-bold text-accent/70 bg-gradient-to-r from-accent/10 to-primary/10 px-3 py-1.5 rounded-full shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    LIVE
                  </span>
                </div>

                <div className="relative px-8 py-10 min-h-[160px] flex items-center justify-center">
                  <div className="absolute top-4 left-6 text-5xl text-primary/10 font-serif select-none">&ldquo;</div>
                  <div className="absolute bottom-4 right-6 text-5xl text-primary/10 font-serif select-none">&rdquo;</div>
                  <p
                    key={`${currentQ}-${questions[currentQ]}`}
                    className="relative text-xl font-semibold text-foreground text-center leading-relaxed max-w-lg"
                    style={{ animation: "retroSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
                  >
                    {questions[currentQ]}
                  </p>
                </div>

                <div className="px-6 py-4 flex items-center justify-center border-t border-card-border/30">
                  <div className="flex items-center gap-2">
                    {questions.map((_, idx) => (
                      <div
                        key={idx}
                        className={`rounded-full transition-all duration-500 ease-out ${
                          idx === currentQ
                            ? "w-8 h-2.5 bg-gradient-to-r from-primary to-accent shadow-md shadow-accent/30"
                            : "w-2.5 h-2.5 bg-card-border/60"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lucky Draw — read-only, synced */}
          <div className="retro-slide-in-delay-2">
            <SlotMachine employees={employees} readOnly triggerSpin={spinTrigger} />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 1 – Set the Stage                                            */
/* ------------------------------------------------------------------ */
const MOODS = [
  { emoji: (cls = "w-6 h-6") => <FaceGreatIcon className={cls} />, label: "Great", bg: "from-emerald-400/15 to-emerald-500/8", border: "border-emerald-400/40", text: "text-emerald-600", bar: "bg-emerald-500", glow: "rgba(16, 185, 129, 0.15)" },
  { emoji: (cls = "w-6 h-6") => <FaceGoodIcon className={cls} />, label: "Good", bg: "from-blue-400/15 to-blue-500/8", border: "border-blue-400/40", text: "text-blue-600", bar: "bg-blue-500", glow: "rgba(59, 130, 246, 0.15)" },
  { emoji: (cls = "w-6 h-6") => <FaceNeutralIcon className={cls} />, label: "Neutral", bg: "from-amber-400/15 to-amber-500/8", border: "border-amber-400/40", text: "text-amber-600", bar: "bg-amber-500", glow: "rgba(245, 158, 11, 0.15)" },
  { emoji: (cls = "w-6 h-6") => <FaceConcernedIcon className={cls} />, label: "Concerned", bg: "from-orange-400/15 to-orange-500/8", border: "border-orange-400/40", text: "text-orange-600", bar: "bg-orange-500", glow: "rgba(249, 115, 22, 0.15)" },
  { emoji: (cls = "w-6 h-6") => <FaceFrustratedIcon className={cls} />, label: "Frustrated", bg: "from-red-400/15 to-red-500/8", border: "border-red-400/40", text: "text-red-600", bar: "bg-red-500", glow: "rgba(239, 68, 68, 0.15)" },
];

const getMoodObj = (label) => MOODS.find((m) => m.label === label);

function useAccessToken() {
  const [token, setToken] = useState(null);
  useEffect(() => {
    let cancelled = false;
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!cancelled && session) setToken(session.access_token);
      });
      supabase.auth.onAuthStateChange((_event, session) => {
        if (!cancelled && session) setToken(session.access_token);
      });
    });
    return () => { cancelled = true; };
  }, []);
  return token;
}

/* Employee mood picker (shown to ALL employees) */
function EmployeeMoodPicker({ actionEvent }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [moods, setMoods] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMy, setLoadingMy] = useState(true);

  useEffect(() => {
    if (!token || !sessionId) { setLoadingMy(false); return; }
    fetch(`/api/retro/mood?session_id=${sessionId}&_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.myMood) {
          setSelected(d.myMood);
          setSubmitted(true);
        }
      })
      .finally(() => setLoadingMy(false));
  }, [token, sessionId]);

  useEffect(() => {
    if (!actionEvent || actionEvent.type !== "mood_reveal") return;
    setRevealed(true);
    if (!token || !sessionId) return;
    fetch(`/api/retro/mood?session_id=${sessionId}&_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setMoods(d.moods || []))
      .catch((err) => console.error("fetchMoods error:", err));
  }, [actionEvent, token, sessionId]);

  const submit = async () => {
    if (!selected || !token || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/retro/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mood: selected, session_id: sessionId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Employee mood submit error:", errData.error || res.statusText);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Employee mood submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const changeVote = () => {
    setSubmitted(false);
  };

  if (loadingMy) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (submitted) {
    const m = getMoodObj(selected);

    const moodCounts = MOODS.map((mo) => ({
      ...mo,
      count: moods.filter((v) => v.mood === mo.label).length,
    }));
    const maxCount = Math.max(...moodCounts.map((mo) => mo.count), 1);
    const totalSubmitted = moods.length;

    return (
      <div className={`${revealed ? "max-w-3xl" : "max-w-md"} mx-auto text-center space-y-5`}>
        <PhaseHeader
          icon={<TargetIcon className="w-8 h-8" />}
          title="Set the Stage"
          description={revealed ? "Here's how the team is feeling." : "Your mood has been recorded. Waiting for the facilitator to reveal results."}
        />
        <div
          className={`inline-flex flex-col items-center gap-3 px-10 py-6 rounded-2xl border-2 bg-gradient-to-b ${m?.bg || ""} ${m?.border || ""}`}
          style={{ animation: "fadeInScale 0.3s ease-out" }}
        >
          <span>{m?.emoji("w-12 h-12")}</span>
          <span className={`text-sm font-bold ${m?.text}`}>{m?.label}</span>
        </div>
        {!revealed && (
          <button
            onClick={changeVote}
            className="text-xs text-muted hover:text-accent underline underline-offset-2 transition-colors"
          >
            Change my response
          </button>
        )}

        {revealed && (
          <div
            className="retro-gradient-border rounded-2xl overflow-hidden text-left"
            style={{ animation: "retroSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <div className="rounded-2xl p-5 space-y-4" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                Team Sentiment Matrix
              </h3>

              <div className="space-y-3">
                {moodCounts.map((mc) => (
                  <div key={mc.label} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <span>{mc.emoji("w-5 h-5")}</span>
                      <span className={`text-xs font-semibold ${mc.text}`}>{mc.label}</span>
                    </div>
                    <div className="flex-1 h-7 bg-card-border/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${mc.bar} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max((mc.count / maxCount) * 100, mc.count > 0 ? 12 : 0)}%`, opacity: 0.8 }}
                      >
                        {mc.count > 0 && (
                          <span className="text-[10px] font-bold text-white">{mc.count}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-muted w-8 text-right">
                      {totalSubmitted > 0 ? Math.round((mc.count / totalSubmitted) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-card-border/60 pt-4 mt-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Individual Responses</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {moods.map((entry) => {
                    const em = getMoodObj(entry.mood);
                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r ${em?.bg || ""} border ${em?.border || "border-card-border"}`}
                        style={{ animation: "fadeInUp 0.3s ease-out both" }}
                      >
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-[10px] font-bold text-muted">
                            {entry.user_name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{entry.user_name}</span>
                        <span>{em?.emoji("w-5 h-5")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <PhaseHeader
        icon={<TargetIcon className="w-8 h-8" />}
        title="Set the Stage"
        description="How are you feeling about the last sprint? Pick the icon that matches your mood."
      />

      <div className="flex justify-center gap-3 py-3">
        {MOODS.map((m) => (
          <button
            key={m.label}
            onClick={() => setSelected(m.label)}
            className={`flex flex-col items-center gap-3 px-5 py-6 rounded-2xl border-2 transition-all duration-300 btn-press ${
              selected === m.label
                ? `bg-gradient-to-b ${m.bg} ${m.border} scale-110 shadow-xl ring-4 ring-offset-2 ${m.border.replace("border-", "ring-")}/15`
                : "hover:shadow-lg hover:scale-105 hover:-translate-y-1.5"
            }`}
            style={selected !== m.label ? { background: "linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.8))", borderColor: "rgba(0, 0, 0, 0.06)" } : { boxShadow: `0 12px 32px ${m.glow || "rgba(0,0,0,0.1)"}, 0 4px 12px rgba(0,0,0,0.04)` }}
          >
            <span className={`transition-transform duration-300 ${selected === m.label ? "scale-125" : ""}`}>
              {m.emoji("w-10 h-10")}
            </span>
            <span className={`text-[11px] font-bold tracking-wide ${selected === m.label ? m.text : "text-muted/70"}`}>
              {m.label}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={!selected || submitting}
        className="w-full py-3.5 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 disabled:opacity-35 disabled:shadow-none btn-press overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)", boxShadow: "0 8px 24px rgba(6, 194, 134, 0.25)" }}
      >
        <span className="relative z-10">{submitting ? "Submitting..." : "Submit My Mood"}</span>
      </button>
    </div>
  );
}

/* Admin view: live tracker + reveal */
function SetTheStageAdmin({ employees, onNext, onPrev, actionEvent, broadcastAction }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [moods, setMoods] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [polling, setPolling] = useState(true);
  const [myMood, setMyMood] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!actionEvent || actionEvent.type !== "mood_reveal") return;
    setRevealed(true);
    setPolling(false);
  }, [actionEvent]);

  const fetchMoods = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const res = await fetch(`/api/retro/mood?session_id=${sessionId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      setMoods(data.moods || []);
      if (data.myMood) setMyMood(data.myMood);
    } catch (err) { console.error("fetchMoods error:", err); }
  }, [token, sessionId]);

  useEffect(() => {
    if (!token || !sessionId) return;
    fetchMoods();
    if (!polling) return;
    const id = setInterval(fetchMoods, 2000);
    return () => clearInterval(id);
  }, [token, sessionId, fetchMoods, polling]);

  const submitMyMood = async (mood) => {
    if (!token || !sessionId) return;
    setMyMood(mood);
    setSubmitting(true);
    try {
      const res = await fetch("/api/retro/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mood, session_id: sessionId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("submitMyMood API error:", errData.error || res.statusText);
        setMyMood(null);
        return;
      }
      const res2 = await fetch(`/api/retro/mood?session_id=${sessionId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res2.json();
      setMoods(data.moods || []);
      if (data.myMood) setMyMood(data.myMood);
    } catch (err) {
      console.error("submitMyMood error:", err);
      setMyMood(null);
    } finally {
      setSubmitting(false);
    }
  };

  const totalEmployees = employees.length;
  const totalSubmitted = moods.length;
  const totalPending = Math.max(totalEmployees - totalSubmitted, 0);
  const pct = totalEmployees > 0 ? Math.round((totalSubmitted / totalEmployees) * 100) : 0;

  const moodCounts = MOODS.map((m) => ({
    ...m,
    count: moods.filter((v) => v.mood === m.label).length,
  }));
  const maxCount = Math.max(...moodCounts.map((m) => m.count), 1);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PhaseHeader
        icon={<TargetIcon className="w-8 h-8" />}
        title="Set the Stage"
        description="Submit your mood, wait for the team, then reveal results."
      />

      {/* Admin's own mood picker */}
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.85))", border: "1px solid rgba(0, 0, 0, 0.05)", boxShadow: "0 4px 20px rgba(0, 50, 100, 0.05)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground tracking-tight">Your Mood</h3>
          {myMood && (
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Submitted
            </span>
          )}
        </div>
        <div className="flex justify-center gap-2.5">
          {MOODS.map((m) => (
            <button
              key={m.label}
              onClick={() => submitMyMood(m.label)}
              disabled={submitting}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all duration-300 btn-press backdrop-blur-sm ${
                myMood === m.label
                  ? `bg-gradient-to-b ${m.bg} ${m.border} scale-110 shadow-lg`
                  : "border-white/50 bg-white/40 hover:bg-white/60 hover:shadow-md hover:scale-105"
              }`}
            >
              <span className={`transition-transform duration-300 ${myMood === m.label ? "scale-110" : ""}`}>
                {m.emoji("w-7 h-7")}
              </span>
              <span className={`text-[9px] font-semibold ${myMood === m.label ? m.text : "text-muted"}`}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Live tracker card */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.85))", border: "1px solid rgba(0, 0, 0, 0.05)", boxShadow: "0 4px 20px rgba(0, 50, 100, 0.05)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 tracking-tight">
            <span className={`w-2.5 h-2.5 rounded-full ${polling ? "bg-green-500 animate-pulse shadow-sm shadow-green-500/50" : "bg-card-border"}`} />
            Live Tracker
          </h3>
          <button onClick={fetchMoods} className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Progress ring + numbers */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-card-border" />
              <circle
                cx="60" cy="60" r="50" fill="none" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={314}
                strokeDashoffset={314 - (314 * pct) / 100}
                className="text-primary transition-all duration-700 ease-out"
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-foreground">{pct}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Submitted</span>
              <span className="text-lg font-bold text-primary">{totalSubmitted}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Pending</span>
              <span className="text-lg font-bold text-danger">{totalPending}</span>
            </div>
            <div className="flex items-center justify-between border-t border-card-border/60 pt-2">
              <span className="text-sm text-muted">Total Team</span>
              <span className="text-lg font-bold text-foreground">{totalEmployees}</span>
            </div>
          </div>
        </div>

        {/* Submitted avatars strip */}
        {totalSubmitted > 0 && (
          <div className="flex items-center gap-1 pt-1">
            <span className="text-[10px] text-muted font-medium mr-1">Submitted:</span>
            <div className="flex -space-x-2">
              {moods.slice(0, 12).map((m) => (
                <div
                  key={m.user_id}
                  className="w-7 h-7 rounded-full border-2 border-card bg-card-border flex items-center justify-center text-[9px] font-bold text-muted"
                  title={m.user_name}
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    m.user_name?.charAt(0)?.toUpperCase() || "?"
                  )}
                </div>
              ))}
              {totalSubmitted > 12 && (
                <div className="w-7 h-7 rounded-full border-2 border-card bg-card-border flex items-center justify-center text-[9px] font-bold text-muted">
                  +{totalSubmitted - 12}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reveal button */}
      {!revealed && (
        <button
          onClick={() => {
            setRevealed(true);
            setPolling(false);
            if (broadcastAction) broadcastAction({ type: "mood_reveal" });
          }}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-orange-500/25 transition-all btn-press"
        >
          <span className="inline-flex items-center gap-1.5"><SparklesIcon className="w-4 h-4" /> Reveal Results ({totalSubmitted} response{totalSubmitted !== 1 ? "s" : ""})</span>
        </button>
      )}

      {/* Revealed results matrix */}
      {revealed && (
        <div
          className="retro-gradient-border rounded-2xl overflow-hidden"
          style={{ animation: "retroSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            Team Sentiment Matrix
          </h3>

          {/* Bar chart */}
          <div className="space-y-3">
            {moodCounts.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <span>{m.emoji("w-5 h-5")}</span>
                  <span className={`text-xs font-semibold ${m.text}`}>{m.label}</span>
                </div>
                <div className="flex-1 h-7 bg-card-border/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${m.bar} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                    style={{ width: `${Math.max((m.count / maxCount) * 100, m.count > 0 ? 12 : 0)}%`, opacity: 0.8 }}
                  >
                    {m.count > 0 && (
                      <span className="text-[10px] font-bold text-white">{m.count}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-muted w-8 text-right">
                  {totalSubmitted > 0 ? Math.round((m.count / totalSubmitted) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>

          {/* Individual responses */}
          <div className="border-t border-card-border/60 pt-4 mt-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Individual Responses</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {moods.map((entry) => {
                const m = getMoodObj(entry.mood);
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r ${m?.bg || ""} border ${m?.border || "border-card-border"}`}
                    style={{ animation: "fadeInUp 0.3s ease-out both" }}
                  >
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-[10px] font-bold text-muted">
                        {entry.user_name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{entry.user_name}</span>
                    <span>{m?.emoji("w-5 h-5")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>
      )}

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* Wrapper that picks the right view based on role */
function SetTheStagePhase({ employees, role, onNext, onPrev, actionEvent, broadcastAction }) {
  const isAdmin = role === "scrum_master" || role === "super_admin";
  if (isAdmin) return <SetTheStageAdmin employees={employees} onNext={onNext} onPrev={onPrev} actionEvent={actionEvent} broadcastAction={broadcastAction} />;
  return <EmployeeMoodPicker actionEvent={actionEvent} />;
}

/* ------------------------------------------------------------------ */
/*  Phase 2 – Previous Open Actions                                    */
/* ------------------------------------------------------------------ */
function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));

  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diff < 0) return { text: formatted, color: "text-red-500 bg-red-50", label: `${Math.abs(diff)}d overdue` };
  if (diff === 0) return { text: formatted, color: "text-orange-500 bg-orange-50", label: "Due today" };
  if (diff <= 3) return { text: formatted, color: "text-yellow-600 bg-yellow-50", label: `${diff}d left` };
  return { text: formatted, color: "text-muted bg-card-border/30", label: `${diff}d left` };
}

function PreviousOpenActionsPhase({ employees, role, onNext, onPrev, toggleEvent, broadcastToggle }) {
  const token = useAccessToken();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const canToggle = role === "scrum_master" || role === "super_admin";

  useEffect(() => {
    fetch("/api/retro/open-actions")
      .then((r) => r.json())
      .then((d) => setActions(d.actions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toggleEvent) return;
    setActions((prev) =>
      prev.map((a) => (a.id === toggleEvent.id ? { ...a, done: toggleEvent.done } : a))
    );
  }, [toggleEvent]);

  const toggleDone = async (id) => {
    if (!canToggle) return;
    const item = actions.find((a) => a.id === id);
    if (!item || !token) return;
    const newDone = !item.done;
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, done: newDone } : a)));
    broadcastToggle(id, newDone);
    try {
      await fetch("/api/retro/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, done: newDone }),
      });
    } catch {}
  };

  const doneCount = actions.filter((a) => a.done).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PhaseHeader
        icon={<PinIcon className="w-8 h-8" />}
        title="Previous Open Actions"
        description="Review action items from past retrospectives. Mark completed tasks with the checkmark."
      />

      {loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-card-border" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <p className="text-muted text-sm">Loading open actions...</p>
        </div>
      )}

      {!loading && actions.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <SparklesIcon className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-foreground font-semibold mb-1">No Open Actions</h3>
          <p className="text-muted text-sm">No action items from previous retrospectives. Fresh start!</p>
        </div>
      )}

      {!loading && actions.length > 0 && (
        <div className="rounded-2xl overflow-hidden retro-slide-in-delay-1" style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 252, 0.85) 100%)", border: "1px solid rgba(0, 0, 0, 0.05)", boxShadow: "0 4px 24px rgba(0, 50, 100, 0.05), 0 1px 3px rgba(0, 50, 100, 0.03)" }}>
          <div className="overflow-x-auto">
          <div className="grid grid-cols-[40px_1fr_140px_110px] gap-3 px-5 py-3.5 border-b border-card-border/20 text-[10px] font-bold text-muted/60 uppercase tracking-[0.1em] min-w-[500px]" style={{ background: "rgba(248, 250, 252, 0.7)" }}>
            <span></span>
            <span>Action</span>
            <span>Assignee</span>
            <span className="text-right">Due Date</span>
          </div>

          <div className="divide-y divide-card-border/60">
            {actions.map((a) => {
              const due = a.due_date ? formatDueDate(a.due_date) : null;
              const assigneeNames = a.assignee ? a.assignee.split(", ") : [];
              const empMatches = assigneeNames.map((n) => employees.find((e) => e.name === n)).filter(Boolean);
              const isDone = !!a.done;
              return (
                <div
                  key={a.id}
                  className={`grid grid-cols-[40px_1fr_140px_110px] gap-3 px-5 py-3.5 items-center transition-all duration-300 min-w-[500px] ${
                    isDone
                      ? "bg-emerald-50 border-l-4 border-l-emerald-500"
                      : "hover:bg-card-border/10"
                  }`}
                >
                  {canToggle ? (
                    <button
                      onClick={() => toggleDone(a.id)}
                      className="flex-shrink-0 group/check"
                      title={isDone ? "Mark as incomplete" : "Mark as completed"}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                          isDone
                            ? "bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200"
                            : "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 group-hover/check:scale-110"
                        }`}
                      >
                        <svg
                          className={`w-4 h-4 transition-all duration-300 ${
                            isDone ? "text-white scale-100" : "text-transparent group-hover/check:text-emerald-300 scale-75"
                          }`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <div
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center ${
                        isDone
                          ? "bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200"
                          : "border-gray-300"
                      }`}
                    >
                      <svg
                        className={`w-4 h-4 ${isDone ? "text-white" : "text-transparent"}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate transition-all duration-300 ${isDone ? "line-through text-emerald-700/70" : "text-foreground"}`}>{a.content}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] ${isDone ? "text-emerald-600/50" : "text-muted"}`}>added by {a.user_name}</span>
                      <span className="text-[10px] text-muted/40">·</span>
                      <span className={`text-[10px] ${isDone ? "text-emerald-600/50" : "text-muted/60"}`}>{a.session_date}</span>
                      {isDone && <span className="text-[10px] font-semibold text-emerald-600 ml-1 inline-flex items-center gap-0.5"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg> Completed</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    {empMatches.length > 0 ? (
                      <div className="flex -space-x-1.5 flex-shrink-0">
                        {empMatches.slice(0, 3).map((emp) =>
                          emp.avatar_url ? (
                            <img key={emp.id} src={emp.avatar_url} alt={emp.name} title={emp.name} className={`w-7 h-7 rounded-full object-cover border flex-shrink-0 ${isDone ? "border-emerald-300 opacity-70" : "border-card-border"}`} />
                          ) : (
                            <div key={emp.id} title={emp.name} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-white ${isDone ? "bg-emerald-200 text-emerald-700" : "bg-card-border text-muted"}`}>
                              {emp.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )
                        )}
                        {empMatches.length > 3 && (
                          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent border border-white flex-shrink-0">
                            +{empMatches.length - 3}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isDone ? "bg-emerald-200 text-emerald-700" : "bg-card-border text-muted"}`}>
                        {(a.assignee || a.user_name)?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span className={`text-xs font-medium truncate ${isDone ? "text-emerald-700/70" : "text-foreground"}`}>
                      {assigneeNames.length > 1 ? `${assigneeNames.length} people` : (a.assignee || a.user_name)}
                    </span>
                  </div>

                  <div className="text-right">
                    {isDone ? (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">Done</span>
                    ) : due ? (
                      <div className="inline-flex flex-col items-end">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${due.color}`}>{due.text}</span>
                        <span className={`text-[10px] mt-0.5 ${due.color.split(" ")[0]}`}>{due.label}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted/50">No date</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          </div>
          <div className="px-5 py-3 bg-card-border/10 border-t border-card-border flex items-center justify-between">
            <span className="text-xs text-muted">{actions.length} action item{actions.length !== 1 ? "s" : ""} from past retros</span>
            {doneCount > 0 && (
              <span className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-0.5">{doneCount} completed <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg></span>
            )}
          </div>
        </div>
      )}

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable – Text Collection Phase                                   */
/* ------------------------------------------------------------------ */
function useRetroItems(phase, { all = false } = {}) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    if (!all && !sessionId) { setLoading(false); return; }
    try {
      let url = `/api/retro/items?phase=${phase}&_t=${Date.now()}`;
      if (all) url += "&all=true";
      else url += `&session_id=${sessionId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) { console.error("fetchItems error:", err); }
    finally { setLoading(false); }
  }, [token, phase, all, sessionId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (content, assignee, due_date) => {
    if (!token || !content?.trim()) return null;
    const sid = all ? undefined : sessionId;
    try {
      const res = await fetch("/api/retro/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phase, content, assignee, due_date, session_id: sid }),
      });
      const data = await res.json();
      if (data.error) { console.error("addItem API error:", data.error); return null; }
      if (data.item) { setItems((prev) => [...prev, data.item]); return data.item; }
    } catch (err) { console.error("addItem error:", err); }
    return null;
  };

  const removeItem = async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch("/api/retro/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
    } catch {}
  };

  const toggleDone = async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newDone = !item.done;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: newDone } : i)));
    try {
      await fetch("/api/retro/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, done: newDone }),
      });
    } catch {}
  };

  const updateItem = async (id, newContent) => {
    if (!token || !newContent?.trim()) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, content: newContent.trim() } : i)));
    try {
      await fetch("/api/retro/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, content: newContent.trim() }),
      });
    } catch {}
  };

  const externalAdd = useCallback((item) => {
    setItems((prev) => prev.some((i) => i.id === item.id) ? prev : [...prev, item]);
  }, []);

  const externalRemove = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const externalUpdate = useCallback((id, content) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, content } : i)));
  }, []);

  return { items, loading, addItem, removeItem, updateItem, toggleDone, refetch: fetchItems, externalAdd, externalRemove, externalUpdate };
}

function TextCollectionPhase({ title, icon, description, placeholder, phase, onNext, onPrev }) {
  const { items, loading, addItem, removeItem } = useRetroItems(phase);
  const [input, setInput] = useState("");

  const handleAdd = () => {
    if (input.trim()) {
      addItem(input.trim());
      setInput("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PhaseHeader icon={icon} title={title} description={description} />

      <div className="flex gap-2.5 retro-slide-in-delay-1">
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={placeholder}
            className="w-full px-4 py-3.5 bg-white/80 backdrop-blur-sm border border-card-border/15 rounded-2xl text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/30 transition-all duration-200"
            style={{ boxShadow: "0 2px 8px rgba(0, 50, 100, 0.03)" }}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-5 py-3.5 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-25 disabled:shadow-none btn-press"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)", boxShadow: "0 4px 16px rgba(6, 194, 134, 0.25)" }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 p-4 rounded-2xl hover:-translate-y-0.5 transition-all duration-300"
              style={{ animation: "retroSlideIn 0.3s ease-out both", animationDelay: `${idx * 40}ms`, background: "rgba(255, 255, 255, 0.8)", border: "1px solid rgba(0, 0, 0, 0.04)", boxShadow: "0 2px 12px rgba(0, 50, 100, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)" }}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-accent/15 to-primary/15 text-accent flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </div>
              {item.avatar_url ? (
                <img src={item.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-card-border flex items-center justify-center text-[9px] font-bold text-muted flex-shrink-0">
                  {item.user_name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{item.content}</p>
                <p className="text-[10px] text-muted">{item.user_name}</p>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all p-1 rounded-lg hover:bg-danger/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          <p className="text-xs text-muted text-center pt-1">{items.length} item{items.length !== 1 ? "s" : ""} added</p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted/60">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No items yet. Type above to add one.</p>
        </div>
      )}

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 3 – Retro Board (flat sticky-note columns like reference)    */
/* ------------------------------------------------------------------ */
const BOARD_COLUMNS = [
  { phase: "went_well", title: "What went well?", icon: (cls = "w-5 h-5") => <CheckCircleIcon className={cls} />, noteBg: "bg-emerald-50", noteText: "text-emerald-800", headerGradient: "from-emerald-500 to-emerald-600", headerBg: "bg-white", headerBorder: "border-b-[3px] border-emerald-400", badge: "bg-emerald-500", inputBorder: "border-emerald-200", inputFocus: "focus:ring-emerald-400/30", btnBg: "bg-emerald-500 hover:bg-emerald-600", accentColor: "rgba(16, 185, 129, 0.1)", noteShadow: "rgba(16, 185, 129, 0.06)" },
  { phase: "didnt_go_well", title: "What went less well?", icon: (cls = "w-5 h-5") => <XCircleIcon className={cls} />, noteBg: "bg-rose-50", noteText: "text-rose-800", headerGradient: "from-rose-500 to-rose-600", headerBg: "bg-white", headerBorder: "border-b-[3px] border-rose-400", badge: "bg-rose-500", inputBorder: "border-rose-200", inputFocus: "focus:ring-rose-400/30", btnBg: "bg-rose-500 hover:bg-rose-600", accentColor: "rgba(244, 63, 94, 0.1)", noteShadow: "rgba(244, 63, 94, 0.06)" },
  { phase: "should_try", title: "What do we want to try next?", icon: (cls = "w-5 h-5") => <LightbulbIcon className={cls} />, noteBg: "bg-sky-50", noteText: "text-sky-800", headerGradient: "from-sky-500 to-sky-600", headerBg: "bg-white", headerBorder: "border-b-[3px] border-sky-400", badge: "bg-sky-500", inputBorder: "border-sky-200", inputFocus: "focus:ring-sky-400/30", btnBg: "bg-sky-500 hover:bg-sky-600", accentColor: "rgba(14, 165, 233, 0.1)", noteShadow: "rgba(14, 165, 233, 0.06)" },
  { phase: "puzzles_us", title: "What puzzles us?", icon: (cls = "w-5 h-5") => <HelpCircleIcon className={cls} />, noteBg: "bg-amber-50", noteText: "text-amber-800", headerGradient: "from-amber-500 to-amber-600", headerBg: "bg-white", headerBorder: "border-b-[3px] border-amber-400", badge: "bg-amber-500", inputBorder: "border-amber-200", inputFocus: "focus:ring-amber-400/30", btnBg: "bg-amber-500 hover:bg-amber-600", accentColor: "rgba(245, 158, 11, 0.1)", noteShadow: "rgba(245, 158, 11, 0.06)" },
];

function StickyNote({ item, col, idx, isOwner, removeItem, updateItem }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.content);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.content) {
      updateItem(item.id, trimmed);
    } else {
      setEditText(item.content);
    }
    setEditing(false);
  };

  return (
    <div
      className={`group relative ${col.noteBg} rounded-2xl px-4 py-3.5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
      style={{
        animation: "retroSlideIn 0.3s ease-out both",
        animationDelay: `${idx * 40}ms`,
        transform: `rotate(${idx % 3 === 0 ? -0.6 : idx % 3 === 1 ? 0.6 : 0}deg)`,
        border: "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: `0 2px 8px ${col.noteShadow || "rgba(0,0,0,0.04)"}, 0 1px 2px rgba(0,0,0,0.02)`,
      }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-3 rounded-b-sm opacity-[0.35] pointer-events-none" style={{ background: `linear-gradient(135deg, ${col.accentColor || "rgba(0,0,0,0.08)"}, rgba(0,0,0,0.04))` }} />
      {editing ? (
        <textarea
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
            if (e.key === "Escape") { setEditText(item.content); setEditing(false); }
          }}
          className={`w-full text-[13px] ${col.noteText} leading-relaxed font-medium bg-white/60 rounded-xl px-3 py-2 border ${col.inputBorder} focus:outline-none focus:ring-2 ${col.inputFocus} resize-none`}
          rows={2}
        />
      ) : (
        <p
          className={`text-[13px] ${col.noteText} leading-relaxed font-medium pr-6 ${isOwner ? "cursor-pointer hover:underline decoration-dotted underline-offset-4 decoration-current/30" : ""}`}
          onClick={() => { if (isOwner) { setEditText(item.content); setEditing(true); } }}
          title={isOwner ? "Click to edit" : ""}
        >
          {item.content}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-black/[0.04]">
        {item.avatar_url ? (
          <img src={item.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white shadow-sm" />
        ) : (
          <div className={`w-5 h-5 rounded-full ${col.badge} flex items-center justify-center text-[8px] font-bold text-white shadow-sm`}>
            {item.user_name?.charAt(0)?.toUpperCase()}
          </div>
        )}
        <span className="text-[10px] text-gray-500 font-medium">{item.user_name}</span>
        {isOwner && !editing && (
          <svg className="w-3 h-3 text-gray-400/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )}
        {item.votes > 0 && (
          <span className={`ml-auto text-[10px] font-bold ${col.badge} text-white px-2.5 py-0.5 rounded-full min-w-[22px] text-center shadow-sm`}>{item.votes}</span>
        )}
      </div>
      {isOwner && (
        <button
          onClick={() => removeItem(item.id)}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-6 h-6 bg-black/40 backdrop-blur-md text-white rounded-lg flex items-center justify-center text-xs transition-all duration-200 hover:bg-red-500 hover:scale-110"
        >
          ×
        </button>
      )}
    </div>
  );
}

function StickyColumn({ col, boardEvent, boardBroadcast }) {
  const { items, loading, addItem, removeItem, updateItem, externalAdd, externalRemove, externalUpdate } = useRetroItems(col.phase);
  const { user } = useAuthContext();
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!boardEvent || boardEvent.phase !== col.phase) return;
    if (boardEvent.type === "add") externalAdd(boardEvent.item);
    if (boardEvent.type === "remove") externalRemove(boardEvent.id);
    if (boardEvent.type === "edit") externalUpdate(boardEvent.id, boardEvent.content);
  }, [boardEvent, col.phase, externalAdd, externalRemove, externalUpdate]);

  const handleAdd = async () => {
    if (input.trim()) {
      const newItem = await addItem(input.trim());
      if (newItem && boardBroadcast) boardBroadcast("add", { phase: col.phase, item: newItem });
      setInput("");
    }
  };

  const handleRemove = (id) => {
    removeItem(id);
    if (boardBroadcast) boardBroadcast("remove", { phase: col.phase, id });
  };

  const handleUpdate = (id, content) => {
    updateItem(id, content);
    if (boardBroadcast) boardBroadcast("edit", { phase: col.phase, id, content });
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden transition-all duration-300 group/col" style={{ minHeight: 420, background: "linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 252, 0.85) 100%)", border: "1px solid rgba(0, 0, 0, 0.06)", boxShadow: "0 4px 24px rgba(0, 50, 100, 0.05), 0 1px 3px rgba(0, 50, 100, 0.03)" }}>
      <div className={`flex items-center gap-2.5 px-5 py-4 ${col.headerBorder}`} style={{ background: "rgba(255, 255, 255, 0.8)" }}>
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${col.headerGradient} flex items-center justify-center shadow-sm`}>
          <span className="text-white">{col.icon("w-4 h-4")}</span>
        </div>
        <h3 className="text-sm font-bold text-gray-800 flex-1 tracking-tight">{col.title}</h3>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${col.badge} text-white shadow-sm tabular-nums`}>{items.length}</span>
      </div>

      <div className="px-3 pt-3 pb-1">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Type & press enter..."
            className={`flex-1 px-3.5 py-2.5 text-sm border ${col.inputBorder} rounded-xl bg-white/90 placeholder:text-gray-400/70 ${col.inputFocus} focus:outline-none focus:ring-2 transition-all`}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className={`px-3.5 py-2.5 ${col.btnBg} text-white rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-25 btn-press shadow-md hover:shadow-lg hover:scale-105`}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ maxHeight: 500 }}>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${col.headerGradient} flex items-center justify-center mb-3 opacity-15`}>
              <span className="text-white">{col.icon("w-7 h-7")}</span>
            </div>
            <p className="text-xs font-semibold text-gray-400/80">No notes yet</p>
            <p className="text-[10px] text-gray-300 mt-0.5">Type above to add one</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <StickyNote
              key={item.id}
              item={item}
              col={col}
              idx={idx}
              isOwner={user?.id === item.user_id}
              removeItem={handleRemove}
              updateItem={handleUpdate}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RetroBoardPhase({ onNext, onPrev, boardEvent, boardBroadcast }) {
  return (
    <div className="w-full space-y-6">
      <PhaseHeader icon={<NotepadIcon className="w-8 h-8" />} title="Retro Board" description="Add your thoughts to each column — be honest, be constructive!" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {BOARD_COLUMNS.map((col) => (
          <StickyColumn key={col.phase} col={col} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />
        ))}
      </div>
      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 4 – AI Group                                                 */
/* ------------------------------------------------------------------ */

const GROUP_BADGE_COLORS = [
  "bg-violet-500", "bg-teal-500", "bg-pink-500", "bg-indigo-500",
  "bg-orange-500", "bg-cyan-500", "bg-lime-600", "bg-fuchsia-500",
];

function GroupedBoardColumn({ col, groupedItems, groupNames, allGroupNames, isAdmin, onRename, onDrop }) {
  const totalCount = Object.values(groupedItems).reduce((s, arr) => s + arr.length, 0);
  const emptyGroups = allGroupNames.filter((g) => !groupedItems[g] || groupedItems[g].length === 0);

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.88) 100%)", border: "1px solid rgba(0, 0, 0, 0.05)", boxShadow: "0 4px 24px rgba(0, 50, 100, 0.05), 0 1px 3px rgba(0, 50, 100, 0.03)" }}
    >
      <div className={`${col.headerBorder} px-4 py-3 flex items-center gap-2.5`} style={{ background: "rgba(255, 255, 255, 0.8)" }}>
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${col.headerGradient} flex items-center justify-center shadow-sm`}>
          <span className="text-white">{col.icon("w-3.5 h-3.5")}</span>
        </div>
        <h3 className="text-sm font-bold text-foreground flex-1 tracking-tight">{col.title}</h3>
        <span className={`${col.badge} text-white text-[10px] font-bold w-6 h-6 rounded-lg flex items-center justify-center shadow-sm tabular-nums`}>
          {totalCount}
        </span>
      </div>
      <div className="p-3 space-y-3 flex-1 min-h-[120px]">
        {groupNames.map((gName, gIdx) => {
          const items = groupedItems[gName];
          if (!items || items.length === 0) return null;
          const badgeColor = GROUP_BADGE_COLORS[gIdx % GROUP_BADGE_COLORS.length];
          return (
            <GroupSection
              key={gName}
              groupName={gName}
              items={items}
              col={col}
              badgeColor={badgeColor}
              isAdmin={isAdmin}
              onRename={onRename}
              onDrop={onDrop}
              phase={col.phase}
            />
          );
        })}
        {isAdmin && emptyGroups.length > 0 && totalCount > 0 && null}
        {isAdmin && (
          <ColumnDropZone col={col} onDrop={onDrop} isEmpty={totalCount === 0} />
        )}
        {!isAdmin && totalCount === 0 && (
          <p className="text-xs text-muted/40 text-center py-6 italic">No items in this column</p>
        )}
      </div>
    </div>
  );
}

function ColumnDropZone({ col, onDrop, isEmpty }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`rounded-xl border-2 border-dashed transition-all duration-200 ${over ? `${col.noteBg} border-current opacity-100` : "border-transparent opacity-0 hover:opacity-60 hover:border-card-border/30"} ${isEmpty ? "py-8 opacity-60 border-card-border/30" : "py-3"}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          const { itemId, sourceGroup } = JSON.parse(raw);
          onDrop(itemId, sourceGroup, sourceGroup, col.phase);
        } catch { /* ignore */ }
      }}
    >
      <p className={`text-[10px] text-muted/50 text-center italic ${isEmpty ? "" : ""}`}>
        {isEmpty ? "Drop items here" : "Drop to keep group"}
      </p>
    </div>
  );
}

function GroupSection({ groupName, items, col, badgeColor, isAdmin, onRename, onDrop, phase }) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(groupName);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setNameVal(groupName); }, [groupName]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const saveRename = () => {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== groupName) onRename(groupName, trimmed);
    else setNameVal(groupName);
    setEditing(false);
  };

  const handleSectionDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const { itemId, sourceGroup } = JSON.parse(raw);
      onDrop(itemId, sourceGroup, groupName, phase);
    } catch { /* ignore */ }
  };

  return (
    <div
      className={`rounded-xl p-2 transition-all duration-200 ${dragOver ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={handleSectionDrop}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`${badgeColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm`}>
          {items.length}
        </span>
        {editing && isAdmin ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") { setNameVal(groupName); setEditing(false); } }}
            className="flex-1 text-xs font-bold text-foreground bg-white/80 rounded-lg px-2 py-1 border border-card-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        ) : (
          <span
            className={`text-xs font-bold text-foreground/80 ${isAdmin ? "cursor-pointer hover:underline decoration-dotted underline-offset-2" : ""}`}
            onClick={() => { if (isAdmin) setEditing(true); }}
            title={isAdmin ? "Click to rename group" : ""}
          >
            {groupName}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable={isAdmin}
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData("text/plain", JSON.stringify({ itemId: item.id, sourceGroup: groupName }));
              e.dataTransfer.effectAllowed = "move";
            }}
            className={`${col.noteBg} rounded-xl px-3 py-2 transition-all duration-200 ${isAdmin ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5" : ""} border border-white/50`}
            style={{ animation: "retroSlideIn 0.3s ease-out both", animationDelay: `${idx * 30}ms` }}
          >
            <p className={`text-[13px] ${col.noteText} leading-relaxed font-medium`}>{item.content}</p>
            <span className="text-[10px] text-muted/60 mt-1 block">{item.user_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIGroupPhase({ role, isFacilitator, onNext, onPrev, groupEvent, groupBroadcast }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [source, setSource] = useState(null);
  const isAdmin = role === "scrum_master" || role === "super_admin";

  const fetchGroups = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const res = await fetch(`/api/retro/group-items?session_id=${sessionId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (data.groups && Object.keys(data.groups).length > 0) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error("Fetch groups error:", err);
    }
    setFetching(false);
  }, [token, sessionId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  useEffect(() => {
    if (!groupEvent) return;
    if (groupEvent.type === "refresh") {
      fetchGroups();
    }
  }, [groupEvent, fetchGroups]);

  const analyzeItems = async () => {
    if (!token || !sessionId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/retro/group-items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      setGroups(data.groups || {});
      setSource(data.source);
      groupBroadcast("refresh", { sessionId });
    } catch (err) {
      console.error("AI grouping error:", err);
    }
    setLoading(false);
  };

  const handleRename = async (oldName, newName) => {
    if (!token || !sessionId) return;
    const updated = {};
    for (const [k, v] of Object.entries(groups)) {
      updated[k === oldName ? newName : k] = v;
    }
    setGroups(updated);
    try {
      await fetch("/api/retro/group-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rename: { old_name: oldName, new_name: newName, session_id: sessionId } }),
      });
      groupBroadcast("refresh", { sessionId });
    } catch (err) {
      console.error("Rename group error:", err);
    }
  };

  const handleDrop = async (itemId, sourceGroupName, targetGroupName, targetPhase) => {
    if (!token || !isAdmin) return;
    let draggedItem = null;
    for (const [gName, gItems] of Object.entries(groups)) {
      const found = gItems.find((it) => it.id === itemId);
      if (found) { draggedItem = found; break; }
    }
    if (!draggedItem) return;
    if (sourceGroupName === targetGroupName && draggedItem.phase === targetPhase) return;

    const updated = {};
    for (const [k, v] of Object.entries(groups)) {
      updated[k] = v.filter((it) => it.id !== itemId);
    }
    const movedItem = { ...draggedItem, phase: targetPhase };
    if (updated[targetGroupName]) {
      updated[targetGroupName] = [...updated[targetGroupName], movedItem];
    } else {
      updated[targetGroupName] = [movedItem];
    }
    for (const k of Object.keys(updated)) {
      if (updated[k].length === 0) delete updated[k];
    }
    setGroups(updated);

    try {
      await fetch("/api/retro/group-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: [{ id: itemId, group_name: targetGroupName }] }),
      });
      groupBroadcast("refresh", { sessionId });
    } catch (err) {
      console.error("Move item error:", err);
    }
  };

  const groupNames = Object.keys(groups);
  const totalItems = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
  const hasGroups = groupNames.length > 0;

  const getColumnGroupedItems = (phase) => {
    const result = {};
    for (const gName of groupNames) {
      const phaseItems = (groups[gName] || []).filter((it) => it.phase === phase);
      if (phaseItems.length > 0) result[gName] = phaseItems;
    }
    return result;
  };

  return (
    <div className="w-full space-y-5">
      <PhaseHeader
        icon={<SparklesIcon className="w-8 h-8" />}
        title="AI Group"
        description="AI analyzes and groups items by domain — facilitator can rename groups and drag items between them."
      />

      {isFacilitator && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={analyzeItems}
            disabled={loading}
            className="group relative flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-all duration-300 btn-press disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)",
              boxShadow: "0 8px 30px rgba(6, 194, 134, 0.25), 0 2px 8px rgba(0, 50, 150, 0.15)",
            }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {loading ? (
              <>
                <ArrowPathIcon className="relative w-5 h-5 animate-spin" />
                <span className="relative">Analyzing items...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="relative w-5 h-5" />
                <span className="relative">{hasGroups ? "Re-analyze & Group" : "Analyze & Group Items"}</span>
              </>
            )}
          </button>
        </div>
      )}

      {!isFacilitator && fetching && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <ArrowPathIcon className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted">Loading groups...</p>
        </div>
      )}

      {!isFacilitator && !fetching && !hasGroups && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <SparklesIcon className="w-12 h-12 text-muted/30" />
          <p className="text-sm text-muted">Waiting for the facilitator to group items...</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/15 blur-xl animate-pulse" />
            <SparklesIcon className="absolute inset-0 m-auto w-8 h-8 text-primary animate-bounce" />
          </div>
          <p className="text-sm font-medium text-foreground">AI is analyzing {totalItems || "your"} items...</p>
          <p className="text-xs text-muted">Grouping by prefix and domain</p>
        </div>
      )}

      {hasGroups && !loading && (
        <>
          <div className="flex items-center justify-center gap-2 text-xs text-muted">
            <span className="font-semibold text-foreground">{groupNames.length}</span> groups
            <span className="mx-1">·</span>
            <span className="font-semibold text-foreground">{totalItems}</span> items
            {source && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{source === "groq" ? "AI" : source === "prefix" ? "Prefix" : "Fallback"}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {BOARD_COLUMNS.map((col) => (
              <GroupedBoardColumn
                key={col.phase}
                col={col}
                groupedItems={getColumnGroupedItems(col.phase)}
                groupNames={groupNames}
                allGroupNames={groupNames}
                isAdmin={isAdmin}
                onRename={handleRename}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </>
      )}

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 5 – Voting (5 votes per employee, sorted by highest votes)   */
/* ------------------------------------------------------------------ */
const MAX_VOTES = 5;
const VOTE_PHASES = ["went_well", "didnt_go_well", "should_try", "puzzles_us"];

function VotingPhase({ employees, role, onNext, onPrev, voteEvent, itemVoteEvent, broadcastVoteChange, broadcastItemVote, groupBroadcast, groupEvent }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const { user } = useAuthContext();
  const [allItems, setAllItems] = useState({});
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voteSummary, setVoteSummary] = useState({});
  const [showTracker, setShowTracker] = useState(true);
  const [globalGroupNames, setGlobalGroupNames] = useState([]);
  const [creatingGroupForPhase, setCreatingGroupForPhase] = useState(null);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [editingGroupName, setEditingGroupName] = useState(null);
  const [editingGroupValue, setEditingGroupValue] = useState("");
  const isAdmin = role === "scrum_master" || role === "super_admin";
  const busyRef = useRef(false);
  const myVotesRef = useRef(myVotes);
  myVotesRef.current = myVotes;
  const newGroupInputRef = useRef(null);
  const renameInputRef = useRef(null);

  const remaining = MAX_VOTES - myVotes.length;

  useEffect(() => {
    if (!token || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const hdrs = { Authorization: `Bearer ${token}` };
        const ts = Date.now();
        const [groupRes, votesRes] = await Promise.all([
          fetch(`/api/retro/group-items?session_id=${sessionId}&_t=${ts}`, { headers: hdrs, cache: "no-store" }),
          fetch(`/api/retro/votes?session_id=${sessionId}&_t=${ts}`, { headers: hdrs, cache: "no-store" }),
        ]);
        if (cancelled) return;
        const groupData = await groupRes.json();
        const votesData = await votesRes.json();

        const gNames = Object.keys(groupData.groups || {});

        const grouped = {};
        for (const p of VOTE_PHASES) grouped[p] = [];

        for (const [gName, gItems] of Object.entries(groupData.groups || {})) {
          for (const item of gItems) {
            if (grouped[item.phase]) {
              grouped[item.phase].push({ ...item, group_name: gName });
            }
          }
        }

        for (const item of (groupData.ungrouped || [])) {
          if (grouped[item.phase]) {
            grouped[item.phase].push(item);
          }
        }

        setAllItems(grouped);
        setGlobalGroupNames(gNames);
        setMyVotes(votesData.votes || []);
      } catch (err) { console.error("VotingPhase fetch error:", err); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token, sessionId]);

  useEffect(() => {
    if (!isAdmin || !token || !sessionId) return;
    fetch(`/api/retro/votes/summary?session_id=${sessionId}&_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => { if (data.voteSummary) setVoteSummary(data.voteSummary); })
      .catch(() => {});
  }, [isAdmin, token, sessionId]);

  useEffect(() => {
    if (!voteEvent) return;
    setVoteSummary((prev) => ({ ...prev, [voteEvent.userId]: voteEvent.voteCount }));
  }, [voteEvent]);

  useEffect(() => {
    if (!itemVoteEvent) return;
    setAllItems((prev) => {
      const next = { ...prev };
      for (const p of VOTE_PHASES) {
        next[p] = (next[p] || []).map((i) =>
          i.id === itemVoteEvent.itemId
            ? { ...i, votes: Math.max((i.votes || 0) + itemVoteEvent.delta, 0) }
            : i
        );
      }
      return next;
    });
  }, [itemVoteEvent]);

  const myVoteCount = (itemId) => myVotes.filter((id) => id === itemId).length;

  const castVote = async (itemId) => {
    if (myVotesRef.current.length >= MAX_VOTES || busyRef.current) return;
    busyRef.current = true;

    const newVotes = [...myVotesRef.current, itemId];
    setMyVotes(newVotes);
    setAllItems((prev) => {
      const next = { ...prev };
      for (const p of VOTE_PHASES) {
        next[p] = (next[p] || []).map((i) => i.id === itemId ? { ...i, votes: (i.votes || 0) + 1 } : i);
      }
      return next;
    });
    if (user?.id) {
      broadcastVoteChange(user.id, newVotes.length);
      setVoteSummary((prev) => ({ ...prev, [user.id]: newVotes.length }));
    }
    broadcastItemVote(itemId, 1);

    try {
      const res = await fetch("/api/retro/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: itemId, session_id: sessionId }),
      });
      if (!res.ok) {
        setMyVotes((prev) => { const idx = prev.indexOf(itemId); if (idx === -1) return prev; const arr = [...prev]; arr.splice(idx, 1); return arr; });
        setAllItems((prev) => {
          const next = { ...prev };
          for (const p of VOTE_PHASES) { next[p] = (next[p] || []).map((i) => i.id === itemId ? { ...i, votes: Math.max((i.votes || 0) - 1, 0) } : i); }
          return next;
        });
        if (user?.id) setVoteSummary((prev) => ({ ...prev, [user.id]: Math.max((prev[user.id] || 0) - 1, 0) }));
      }
    } catch {
      setMyVotes((prev) => { const idx = prev.indexOf(itemId); if (idx === -1) return prev; const arr = [...prev]; arr.splice(idx, 1); return arr; });
      setAllItems((prev) => {
        const next = { ...prev };
        for (const p of VOTE_PHASES) { next[p] = (next[p] || []).map((i) => i.id === itemId ? { ...i, votes: Math.max((i.votes || 0) - 1, 0) } : i); }
        return next;
      });
      if (user?.id) setVoteSummary((prev) => ({ ...prev, [user.id]: Math.max((prev[user.id] || 0) - 1, 0) }));
    } finally {
      busyRef.current = false;
    }
  };

  const removeVote = async (itemId) => {
    if (!myVotesRef.current.includes(itemId) || busyRef.current) return;
    busyRef.current = true;

    const idx = myVotesRef.current.indexOf(itemId);
    const newVotes = [...myVotesRef.current];
    newVotes.splice(idx, 1);
    setMyVotes(newVotes);
    setAllItems((prev) => {
      const next = { ...prev };
      for (const p of VOTE_PHASES) {
        next[p] = (next[p] || []).map((i) => i.id === itemId ? { ...i, votes: Math.max((i.votes || 0) - 1, 0) } : i);
      }
      return next;
    });
    if (user?.id) {
      broadcastVoteChange(user.id, newVotes.length);
      setVoteSummary((prev) => ({ ...prev, [user.id]: newVotes.length }));
    }
    broadcastItemVote(itemId, -1);

    try {
      const res = await fetch("/api/retro/votes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: itemId, session_id: sessionId }),
      });
      if (!res.ok) {
        setMyVotes((prev) => [...prev, itemId]);
        setAllItems((prev) => {
          const next = { ...prev };
          for (const p of VOTE_PHASES) { next[p] = (next[p] || []).map((i) => i.id === itemId ? { ...i, votes: (i.votes || 0) + 1 } : i); }
          return next;
        });
        if (user?.id) setVoteSummary((prev) => ({ ...prev, [user.id]: (prev[user.id] || 0) + 1 }));
      }
    } catch {
      setMyVotes((prev) => [...prev, itemId]);
      setAllItems((prev) => {
        const next = { ...prev };
        for (const p of VOTE_PHASES) { next[p] = (next[p] || []).map((i) => i.id === itemId ? { ...i, votes: (i.votes || 0) + 1 } : i); }
        return next;
      });
      if (user?.id) setVoteSummary((prev) => ({ ...prev, [user.id]: (prev[user.id] || 0) + 1 }));
    } finally {
      busyRef.current = false;
    }
  };

  useEffect(() => {
    if (creatingGroupForPhase && newGroupInputRef.current) newGroupInputRef.current.focus();
  }, [creatingGroupForPhase]);

  useEffect(() => {
    if (editingGroupName && renameInputRef.current) renameInputRef.current.focus();
  }, [editingGroupName]);

  useEffect(() => {
    if (!groupEvent) return;
    if (groupEvent.type === "vote_group_refresh") {
      (async () => {
        try {
          const hdrs = { Authorization: `Bearer ${token}` };
          const res = await fetch(`/api/retro/group-items?session_id=${sessionId}&_t=${Date.now()}`, { headers: hdrs, cache: "no-store" });
          const groupData = await res.json();
          const gNames = Object.keys(groupData.groups || {});
          const grouped = {};
          for (const p of VOTE_PHASES) grouped[p] = [];
          for (const [gName, gItems] of Object.entries(groupData.groups || {})) {
            for (const item of gItems) {
              if (grouped[item.phase]) grouped[item.phase].push({ ...item, group_name: gName });
            }
          }
          for (const item of (groupData.ungrouped || [])) {
            if (grouped[item.phase]) grouped[item.phase].push(item);
          }
          setAllItems(grouped);
          setGlobalGroupNames(gNames);
        } catch {}
      })();
    }
  }, [groupEvent, token, sessionId]);

  const createCustomGroup = async (phase) => {
    const title = newGroupTitle.trim();
    if (!title || !token || !sessionId) return;
    setGlobalGroupNames((prev) => prev.includes(title) ? prev : [...prev, title]);
    setCreatingGroupForPhase(null);
    setNewGroupTitle("");
  };

  const moveItemToGroup = async (itemId, targetGroupName) => {
    if (!token || !isAdmin) return;
    setAllItems((prev) => {
      const next = { ...prev };
      for (const p of VOTE_PHASES) {
        next[p] = (next[p] || []).map((i) =>
          i.id === itemId ? { ...i, group_name: targetGroupName } : i
        );
      }
      return next;
    });
    if (!globalGroupNames.includes(targetGroupName)) {
      setGlobalGroupNames((prev) => [...prev, targetGroupName]);
    }
    try {
      await fetch("/api/retro/group-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: [{ id: itemId, group_name: targetGroupName }] }),
      });
      if (groupBroadcast) groupBroadcast("vote_group_refresh", { sessionId });
    } catch (err) {
      console.error("Move item error:", err);
    }
  };

  const renameGroupInVote = async (oldName, newName) => {
    if (!token || !sessionId || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    setGlobalGroupNames((prev) => prev.map((g) => g === oldName ? trimmed : g));
    setAllItems((prev) => {
      const next = { ...prev };
      for (const p of VOTE_PHASES) {
        next[p] = (next[p] || []).map((i) =>
          i.group_name === oldName ? { ...i, group_name: trimmed } : i
        );
      }
      return next;
    });
    setEditingGroupName(null);
    setEditingGroupValue("");
    try {
      await fetch("/api/retro/group-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rename: { old_name: oldName, new_name: trimmed, session_id: sessionId } }),
      });
      if (groupBroadcast) groupBroadcast("vote_group_refresh", { sessionId });
    } catch (err) {
      console.error("Rename group error:", err);
    }
  };

  const handleVoteDrop = (e, targetGroupName) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const { itemId } = JSON.parse(raw);
      moveItemToGroup(itemId, targetGroupName);
    } catch {}
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-gray-300 border-t-accent animate-spin" />
        <p className="text-sm text-muted">Loading items for voting...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="text-center">
        <PhaseHeader icon={<BallotIcon className="w-8 h-8" />} title="Vote on Items" description="You have 5 votes. Upvote the most important items across all columns." />
        <div className="inline-flex items-center gap-3 mt-3 px-6 py-3 rounded-full backdrop-blur-sm" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.85), rgba(240, 247, 244, 0.82))", border: "1px solid rgba(0, 0, 0, 0.05)", boxShadow: "0 4px 20px rgba(0, 50, 100, 0.05)" }}>
          <span className="text-sm font-bold text-gray-700">Votes remaining:</span>
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_VOTES }).map((_, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-all duration-300 ${
                  i < remaining ? "bg-gradient-to-br from-accent to-accent-dark text-white shadow-md shadow-accent/30 scale-100" : "bg-gray-200/50 text-gray-400 scale-90"
                }`}
              >
                <StarIcon className="w-3 h-3" />
              </div>
            ))}
          </div>
          <span className={`text-lg font-black ${remaining > 0 ? "bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent" : "text-gray-400"}`}>{remaining}</span>
        </div>
      </div>

      {isAdmin && (employees || []).length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.85))", border: "1px solid rgba(0, 0, 0, 0.05)", boxShadow: "0 4px 20px rgba(0, 50, 100, 0.05)" }}>
          <button
            onClick={() => setShowTracker(!showTracker)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-accent/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <UsersIcon className="w-4 h-4" />
              <span className="text-sm font-bold text-gray-700">Vote Tracker</span>
              <span className="text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">Live</span>
              {(() => {
                const doneCount = (employees || []).filter((e) => (voteSummary[e.id] || 0) === MAX_VOTES).length;
                const total = (employees || []).length;
                return doneCount < total ? (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{total - doneCount} pending</span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">All done!</span>
                );
              })()}
            </div>
            <svg className={`w-4 h-4 text-muted transition-transform duration-200 ${showTracker ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showTracker && (
            <div className="px-5 pb-4 pt-1 border-t border-white/40">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 mt-2">
                {(employees || []).map((emp) => {
                  const used = voteSummary[emp.id] || 0;
                  const isDone = used === MAX_VOTES;
                  const notStarted = used === 0;
                  return (
                    <div
                      key={emp.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                        isDone
                          ? "bg-emerald-50 border-emerald-200"
                          : notStarted
                          ? "bg-red-50/50 border-red-200/60"
                          : "bg-amber-50/50 border-amber-200/60"
                      }`}
                    >
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-card-border flex items-center justify-center text-[10px] font-bold text-muted flex-shrink-0">
                          {emp.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800 truncate">{emp.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {Array.from({ length: MAX_VOTES }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                                i < used
                                  ? isDone ? "bg-emerald-500" : "bg-amber-400"
                                  : "bg-gray-200"
                              }`}
                            />
                          ))}
                          <span className={`text-[10px] font-bold ml-0.5 ${
                            isDone ? "text-emerald-600" : notStarted ? "text-red-400" : "text-amber-600"
                          }`}>
                            {used}/{MAX_VOTES}
                          </span>
                        </div>
                      </div>
                      {isDone && (
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const doneCount = (employees || []).filter((e) => (voteSummary[e.id] || 0) === MAX_VOTES).length;
                const total = (employees || []).length;
                const pending = total - doneCount;
                return (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/40 text-xs text-muted">
                    <span className="font-semibold text-emerald-600">{doneCount} done</span>
                    <span>·</span>
                    {pending > 0 ? (
                      <span className="font-semibold text-amber-600">{pending} remaining</span>
                    ) : (
                      <span className="font-semibold text-emerald-600">All votes in!</span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {BOARD_COLUMNS.map((col) => {
          const items = allItems[col.phase] || [];
          const grouped = {};
          for (const item of items) {
            const gName = item.group_name || "Ungrouped";
            if (!grouped[gName]) grouped[gName] = [];
            grouped[gName].push(item);
          }
          const orderedGNames = globalGroupNames.filter(g => grouped[g] && grouped[g].length > 0);
          for (const g of Object.keys(grouped)) {
            if (!orderedGNames.includes(g)) orderedGNames.push(g);
          }
          const emptyCustomGroups = globalGroupNames.filter(g => !grouped[g] || grouped[g].length === 0);
          const totalCount = items.length;

          return (
            <div
              key={col.phase}
              className="rounded-2xl overflow-hidden border border-card-border/40 flex flex-col"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)", boxShadow: "0 4px 24px rgba(0, 50, 100, 0.06), 0 1px 3px rgba(0, 50, 100, 0.04)" }}
            >
              <div className={`${col.headerBg} ${col.headerBorder} px-4 py-3 flex items-center gap-2`}>
                {col.icon("w-5 h-5 text-inherit")}
                <h3 className="text-sm font-bold text-foreground flex-1">{col.title}</h3>
                <span className={`${col.badge} text-white text-[10px] font-bold w-6 h-6 rounded-lg flex items-center justify-center shadow-sm`}>
                  {totalCount}
                </span>
              </div>
              <div className="p-3 space-y-3 flex-1 min-h-[120px]">
                {totalCount === 0 && !isAdmin ? (
                  <p className="text-xs text-muted/40 text-center py-6 italic">No items in this column</p>
                ) : (
                  <>
                    {orderedGNames.map((gName) => {
                      const gItems = grouped[gName];
                      if (!gItems || gItems.length === 0) return null;
                      const globalIdx = globalGroupNames.indexOf(gName);
                      const badgeColor = GROUP_BADGE_COLORS[(globalIdx !== -1 ? globalIdx : orderedGNames.indexOf(gName)) % GROUP_BADGE_COLORS.length];
                      const repId = gItems[0].id;
                      const groupVotes = gItems.reduce((s, it) => s + (it.votes || 0), 0);
                      const myGroupVotes = gItems.reduce((s, it) => s + myVoteCount(it.id), 0);
                      const voted = myGroupVotes > 0;
                      const isRenaming = editingGroupName === `${col.phase}::${gName}`;

                      return (
                        <div
                          key={gName}
                          className={`rounded-xl p-2 transition-all duration-200 ${voted ? "ring-2 ring-accent shadow-lg bg-accent/5" : ""}`}
                          onDragOver={isAdmin ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}
                          onDrop={isAdmin ? (e) => handleVoteDrop(e, gName) : undefined}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className={`${badgeColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm`}>
                              {gItems.length}
                            </span>
                            {isRenaming && isAdmin ? (
                              <input
                                ref={renameInputRef}
                                value={editingGroupValue}
                                onChange={(e) => setEditingGroupValue(e.target.value)}
                                onBlur={() => { renameGroupInVote(gName, editingGroupValue); }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") renameGroupInVote(gName, editingGroupValue);
                                  if (e.key === "Escape") { setEditingGroupName(null); setEditingGroupValue(""); }
                                }}
                                className="flex-1 text-xs font-bold text-foreground bg-white/80 rounded-lg px-2 py-1 border border-card-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            ) : (
                              <span
                                className={`text-xs font-bold text-foreground/80 flex-1 ${isAdmin ? "cursor-pointer hover:underline decoration-dotted underline-offset-2" : ""}`}
                                onClick={() => {
                                  if (isAdmin) {
                                    setEditingGroupName(`${col.phase}::${gName}`);
                                    setEditingGroupValue(gName);
                                  }
                                }}
                                title={isAdmin ? "Click to rename group" : ""}
                              >
                                {gName}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5">
                              {groupVotes > 0 && (
                                <span className={`text-[10px] font-bold ${col.noteText} bg-white/60 px-1.5 py-0.5 rounded-md`}>
                                  {groupVotes} {groupVotes === 1 ? "vote" : "votes"}
                                </span>
                              )}
                              {voted && (
                                <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                                  You: {myGroupVotes}
                                </span>
                              )}
                              <button
                                onClick={() => voted ? removeVote(repId) : castVote(repId)}
                                disabled={!voted && remaining <= 0}
                                className={`flex items-center justify-center rounded-lg transition-all duration-200 ${
                                  voted
                                    ? "w-8 h-8 bg-accent text-white shadow-md shadow-accent/30 hover:bg-red-500 hover:shadow-red-500/30 hover:scale-110"
                                    : remaining > 0
                                      ? "w-8 h-8 bg-white/80 text-gray-400 border border-white/60 shadow-sm hover:bg-accent/15 hover:text-accent hover:border-accent/30 hover:scale-110"
                                      : "w-8 h-8 bg-gray-100/50 text-gray-300 cursor-not-allowed"
                                }`}
                                title={voted ? "Remove vote from group" : remaining > 0 ? "Vote for this group" : "No votes left"}
                              >
                                <svg className={`w-4 h-4 transition-transform duration-200 ${voted ? "rotate-45" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {gItems.map((item, idx) => (
                              <div
                                key={item.id}
                                draggable={isAdmin}
                                onDragStart={isAdmin ? (e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData("text/plain", JSON.stringify({ itemId: item.id, sourceGroup: gName }));
                                  e.dataTransfer.effectAllowed = "move";
                                } : undefined}
                                className={`${col.noteBg} rounded-xl px-3 py-2 border border-white/50 ${isAdmin ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" : ""}`}
                                style={{ animation: "retroSlideIn 0.3s ease-out both", animationDelay: `${idx * 30}ms` }}
                              >
                                <p className={`text-[13px] ${col.noteText} leading-relaxed font-medium`}>{item.content}</p>
                                <span className="text-[10px] text-muted/60 mt-1 block">{item.user_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {isAdmin && emptyCustomGroups.map((gName) => {
                      const globalIdx = globalGroupNames.indexOf(gName);
                      const badgeColor = GROUP_BADGE_COLORS[(globalIdx !== -1 ? globalIdx : 0) % GROUP_BADGE_COLORS.length];
                      const isRenaming = editingGroupName === `${col.phase}::${gName}`;
                      return (
                        <div
                          key={`empty-${gName}`}
                          className="rounded-xl p-2 border-2 border-dashed border-card-border/30 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.02]"
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => handleVoteDrop(e, gName)}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`${badgeColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm opacity-60`}>0</span>
                            {isRenaming ? (
                              <input
                                ref={renameInputRef}
                                value={editingGroupValue}
                                onChange={(e) => setEditingGroupValue(e.target.value)}
                                onBlur={() => { renameGroupInVote(gName, editingGroupValue); }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") renameGroupInVote(gName, editingGroupValue);
                                  if (e.key === "Escape") { setEditingGroupName(null); setEditingGroupValue(""); }
                                }}
                                className="flex-1 text-xs font-bold text-foreground bg-white/80 rounded-lg px-2 py-1 border border-card-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            ) : (
                              <span
                                className="text-xs font-bold text-foreground/50 flex-1 cursor-pointer hover:underline decoration-dotted underline-offset-2"
                                onClick={() => { setEditingGroupName(`${col.phase}::${gName}`); setEditingGroupValue(gName); }}
                                title="Click to rename group"
                              >
                                {gName}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted/40 text-center py-2 italic">Drop items here</p>
                        </div>
                      );
                    })}
                  </>
                )}

                {isAdmin && (
                  <>
                    {creatingGroupForPhase === col.phase ? (
                      <div className="rounded-xl p-2.5 border-2 border-dashed border-primary/40 bg-primary/[0.04]">
                        <div className="flex items-center gap-2">
                          <input
                            ref={newGroupInputRef}
                            value={newGroupTitle}
                            onChange={(e) => setNewGroupTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") createCustomGroup(col.phase);
                              if (e.key === "Escape") { setCreatingGroupForPhase(null); setNewGroupTitle(""); }
                            }}
                            placeholder="Group name..."
                            className="flex-1 text-xs font-medium text-foreground bg-white/90 rounded-lg px-3 py-2 border border-card-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted/40"
                          />
                          <button
                            onClick={() => createCustomGroup(col.phase)}
                            disabled={!newGroupTitle.trim()}
                            className="px-3 py-2 text-[11px] font-bold text-white bg-gradient-to-r from-accent to-primary rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Create
                          </button>
                          <button
                            onClick={() => { setCreatingGroupForPhase(null); setNewGroupTitle(""); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setCreatingGroupForPhase(col.phase); setNewGroupTitle(""); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-card-border/20 text-muted/50 hover:border-primary/30 hover:text-primary hover:bg-primary/[0.03] transition-all duration-200 group"
                      >
                        <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-[11px] font-semibold">New Group</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 6 – Vote Results (sorted by highest votes)                   */
/* ------------------------------------------------------------------ */
const RESULT_COL_CONFIG = [
  { phase: "went_well", title: "What went well?", icon: (cls = "w-5 h-5") => <CheckCircleIcon className={cls} />, bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-400", badge: "bg-emerald-500", barBg: "bg-emerald-400", gradient: "from-emerald-500 to-emerald-600" },
  { phase: "didnt_go_well", title: "What went less well?", icon: (cls = "w-5 h-5") => <XCircleIcon className={cls} />, bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-400", badge: "bg-rose-500", barBg: "bg-rose-400", gradient: "from-rose-500 to-rose-600" },
  { phase: "should_try", title: "What to try next?", icon: (cls = "w-5 h-5") => <LightbulbIcon className={cls} />, bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-400", badge: "bg-sky-500", barBg: "bg-sky-400", gradient: "from-sky-500 to-sky-600" },
  { phase: "puzzles_us", title: "What puzzles us?", icon: (cls = "w-5 h-5") => <HelpCircleIcon className={cls} />, bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-400", badge: "bg-amber-500", barBg: "bg-amber-400", gradient: "from-amber-500 to-amber-600" },
];

function VoteResultsPhase({ onNext, onPrev }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [allItems, setAllItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/retro/items?phase=all_board&session_id=${sessionId}&_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json();
        const grouped = {};
        for (const c of RESULT_COL_CONFIG) grouped[c.phase] = [];
        for (const item of (data.items || [])) {
          if (grouped[item.phase]) grouped[item.phase].push(item);
        }
        for (const c of RESULT_COL_CONFIG) {
          grouped[c.phase].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        }
        setAllItems(grouped);
      } catch (err) { console.error("VoteResults fetch error:", err); }
      setLoading(false);
    })();
  }, [token, sessionId]);

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center py-20 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-gray-300 border-t-accent animate-spin" />
        <p className="text-sm text-muted">Tallying votes...</p>
      </div>
    );
  }

  const allFlat = Object.values(allItems).flat();
  const maxVotes = Math.max(...allFlat.map((i) => i.votes || 0), 1);

  return (
    <div className="w-full space-y-6">
      <PhaseHeader icon={<ChartBarIcon className="w-8 h-8" />} title="Vote Results" description="Items ranked by votes — the team has spoken! Focus discussions on top-voted items." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {RESULT_COL_CONFIG.map((cfg) => {
          const items = allItems[cfg.phase] || [];
          return (
            <div key={cfg.phase} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 252, 0.85) 100%)", border: "1px solid rgba(0, 0, 0, 0.05)", boxShadow: "0 4px 24px rgba(0, 50, 100, 0.05), 0 1px 3px rgba(0, 50, 100, 0.03)" }}>
              <div className={`flex items-center gap-2.5 px-5 py-4 border-b-[3px] ${cfg.border}`} style={{ background: "rgba(255, 255, 255, 0.8)" }}>
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${cfg.gradient || ""} flex items-center justify-center shadow-sm`}>
                  <span className="text-white">{cfg.icon("w-4 h-4")}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-800 flex-1 tracking-tight">{cfg.title}</h3>
              </div>
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 520 }}>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-10">No items</p>
                ) : (
                  items.map((item, idx) => {
                    const pct = maxVotes > 0 ? ((item.votes || 0) / maxVotes) * 100 : 0;
                    const isTop = idx === 0 && (item.votes || 0) > 0;
                    const medalRank = idx < 3 ? idx + 1 : null;
                    return (
                      <div
                        key={item.id}
                        className={`relative px-4 py-3.5 border-b border-gray-100/50 last:border-b-0 transition-all ${isTop ? `${cfg.bg} backdrop-blur-sm` : "hover:bg-white/30"}`}
                        style={{ animation: "retroSlideIn 0.35s ease-out both", animationDelay: `${idx * 60}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                            isTop
                              ? `${cfg.badge} text-white shadow-lg shadow-${cfg.badge.split("-")[1]}-500/30`
                              : idx < 3 && (item.votes || 0) > 0
                              ? `bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 shadow-sm`
                              : "bg-gray-100/50 text-gray-400"
                          }`}>
                            {medalRank && (item.votes || 0) > 0 ? <MedalIcon className="w-5 h-5" rank={medalRank} /> : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium leading-snug ${isTop ? cfg.text : "text-gray-800"}`}>
                              {item.content}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {item.avatar_url ? (
                                <img src={item.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white" />
                              ) : (
                                <div className={`w-5 h-5 rounded-full ${cfg.badge} flex items-center justify-center text-[8px] font-bold text-white shadow-sm`}>
                                  {item.user_name?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-[10px] text-gray-500 font-medium">{item.user_name}</span>
                            </div>
                            {(item.votes || 0) > 0 && (
                              <div className="mt-2.5 flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-100/80 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${cfg.barBg} rounded-full transition-all duration-700 ease-out`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={`text-[11px] font-black ${cfg.text}`}>{item.votes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 7 – Action Items (persisted)                                 */
/* ------------------------------------------------------------------ */
function ActionItemsPhase({ employees, onNext, onPrev, boardEvent, boardBroadcast }) {
  const { items: actions, loading, addItem, removeItem, externalAdd, externalRemove } = useRetroItems("action_items", { all: true });
  const [input, setInput] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!boardEvent || boardEvent.phase !== "action_items") return;
    if (boardEvent.type === "add") externalAdd(boardEvent.item);
    if (boardEvent.type === "remove") externalRemove(boardEvent.id);
  }, [boardEvent, externalAdd, externalRemove]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const handleAdd = async () => {
    if (input.trim() && assignees.length > 0) {
      const newItem = await addItem(input.trim(), assignees.join(", "), dueDate || null);
      if (newItem && boardBroadcast) boardBroadcast("add", { phase: "action_items", item: newItem });
      setInput("");
      setAssignees([]);
      setDueDate("");
    }
  };

  const toggleAssignee = (name) => {
    setAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const selectedEmps = employees.filter((e) => assignees.includes(e.name));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PhaseHeader
        icon={<RocketIcon className="w-8 h-8" />}
        title="Action Items"
        description="Define concrete steps to improve the next sprint. Assign owners and due dates."
      />

      {/* Add form */}
      <div className="retro-gradient-border rounded-2xl retro-slide-in-delay-1">
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95), rgba(230, 236, 247, 0.9))" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What should we do differently?"
          className="w-full px-4 py-3 bg-white/60 border border-white/50 rounded-xl text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
        />

        <div className="flex gap-2">
          {/* Assignee dropdown (multi-select) */}
          <div className="relative flex-1" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className={`w-full flex items-center gap-2 px-4 py-3 bg-background border border-card-border rounded-xl text-sm text-left transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                assignees.length > 0 ? "text-foreground" : "text-muted/60"
              }`}
            >
              {selectedEmps.length > 0 ? (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="flex -space-x-1.5 flex-shrink-0">
                    {selectedEmps.slice(0, 3).map((emp) =>
                      emp.avatar_url ? (
                        <img key={emp.id} src={emp.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover border border-white" />
                      ) : (
                        <div key={emp.id} className="w-5 h-5 rounded-full bg-card-border flex items-center justify-center text-[8px] font-bold text-muted border border-white">
                          {emp.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )
                    )}
                    {selectedEmps.length > 3 && (
                      <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[8px] font-bold text-accent border border-white">
                        +{selectedEmps.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="truncate text-xs">
                    {selectedEmps.length === 1
                      ? selectedEmps[0].name
                      : `${selectedEmps.length} assignees`}
                  </span>
                </div>
              ) : (
                <span>Select assignees...</span>
              )}
              <svg className="w-4 h-4 ml-auto text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div
                className="absolute z-30 left-0 right-0 mt-1 bg-card border border-card-border rounded-xl shadow-xl max-h-48 overflow-y-auto"
                style={{ animation: "fadeInScale 0.15s ease-out" }}
              >
                {employees.map((emp) => {
                  const isSelected = assignees.includes(emp.name);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => toggleAssignee(emp.name)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-accent/5 transition-colors ${
                        isSelected ? "bg-accent/10 text-accent font-medium" : "text-foreground"
                      }`}
                    >
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-card-border flex items-center justify-center text-[9px] font-bold text-muted">
                          {emp.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      {emp.name}
                      <div className={`w-4 h-4 ml-auto rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? "bg-accent border-accent" : "border-gray-300"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Due date picker */}
          <div className="relative">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-40 px-4 py-3 bg-background border border-card-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={!input.trim() || assignees.length === 0}
          className="w-full py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all disabled:opacity-30 btn-press"
        >
          Add Action Item
        </button>
      </div>
      </div>

      {/* Action items table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      ) : actions.length > 0 ? (
        <div className="rounded-2xl overflow-hidden retro-card-depth" style={{ background: "linear-gradient(180deg, rgba(240, 247, 244, 0.95) 0%, rgba(255, 255, 255, 0.8) 100%)", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
          <div className="overflow-x-auto">
          <div className="grid grid-cols-[1fr_140px_110px_40px] gap-3 px-5 py-3.5 border-b border-primary/10 text-[11px] font-semibold text-muted uppercase tracking-wider min-w-[500px]" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.6), rgba(230, 236, 247, 0.5))" }}>
            <span>Action</span>
            <span>Assignee</span>
            <span className="text-right">Due Date</span>
            <span></span>
          </div>
          <div className="divide-y divide-card-border/60">
            {actions.map((a) => {
              const due = a.due_date ? formatDueDate(a.due_date) : null;
              const assigneeNames = a.assignee ? a.assignee.split(", ") : [];
              const empMatches = assigneeNames.map((n) => employees.find((e) => e.name === n)).filter(Boolean);
              return (
                <div key={a.id} className="grid grid-cols-[1fr_140px_110px_40px] gap-3 px-5 py-3.5 items-center hover:bg-card-border/10 transition-colors min-w-[500px]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.content}</p>
                    <p className="text-[10px] text-muted">added by {a.user_name}</p>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {empMatches.length > 0 ? (
                      <div className="flex -space-x-1.5 flex-shrink-0">
                        {empMatches.slice(0, 3).map((emp) =>
                          emp.avatar_url ? (
                            <img key={emp.id} src={emp.avatar_url} alt={emp.name} title={emp.name} className="w-7 h-7 rounded-full object-cover border border-card-border" />
                          ) : (
                            <div key={emp.id} title={emp.name} className="w-7 h-7 rounded-full bg-card-border flex items-center justify-center text-[10px] font-bold text-muted border border-white">
                              {emp.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )
                        )}
                        {empMatches.length > 3 && (
                          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent border border-white">
                            +{empMatches.length - 3}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-card-border flex items-center justify-center text-[10px] font-bold text-muted flex-shrink-0">
                        {(a.assignee || a.user_name)?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-foreground truncate">
                      {assigneeNames.length > 1 ? `${assigneeNames.length} people` : (a.assignee || a.user_name)}
                    </span>
                  </div>
                  <div className="text-right">
                    {due ? (
                      <div className="inline-flex flex-col items-end">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${due.color}`}>{due.text}</span>
                        <span className={`text-[10px] mt-0.5 ${due.color.split(" ")[0]}`}>{due.label}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted/50">No date</span>
                    )}
                  </div>
                  <button
                    onClick={() => { removeItem(a.id); if (boardBroadcast) boardBroadcast("remove", { phase: "action_items", id: a.id }); }}
                    className="text-muted hover:text-danger transition-colors p-1 rounded-lg hover:bg-danger/10"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          </div>
          <div className="px-5 py-3 bg-card-border/10 border-t border-card-border">
            <span className="text-xs text-muted">{actions.length} action item{actions.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted/60">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm">No action items yet.</p>
        </div>
      )}

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 8 – Appreciation (persisted)                                 */
/* ------------------------------------------------------------------ */
function AppreciationPhase({ onNext, onPrev, boardEvent, boardBroadcast }) {
  const { items: kudos, loading, addItem, externalAdd } = useRetroItems("appreciation");
  const [who, setWho] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!boardEvent || boardEvent.phase !== "appreciation") return;
    if (boardEvent.type === "add") externalAdd(boardEvent.item);
  }, [boardEvent, externalAdd]);

  const handleAdd = async () => {
    if (who.trim() && reason.trim()) {
      const newItem = await addItem(`@${who.trim()}: ${reason.trim()}`);
      if (newItem && boardBroadcast) boardBroadcast("add", { phase: "appreciation", item: newItem });
      setWho("");
      setReason("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PhaseHeader
        icon={<HandHeartIcon className="w-8 h-8" />}
        title="Appreciation"
        description="Give shoutouts to teammates who made a difference this sprint."
      />

      <div className="retro-gradient-border rounded-2xl overflow-hidden">
        <div className="rounded-2xl p-5 flex gap-2" style={{ background: "linear-gradient(145deg, rgba(252, 231, 243, 0.3), rgba(240, 247, 244, 0.95), rgba(230, 236, 247, 0.9))" }}>
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Who?"
            className="w-36 px-4 py-3 bg-background/80 border border-pink-200/50 rounded-xl text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-pink-400/30 transition-all"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="What did they do that was awesome?"
            className="flex-1 px-4 py-3 bg-background/80 border border-pink-200/50 rounded-xl text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-pink-400/30 transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!who.trim() || !reason.trim()}
            className="px-5 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-pink-500/20 hover:shadow-xl hover:shadow-pink-500/30 hover:scale-105 transition-all disabled:opacity-30 disabled:shadow-none btn-press"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      ) : kudos.length > 0 ? (
        <div className="space-y-3">
          {kudos.map((k, idx) => {
            const parts = k.content.match(/^@([^:]+):\s*(.+)$/);
            const name = parts ? parts[1] : k.user_name;
            const msg = parts ? parts[2] : k.content;
            return (
              <div
                key={k.id}
                className="relative overflow-hidden rounded-2xl p-5 hover:shadow-xl transition-all duration-300 group retro-card-depth"
                style={{ animation: "retroSlideIn 0.4s ease-out both", animationDelay: `${idx * 80}ms`, background: "linear-gradient(135deg, rgba(252, 231, 243, 0.5), rgba(240, 247, 244, 0.9), rgba(230, 236, 247, 0.85))", border: "1px solid rgba(236, 72, 153, 0.12)" }}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-400 via-rose-500 to-pink-400 rounded-r-full" />
                <div className="absolute top-3 right-4 opacity-10 group-hover:opacity-20 transition-opacity"><HeartIcon className="w-6 h-6 text-pink-400" /></div>
                <div className="flex items-center gap-3 mb-2.5 pl-3">
                  {k.avatar_url ? (
                    <img src={k.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-pink-400/30 ring-offset-2" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-pink-500/20">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">@{name}</span>
                    <span className="text-[10px] text-muted block">shoutout by {k.user_name}</span>
                  </div>
                </div>
                <p className="text-sm text-foreground pl-15 leading-relaxed">{msg}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted/60">
          <span className="block mb-3 opacity-30 retro-float-slow"><HeartIcon className="w-12 h-12 mx-auto text-pink-400" /></span>
          <p className="text-sm font-medium">No shoutouts yet</p>
          <p className="text-xs text-muted/40 mt-0.5">Appreciate your teammates above!</p>
        </div>
      )}

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 9 – Time Check (Was It Worth It?)                             */
/* ------------------------------------------------------------------ */
const WORTH_OPTIONS = [
  { emoji: (cls = "w-6 h-6") => <CheckCircleIcon className={cls} />, label: "Absolutely", bg: "from-green-400/20 to-green-500/10", border: "border-green-400/50", text: "text-green-600", bar: "bg-green-500" },
  { emoji: (cls = "w-6 h-6") => <FaceGoodIcon className={cls} />, label: "Mostly Yes", bg: "from-blue-400/20 to-blue-500/10", border: "border-blue-400/50", text: "text-blue-600", bar: "bg-blue-500" },
  { emoji: (cls = "w-6 h-6") => <FaceNeutralIcon className={cls} />, label: "It Was Okay", bg: "from-yellow-400/20 to-yellow-500/10", border: "border-yellow-400/50", text: "text-yellow-600", bar: "bg-yellow-500" },
  { emoji: (cls = "w-6 h-6") => <FaceConcernedIcon className={cls} />, label: "Not Really", bg: "from-orange-400/20 to-orange-500/10", border: "border-orange-400/50", text: "text-orange-600", bar: "bg-orange-500" },
  { emoji: (cls = "w-6 h-6") => <XCircleIcon className={cls} />, label: "Not At All", bg: "from-red-400/20 to-red-500/10", border: "border-red-400/50", text: "text-red-600", bar: "bg-red-500" },
];

const getWorthObj = (label) => WORTH_OPTIONS.find((w) => w.label === label);

function EmployeeMeetingWorthPicker({ actionEvent }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [votes, setVotes] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMy, setLoadingMy] = useState(true);

  useEffect(() => {
    if (!token || !sessionId) { setLoadingMy(false); return; }
    fetch(`/api/retro/meeting-worth?session_id=${sessionId}&_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.myVote) {
          setSelected(d.myVote);
          setSubmitted(true);
        }
      })
      .finally(() => setLoadingMy(false));
  }, [token, sessionId]);

  useEffect(() => {
    if (!actionEvent || actionEvent.type !== "worth_reveal") return;
    setRevealed(true);
    if (!token || !sessionId) return;
    fetch(`/api/retro/meeting-worth?session_id=${sessionId}&_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setVotes(d.votes || []))
      .catch((err) => console.error("fetchWorthVotes error:", err));
  }, [actionEvent, token, sessionId]);

  const submit = async () => {
    if (!selected || !token || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/retro/meeting-worth", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vote: selected, session_id: sessionId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Meeting worth submit error:", errData.error || res.statusText);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Meeting worth submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const changeVote = () => { setSubmitted(false); };

  if (loadingMy) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (submitted) {
    const w = getWorthObj(selected);
    const worthCounts = WORTH_OPTIONS.map((wo) => ({
      ...wo,
      count: votes.filter((v) => v.vote === wo.label).length,
    }));
    const maxCount = Math.max(...worthCounts.map((wo) => wo.count), 1);
    const totalSubmitted = votes.length;

    return (
      <div className={`${revealed ? "max-w-3xl" : "max-w-md"} mx-auto text-center space-y-5`}>
        <PhaseHeader
          icon={<ScaleIcon className="w-8 h-8" />}
          title="Was It Worth It?"
          description={revealed ? "Here's what the team thinks about this meeting." : "Your vote has been recorded. Waiting for the facilitator to reveal results."}
        />
        <div
          className={`inline-flex flex-col items-center gap-3 px-10 py-6 rounded-2xl border-2 bg-gradient-to-b ${w?.bg || ""} ${w?.border || ""}`}
          style={{ animation: "fadeInScale 0.3s ease-out" }}
        >
          <span>{w?.emoji("w-12 h-12")}</span>
          <span className={`text-sm font-bold ${w?.text}`}>{w?.label}</span>
        </div>
        {!revealed && (
          <button
            onClick={changeVote}
            className="text-xs text-muted hover:text-accent underline underline-offset-2 transition-colors"
          >
            Change my response
          </button>
        )}

        {revealed && (
          <div
            className="retro-gradient-border rounded-2xl overflow-hidden text-left"
            style={{ animation: "retroSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <div className="rounded-2xl p-5 space-y-4" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center shadow-sm">
                  <ScaleIcon className="w-4 h-4 text-accent" />
                </div>
                Meeting Value Results
              </h3>

              <div className="space-y-3">
                {worthCounts.map((wc) => (
                  <div key={wc.label} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <span>{wc.emoji("w-5 h-5")}</span>
                      <span className={`text-xs font-semibold ${wc.text}`}>{wc.label}</span>
                    </div>
                    <div className="flex-1 h-7 bg-card-border/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${wc.bar} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max((wc.count / maxCount) * 100, wc.count > 0 ? 12 : 0)}%`, opacity: 0.8 }}
                      >
                        {wc.count > 0 && (
                          <span className="text-[10px] font-bold text-white">{wc.count}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-muted w-8 text-right">
                      {totalSubmitted > 0 ? Math.round((wc.count / totalSubmitted) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-card-border/60 pt-4 mt-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Individual Responses</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {votes.map((entry) => {
                    const ew = getWorthObj(entry.vote);
                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r ${ew?.bg || ""} border ${ew?.border || "border-card-border"}`}
                        style={{ animation: "fadeInUp 0.3s ease-out both" }}
                      >
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-[10px] font-bold text-muted">
                            {entry.user_name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{entry.user_name}</span>
                        <span>{ew?.emoji("w-5 h-5")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <PhaseHeader
        icon={<ScaleIcon className="w-8 h-8" />}
        title="Was It Worth It?"
        description="Was this meeting a good use of your time? Be honest — your feedback helps us improve."
      />

      <div className="flex justify-center gap-3 py-2">
        {WORTH_OPTIONS.map((w) => (
          <button
            key={w.label}
            onClick={() => setSelected(w.label)}
            className={`flex flex-col items-center gap-3 px-5 py-6 rounded-2xl border-2 transition-all duration-300 btn-press ${
              selected === w.label
                ? `bg-gradient-to-b ${w.bg} ${w.border} scale-110 shadow-xl ring-4 ring-offset-2 ${w.border.replace("border-", "ring-")}/20`
                : "hover:shadow-lg hover:scale-105 hover:-translate-y-1"
            }`}
            style={selected !== w.label ? { background: "linear-gradient(180deg, rgba(240, 247, 244, 0.9), rgba(230, 236, 247, 0.8))", borderColor: "rgba(6, 194, 134, 0.12)" } : undefined}
          >
            <span className={`transition-transform duration-300 ${selected === w.label ? "scale-125 retro-icon-pulse" : ""}`}>
              {w.emoji("w-10 h-10")}
            </span>
            <span className={`text-[11px] font-bold ${selected === w.label ? w.text : "text-muted"}`}>
              {w.label}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={!selected || submitting}
        className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white rounded-2xl text-sm font-semibold shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:scale-[1.01] transition-all disabled:opacity-40 disabled:shadow-none btn-press btn-shimmer"
      >
        {submitting ? "Submitting..." : "Submit My Vote"}
      </button>
    </div>
  );
}

function MeetingWorthAdmin({ employees, onNext, onPrev, actionEvent, broadcastAction }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [votes, setVotes] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [polling, setPolling] = useState(true);
  const [myVote, setMyVote] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!actionEvent || actionEvent.type !== "worth_reveal") return;
    setRevealed(true);
    setPolling(false);
  }, [actionEvent]);

  const fetchVotes = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const res = await fetch(`/api/retro/meeting-worth?session_id=${sessionId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      setVotes(data.votes || []);
      if (data.myVote) setMyVote(data.myVote);
    } catch (err) { console.error("fetchWorthVotes error:", err); }
  }, [token, sessionId]);

  useEffect(() => {
    if (!token || !sessionId) return;
    fetchVotes();
    if (!polling) return;
    const id = setInterval(fetchVotes, 2000);
    return () => clearInterval(id);
  }, [token, sessionId, fetchVotes, polling]);

  const submitMyVote = async (vote) => {
    if (!token || !sessionId) return;
    setMyVote(vote);
    setSubmitting(true);
    try {
      const res = await fetch("/api/retro/meeting-worth", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vote, session_id: sessionId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("submitMyVote API error:", errData.error || res.statusText);
        setMyVote(null);
        return;
      }
      const res2 = await fetch(`/api/retro/meeting-worth?session_id=${sessionId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res2.json();
      setVotes(data.votes || []);
      if (data.myVote) setMyVote(data.myVote);
    } catch (err) {
      console.error("submitMyVote error:", err);
      setMyVote(null);
    } finally {
      setSubmitting(false);
    }
  };

  const totalEmployees = employees.length;
  const totalSubmitted = votes.length;
  const totalPending = Math.max(totalEmployees - totalSubmitted, 0);
  const pct = totalEmployees > 0 ? Math.round((totalSubmitted / totalEmployees) * 100) : 0;

  const worthCounts = WORTH_OPTIONS.map((w) => ({
    ...w,
    count: votes.filter((v) => v.vote === w.label).length,
  }));
  const maxCount = Math.max(...worthCounts.map((w) => w.count), 1);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PhaseHeader
        icon={<ScaleIcon className="w-8 h-8" />}
        title="Was It Worth It?"
        description="Submit your vote, wait for the team, then reveal results."
      />

      <div className="rounded-2xl p-5 retro-card-depth" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95), rgba(230, 236, 247, 0.9))", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Your Vote</h3>
          {myVote && (
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Submitted
            </span>
          )}
        </div>
        <div className="flex justify-center gap-2.5">
          {WORTH_OPTIONS.map((w) => (
            <button
              key={w.label}
              onClick={() => submitMyVote(w.label)}
              disabled={submitting}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all duration-300 btn-press backdrop-blur-sm ${
                myVote === w.label
                  ? `bg-gradient-to-b ${w.bg} ${w.border} scale-110 shadow-lg`
                  : "border-white/50 bg-white/40 hover:bg-white/60 hover:shadow-md hover:scale-105"
              }`}
            >
              <span className={`transition-transform duration-300 ${myVote === w.label ? "scale-110" : ""}`}>
                {w.emoji("w-7 h-7")}
              </span>
              <span className={`text-[9px] font-semibold ${myVote === w.label ? w.text : "text-muted"}`}>
                {w.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4 retro-card-depth" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95), rgba(230, 236, 247, 0.9))", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${polling ? "bg-green-500 animate-pulse shadow-sm shadow-green-500/50" : "bg-card-border"}`} />
            Live Tracker
          </h3>
          <button onClick={fetchVotes} className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-card-border" />
              <circle
                cx="60" cy="60" r="50" fill="none" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={314}
                strokeDashoffset={314 - (314 * pct) / 100}
                className="text-primary transition-all duration-700 ease-out"
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-foreground">{pct}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Submitted</span>
              <span className="text-lg font-bold text-primary">{totalSubmitted}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Pending</span>
              <span className="text-lg font-bold text-danger">{totalPending}</span>
            </div>
            <div className="flex items-center justify-between border-t border-card-border/60 pt-2">
              <span className="text-sm text-muted">Total Team</span>
              <span className="text-lg font-bold text-foreground">{totalEmployees}</span>
            </div>
          </div>
        </div>

        {totalSubmitted > 0 && (
          <div className="flex items-center gap-1 pt-1">
            <span className="text-[10px] text-muted font-medium mr-1">Submitted:</span>
            <div className="flex -space-x-2">
              {votes.slice(0, 12).map((v) => (
                <div
                  key={v.user_id}
                  className="w-7 h-7 rounded-full border-2 border-card bg-card-border flex items-center justify-center text-[9px] font-bold text-muted"
                  title={v.user_name}
                >
                  {v.avatar_url ? (
                    <img src={v.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    v.user_name?.charAt(0)?.toUpperCase() || "?"
                  )}
                </div>
              ))}
              {totalSubmitted > 12 && (
                <div className="w-7 h-7 rounded-full border-2 border-card bg-card-border flex items-center justify-center text-[9px] font-bold text-muted">
                  +{totalSubmitted - 12}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!revealed && (
        <button
          onClick={() => {
            setRevealed(true);
            setPolling(false);
            if (broadcastAction) broadcastAction({ type: "worth_reveal" });
          }}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-orange-500/25 transition-all btn-press"
        >
          <span className="inline-flex items-center gap-1.5"><SparklesIcon className="w-4 h-4" /> Reveal Results ({totalSubmitted} response{totalSubmitted !== 1 ? "s" : ""})</span>
        </button>
      )}

      {revealed && (
        <div
          className="retro-gradient-border rounded-2xl overflow-hidden"
          style={{ animation: "retroSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center shadow-sm">
              <ScaleIcon className="w-4 h-4 text-accent" />
            </div>
            Meeting Value Results
          </h3>

          <div className="space-y-3">
            {worthCounts.map((w) => (
              <div key={w.label} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <span>{w.emoji("w-5 h-5")}</span>
                  <span className={`text-xs font-semibold ${w.text}`}>{w.label}</span>
                </div>
                <div className="flex-1 h-7 bg-card-border/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${w.bar} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                    style={{ width: `${Math.max((w.count / maxCount) * 100, w.count > 0 ? 12 : 0)}%`, opacity: 0.8 }}
                  >
                    {w.count > 0 && (
                      <span className="text-[10px] font-bold text-white">{w.count}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-muted w-8 text-right">
                  {totalSubmitted > 0 ? Math.round((w.count / totalSubmitted) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-card-border/60 pt-4 mt-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Individual Responses</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {votes.map((entry) => {
                const ew = getWorthObj(entry.vote);
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r ${ew?.bg || ""} border ${ew?.border || "border-card-border"}`}
                    style={{ animation: "fadeInUp 0.3s ease-out both" }}
                  >
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-[10px] font-bold text-muted">
                        {entry.user_name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{entry.user_name}</span>
                    <span>{ew?.emoji("w-5 h-5")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>
      )}

      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

function MeetingWorthPhase({ employees, role, onNext, onPrev, actionEvent, broadcastAction }) {
  const isAdmin = role === "scrum_master" || role === "super_admin";
  if (isAdmin) return <MeetingWorthAdmin employees={employees} onNext={onNext} onPrev={onPrev} actionEvent={actionEvent} broadcastAction={broadcastAction} />;
  return <EmployeeMeetingWorthPicker actionEvent={actionEvent} />;
}

/* ------------------------------------------------------------------ */
/*  Phase 10 – Close & Summary                                         */
/* ------------------------------------------------------------------ */
function CloseSummaryPhase({ onPrev, onFinish }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 relative">
      <div className="absolute -top-12 -right-20 w-44 h-44 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl pointer-events-none retro-float" />
      <div className="absolute -bottom-12 -left-16 w-40 h-40 rounded-full bg-gradient-to-tr from-accent/10 to-transparent blur-3xl pointer-events-none retro-float-reverse" />

      <div className="text-center space-y-5 mb-3 retro-slide-in relative">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-[24px] bg-gradient-to-br from-accent/15 to-primary/15 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
          <div className="relative w-20 h-20 rounded-[22px] bg-white border border-card-border/15 shadow-lg flex items-center justify-center" style={{ boxShadow: "0 8px 32px rgba(0, 50, 100, 0.08)" }}>
            <SparklesIcon className="w-10 h-10" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent bg-[length:200%_100%]" style={{ animation: "retroGradientShift 6s ease-in-out infinite" }}>Retrospective Complete!</h2>
        <p className="text-muted/80 text-[13px] max-w-md mx-auto leading-relaxed font-medium">
          Great session! Remember — continuous improvement is a journey, not a destination.
          Take the action items forward and make the next sprint even better.
        </p>
      </div>

      <div className="rounded-3xl retro-slide-in-delay-1" style={{ border: "1px solid rgba(6, 194, 134, 0.1)", boxShadow: "0 8px 40px rgba(0, 50, 100, 0.06)" }}>
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "linear-gradient(145deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 252, 0.88) 100%)" }}>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            Completed Phases
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {PHASES.map((phase, idx) => (
              <div
                key={phase.id}
                className="flex items-center gap-2.5 p-3 rounded-xl text-sm transition-all duration-200 hover:scale-[1.02]"
                style={{ animation: "retroSlideIn 0.3s ease-out both", animationDelay: `${idx * 50}ms`, background: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(0, 0, 0, 0.04)" }}
              >
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-primary text-white flex items-center justify-center shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-foreground/80 font-medium inline-flex items-center gap-1.5">{phase.icon("w-4 h-4")} {phase.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(onPrev || onFinish) && (
        <div className="flex items-center justify-between pt-7 mt-7 border-t border-card-border/15 retro-slide-in-delay-2">
          <button
            onClick={onPrev}
            className="group flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-semibold text-muted hover:text-foreground backdrop-blur-sm transition-all duration-300 btn-press"
            style={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(240, 247, 244, 0.6))", border: "1px solid rgba(6, 194, 134, 0.1)" }}
          >
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button
            onClick={onFinish}
            className="group relative flex items-center gap-2.5 px-8 py-3.5 text-white rounded-2xl text-sm font-bold shadow-xl hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 btn-press overflow-hidden"
            style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)", boxShadow: "0 8px 30px rgba(6, 194, 134, 0.3), 0 2px 8px rgba(0, 50, 150, 0.15)" }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative">Finish Retrospective</span>
            <svg className="relative w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Facilitator Widget – inline indicator below progress bar            */
/* ------------------------------------------------------------------ */
function FacilitatorWidget({ facilitatorInfo, currentPhase }) {
  if (!facilitatorInfo) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-card-border/40 backdrop-blur-sm retro-slide-in"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.88) 0%, rgba(240,247,244,0.92) 50%, rgba(230,236,247,0.88) 100%)",
        boxShadow: "0 2px 10px rgba(0,50,100,0.06), 0 1px 4px rgba(6,194,134,0.06)",
      }}
    >
      <div className="relative flex-shrink-0">
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        {facilitatorInfo.avatar ? (
          <img
            src={facilitatorInfo.avatar}
            alt={facilitatorInfo.name}
            className="w-8 h-8 rounded-lg object-cover border-2 border-white shadow-sm"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/15 via-accent/10 to-primary/20 border-2 border-white shadow-sm flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-dark">
              {facilitatorInfo.name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-wider text-accent">Facilitator</span>
        <p className="text-xs font-semibold text-foreground truncate max-w-[120px] leading-tight">
          {facilitatorInfo.name}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Employee Retro View – follows the facilitator's phase via polling   */
/* ------------------------------------------------------------------ */
function EmployeeRetroView({ token, employees: allEmployees, role, icebreakerState, spinTrigger, boardEvent, boardBroadcast, groupEvent, groupBroadcast, toggleEvent, broadcastToggle, voteEvent, itemVoteEvent, broadcastVoteChange, broadcastItemVote, phaseEvent: parentPhaseEvent, finishEvent: parentFinishEvent, actionEvent, timerEvent, requestTimer, onSessionPresenceChange }) {
  const [currentPhase, setCurrentPhase] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessionTeamIds, setSessionTeamIds] = useState([]);
  const [hasSession, setHasSession] = useState(false);
  const [employees, setEmployees] = useState(allEmployees);
  const [facilitatorInfo, setFacilitatorInfo] = useState(null);
  const teamFetchedRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/retro/session?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json();
        if (!active) return;
        if (data.session) {
          setHasSession(true);
          setSessionId(data.session.id);
          setCurrentPhase(data.session.current_phase ?? 0);
          onSessionPresenceChange?.(true);
          if (data.session.facilitator_id) {
            setFacilitatorInfo({
              id: data.session.facilitator_id,
              name: data.session.facilitator_name,
              avatar: data.session.facilitator_avatar,
            });
          }
          const raw = data.session.team_id || "";
          const teams = raw ? raw.split(",").filter(Boolean) : [];
          setSessionTeamIds(teams);

          if (teamFetchedRef.current !== (raw || "all")) {
            teamFetchedRef.current = raw || "all";
            const filter = raw ? `?team_id=${raw}` : "";
            fetch(`/api/retro/employees${filter}`)
              .then((r) => r.json())
              .then((ed) => { if (active) setEmployees(ed.employees || []); })
              .catch(() => {});
          }
        } else {
          setHasSession(false);
          setSessionId(null);
          setSessionTeamIds([]);
          setCurrentPhase(null);
          setFacilitatorInfo(null);
          onSessionPresenceChange?.(false);
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => { active = false; clearInterval(interval); };
  }, [token, onSessionPresenceChange]);

  /* Real-time phase sync from facilitator (instant, supplements polling) */
  useEffect(() => {
    if (!parentPhaseEvent) return;
    setCurrentPhase(parentPhaseEvent.phase);
    if (parentPhaseEvent.facilitator) {
      setFacilitatorInfo(parentPhaseEvent.facilitator);
    }
    if (parentPhaseEvent.sessionId && !sessionId) {
      setSessionId(parentPhaseEvent.sessionId);
      setHasSession(true);
    }
    onSessionPresenceChange?.(true);
  }, [parentPhaseEvent, sessionId, onSessionPresenceChange]);

  /* Real-time finish sync from facilitator */
  useEffect(() => {
    if (!parentFinishEvent) return;
    setHasSession(false);
    setSessionId(null);
    setSessionTeamIds([]);
    setCurrentPhase(null);
    setFacilitatorInfo(null);
    onSessionPresenceChange?.(false);
  }, [parentFinishEvent, onSessionPresenceChange]);

  if (!hasSession || currentPhase === null) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-5 relative">
        <div className="absolute -top-8 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl pointer-events-none retro-float" />
        <div className="absolute -bottom-8 -left-16 w-36 h-36 rounded-full bg-gradient-to-tr from-accent/10 to-transparent blur-3xl pointer-events-none retro-float-reverse" />

        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 to-accent/15 blur-xl retro-icon-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 via-white to-accent/10 border border-white/60 shadow-lg flex items-center justify-center retro-icon-pulse">
            <ArrowPathIcon className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-foreground via-foreground to-accent bg-clip-text text-transparent">Sprint Retrospective</h1>
        {sessionTeamIds.length > 0 && (
          <div className="flex justify-center gap-1.5 flex-wrap">
            {sessionTeamIds.map((tid) => (
              <span key={tid} className={`inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full border ${getTeamColor(tid)}`}>
                {getTeamLabel(tid)}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <span>Waiting for the facilitator to start the session...</span>
        </div>

        <WaitingLobbyGame />

        <p className="text-[11px] text-muted/60 pt-2">Play while you wait — the session will start automatically</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={sessionId}>
      <div className="space-y-8">
        <div className="max-w-4xl mx-auto space-y-3">
          {sessionTeamIds.length > 0 && (
            <div className="flex justify-center gap-1.5 flex-wrap">
              {sessionTeamIds.map((tid) => (
                <span key={tid} className={`text-[10px] font-semibold px-3 py-1.5 rounded-full border shadow-sm ${getTeamColor(tid)}`}>
                  {getTeamLabel(tid)}
                </span>
              ))}
            </div>
          )}
          <ProgressBar currentPhase={currentPhase} />
          <div className="flex items-center justify-between retro-slide-in-delay-1">
            <FacilitatorWidget facilitatorInfo={facilitatorInfo} currentPhase={currentPhase} />
            <PhaseTimer phaseIndex={currentPhase} isFacilitator={false} timerEvent={timerEvent} requestTimer={requestTimer} />
          </div>
        </div>

        <div className={`min-h-[420px] mx-auto retro-phase-in ${[3, 4, 5, 6].includes(currentPhase) ? "max-w-full px-8" : "max-w-4xl"}`}>
          {currentPhase === 0 && <EmployeeIceBreakerView employees={employees} icebreakerState={icebreakerState} spinTrigger={spinTrigger} />}
          {currentPhase === 1 && <EmployeeMoodPicker actionEvent={actionEvent} />}
          {currentPhase === 2 && <PreviousOpenActionsPhase employees={employees} role={role} onNext={null} onPrev={null} toggleEvent={toggleEvent} broadcastToggle={broadcastToggle} />}
          {currentPhase === 3 && <RetroBoardPhase onNext={null} onPrev={null} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />}
          {currentPhase === 4 && <AIGroupPhase role={role} isFacilitator={false} onNext={null} onPrev={null} groupEvent={groupEvent} groupBroadcast={groupBroadcast} />}
          {currentPhase === 5 && <VotingPhase employees={employees} role={role} onNext={null} onPrev={null} voteEvent={voteEvent} itemVoteEvent={itemVoteEvent} broadcastVoteChange={broadcastVoteChange} broadcastItemVote={broadcastItemVote} groupBroadcast={groupBroadcast} groupEvent={groupEvent} />}
          {currentPhase === 6 && <VoteResultsPhase onNext={null} onPrev={null} />}
          {currentPhase === 7 && <ActionItemsPhase employees={employees} onNext={null} onPrev={null} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />}
          {currentPhase === 8 && <AppreciationPhase onNext={null} onPrev={null} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />}
          {currentPhase === 9 && <EmployeeMeetingWorthPicker actionEvent={actionEvent} />}
          {currentPhase === 10 && <CloseSummaryPhase onPrev={null} onFinish={null} />}
        </div>
      </div>
    </SessionContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function RetrospectivePage() {
  const { user, role, loading: authLoading } = useAuth();
  const token = useAccessToken();
  const [currentPhase, setCurrentPhase] = useState(0);
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [sessionTeamIds, setSessionTeamIds] = useState([]);
  /** Employees who join after start never get `started` on parent; this keeps realtime channels in sync. */
  const [employeeRetroLive, setEmployeeRetroLive] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [facilitatorInfo, setFacilitatorInfo] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [completedSessions, setCompletedSessions] = useState([]);
  const [expandedSession, setExpandedSession] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [showFacilitatorMenu, setShowFacilitatorMenu] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const phaseContentRef = useRef(null);
  const phaseScreenshotsRef = useRef([]);

  const isAdmin = ALLOWED_ROLES.includes(role);
  const isFacilitator = isAdmin && !!user?.id && !!facilitatorInfo?.id && user.id === facilitatorInfo.id;
  const retroChannelsActive = isAdmin ? started : started || employeeRetroLive;
  const onEmployeeSessionPresenceChange = useCallback((live) => {
    setEmployeeRetroLive(!!live);
  }, []);
  const { icebreakerState, spinTrigger, broadcastIcebreakerState, broadcastSpin } = useRetroChannel(
    isAdmin ? "admin" : "employee",
    retroChannelsActive,
  );
  const { event: boardEvent, broadcast: boardBroadcast } = useRetroBoardChannel(retroChannelsActive);
  const { event: groupEvent, broadcast: groupBroadcast } = useRetroGroupChannel(retroChannelsActive);
  const { toggleEvent, broadcastToggle } = useOpenActionsChannel(retroChannelsActive);
  const { voteEvent, itemVoteEvent, broadcastVoteChange, broadcastItemVote } = useVoteTrackerChannel(retroChannelsActive);
  const { phaseEvent, finishEvent, actionEvent, timerEvent, timerRequestEvent, broadcastPhase, broadcastFinish, broadcastStart, broadcastAction, broadcastTimer, requestTimer } = useRetroPhaseSyncChannel();

  useEffect(() => {
    fetch("/api/retro/employees")
      .then((r) => r.json())
      .then((d) => {
        setAllEmployees(d.employees || []);
        setEmployees(d.employees || []);
      })
      .catch(() => {});
  }, []);

  const fetchHistory = useCallback(() => {
    if (!token) return;
    fetch("/api/retro/history", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`History API returned ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setCompletedSessions(d.sessions || []);
      })
      .catch((err) => {
        console.error("Failed to fetch retro history:", err);
      });
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!token || started) return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetchHistory();
    }, 30000);
    return () => clearInterval(interval);
  }, [token, started, fetchHistory]);

  const toggleSession = async (sessionId) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      setExpandedData(null);
      return;
    }
    setExpandedSession(sessionId);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/retro/history?session_id=${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setExpandedData(d);
    } catch {
      setExpandedData(null);
    }
    setLoadingHistory(false);
  };

  const filteredEmployees = selectedTeams.length === 0
    ? allEmployees
    : allEmployees.filter((e) => (e.teams || []).some((t) => selectedTeams.includes(t)));

  useEffect(() => {
    if (!token) return;
    fetch(`/api/retro/session?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.session) {
          setSessionId(d.session.id);
          setCurrentPhase(d.session.current_phase ?? 0);
          setStarted(true);
          if (d.session.facilitator_id) {
            setFacilitatorInfo({
              id: d.session.facilitator_id,
              name: d.session.facilitator_name,
              avatar: d.session.facilitator_avatar,
            });
          }
          const raw = d.session.team_id || "";
          const teams = raw ? raw.split(",").filter(Boolean) : [];
          setSessionTeamIds(teams);
          setSelectedTeams(teams);
          if (teams.length > 0) {
            fetch(`/api/retro/employees?team_id=${raw}`)
              .then((r) => r.json())
              .then((ed) => setEmployees(ed.employees || []))
              .catch(() => {});
          }
        } else if (!isAdmin) {
          setEmployeeRetroLive(false);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, [token, isAdmin]);

  const syncPhase = useCallback(async (phase) => {
    if (!token || !sessionId) return;
    try {
      await fetch("/api/retro/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId, current_phase: phase }),
      });
      broadcastPhase({
        phase,
        sessionId,
        facilitator: facilitatorInfo,
      });
    } catch {}
  }, [token, sessionId, broadcastPhase, facilitatorInfo]);

  const startMeeting = async () => {
    if (!token) return;
    try {
      const teamId = selectedTeams.length > 0 ? selectedTeams.join(",") : null;
      const res = await fetch("/api/retro/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ team_id: teamId, title: meetingTitle || null }),
      });
      const data = await res.json();
      if (data.session) {
        setSessionId(data.session.id);
        setSessionTeamIds(selectedTeams);
        setCurrentPhase(0);
        setStarted(true);

        const fInfo = {
          id: user?.id,
          name: user?.user_metadata?.name || user?.email || "Unknown",
          avatar: user?.user_metadata?.avatar_url || null,
        };
        setFacilitatorInfo(fInfo);

        const teamFilter = teamId ? `?team_id=${teamId}` : "";
        fetch(`/api/retro/employees${teamFilter}`)
          .then((r) => r.json())
          .then((ed) => setEmployees(ed.employees || []))
          .catch(() => {});

        setTimeout(() => {
          fetch("/api/retro/session", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ session_id: data.session.id, current_phase: 0 }),
          }).catch(() => {});
          broadcastStart({
            sessionId: data.session.id,
            facilitator: fInfo,
          });
        }, 100);
      }
    } catch {}
  };

  const captureCurrentPhase = useCallback(async (phaseIdx) => {
    const el = phaseContentRef.current;
    if (!el) return;
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        scrollY: -window.scrollY,
        height: el.scrollHeight,
        width: el.scrollWidth,
        windowHeight: el.scrollHeight,
        backgroundColor: "#f5f7fa",
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const existing = phaseScreenshotsRef.current.findIndex((s) => s.phaseId === phaseIdx);
      const entry = {
        phaseId: phaseIdx,
        phaseLabel: PHASES[phaseIdx]?.label || `Phase ${phaseIdx}`,
        dataUrl,
        imgWidth: canvas.width,
        imgHeight: canvas.height,
      };
      if (existing >= 0) phaseScreenshotsRef.current[existing] = entry;
      else phaseScreenshotsRef.current.push(entry);
    } catch (err) {
      console.error("Phase capture failed:", err);
    }
  }, []);

  const generateRetroPDF = useCallback(async (screenshots) => {
    const { default: jsPDF } = await import("jspdf");
    const sorted = [...screenshots].sort((a, b) => a.phaseId - b.phaseId);

    const PAGE_W_PT = 842;
    const MARGIN = 30;
    const HEADER_H = 40;
    const contentW = PAGE_W_PT - MARGIN * 2;

    let pdf = null;

    for (let i = 0; i < sorted.length; i++) {
      const { phaseLabel, dataUrl, imgWidth, imgHeight } = sorted[i];

      const scale = contentW / imgWidth;
      const scaledImgH = imgHeight * scale;
      const pageH = HEADER_H + scaledImgH + MARGIN;

      if (i === 0) {
        pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [PAGE_W_PT, pageH], compress: true });
      } else {
        pdf.addPage([PAGE_W_PT, pageH], "landscape");
      }

      pdf.setFillColor(245, 247, 250);
      pdf.rect(0, 0, PAGE_W_PT, pageH, "F");

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(40, 40, 40);
      pdf.text(`Phase ${sorted[i].phaseId + 1}: ${phaseLabel}`, MARGIN, MARGIN + 4);

      pdf.setDrawColor(6, 194, 134);
      pdf.setLineWidth(2);
      pdf.line(MARGIN, HEADER_H - 4, MARGIN + 60, HEADER_H - 4);

      pdf.addImage(dataUrl, "JPEG", MARGIN, HEADER_H, contentW, scaledImgH, undefined, "FAST");
    }
    return pdf;
  }, []);

  const uploadPDF = useCallback(async (pdf, sid) => {
    const blob = pdf.output("blob");
    const formData = new FormData();
    formData.append("file", blob, `retro-${sid}.pdf`);
    formData.append("session_id", sid);
    try {
      const res = await fetch("/api/retro/upload-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload returned ${res.status}`);
      const data = await res.json();
      if (data.pdf_url) return data.pdf_url;
      throw new Error("No pdf_url in response");
    } catch (err) {
      console.error("PDF upload failed, offering local download:", err);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `retrospective-${sid}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return null;
    }
  }, [token]);

  const next = async () => {
    if (isFacilitator) await captureCurrentPhase(currentPhase);
    setCurrentPhase((p) => {
      const newPhase = Math.min(p + 1, PHASES.length - 1);
      syncPhase(newPhase);
      return newPhase;
    });
  };
  const prev = () => {
    setCurrentPhase((p) => {
      const newPhase = Math.max(p - 1, 0);
      syncPhase(newPhase);
      return newPhase;
    });
  };
  const finish = async () => {
    if (token && sessionId) {
      try {
        if (isFacilitator) {
          setPdfGenerating(true);
          await captureCurrentPhase(currentPhase);
          const screenshots = phaseScreenshotsRef.current;
          if (screenshots.length > 0) {
            const pdf = await generateRetroPDF(screenshots);
            await uploadPDF(pdf, sessionId);
          }
          setPdfGenerating(false);
        }
        await fetch("/api/retro/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: sessionId }),
        });
        broadcastFinish({ sessionId });
      } catch (err) {
        console.error("Finish error:", err);
        setPdfGenerating(false);
      }
    }
    phaseScreenshotsRef.current = [];
    _phaseTimerState = {};
    _saveTimerCache({});
    setStarted(false);
    setEmployeeRetroLive(false);
    setSessionId(null);
    setSessionTeamIds([]);
    setSelectedTeams([]);
    setCurrentPhase(0);
    setFacilitatorInfo(null);
    setEmployees(allEmployees);
    setMeetingTitle("");
    fetchHistory();
  };

  const handleEndMeeting = async () => {
    setEnding(true);
    await finish();
    setShowEndConfirm(false);
    setEnding(false);
  };

  const handleArchiveMeeting = async () => {
    setArchiving(true);
    try {
      if (token && sessionId) {
        await fetch("/api/retro/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: sessionId, archive: true }),
        });
        broadcastFinish({ sessionId });
      }
      _phaseTimerState = {};
      _saveTimerCache({});
      setStarted(false);
      setEmployeeRetroLive(false);
      setSessionId(null);
      setSessionTeamIds([]);
      setSelectedTeams([]);
      setCurrentPhase(0);
      setFacilitatorInfo(null);
      setEmployees(allEmployees);
      setMeetingTitle("");
      fetchHistory();
    } catch {}
    setShowArchiveConfirm(false);
    setArchiving(false);
  };

  const handleDeleteSession = async (sid) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/retro/history?session_id=${sid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCompletedSessions((prev) => prev.filter((s) => s.id !== sid));
        if (expandedSession === sid) {
          setExpandedSession(null);
          setExpandedData(null);
        }
      }
    } catch (err) {
      console.error("Delete session failed:", err);
    }
    setDeleteConfirmId(null);
    setDeleting(false);
  };

  /* Phase sync: other admins follow the facilitator in real-time */
  useEffect(() => {
    if (!phaseEvent || !isAdmin || isFacilitator) return;
    setCurrentPhase(phaseEvent.phase);
    if (phaseEvent.facilitator) {
      setFacilitatorInfo(phaseEvent.facilitator);
    }
    if (phaseEvent.sessionId && !sessionId) {
      setSessionId(phaseEvent.sessionId);
      setStarted(true);
    }
  }, [phaseEvent]);

  /* Session finish sync: other admins reset when facilitator ends */
  useEffect(() => {
    if (!finishEvent || isFacilitator) return;
    _phaseTimerState = {};
    _saveTimerCache({});
    setStarted(false);
    setEmployeeRetroLive(false);
    setSessionId(null);
    setSessionTeamIds([]);
    setSelectedTeams([]);
    setCurrentPhase(0);
    setFacilitatorInfo(null);
    setEmployees(allEmployees);
    setMeetingTitle("");
  }, [finishEvent]);

  if (authLoading || checkingSession) {
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

  /* ---- Employee view: follows the facilitator's phase ---- */
  if (!isAdmin) {
    return (
      <AppLayout>
        <EmployeeRetroView token={token} employees={employees} role={role} icebreakerState={icebreakerState} spinTrigger={spinTrigger} boardEvent={boardEvent} boardBroadcast={boardBroadcast} groupEvent={groupEvent} groupBroadcast={groupBroadcast} toggleEvent={toggleEvent} broadcastToggle={broadcastToggle} voteEvent={voteEvent} itemVoteEvent={itemVoteEvent} broadcastVoteChange={broadcastVoteChange} broadcastItemVote={broadcastItemVote} phaseEvent={phaseEvent} finishEvent={finishEvent} actionEvent={actionEvent} timerEvent={timerEvent} requestTimer={requestTimer} onSessionPresenceChange={onEmployeeSessionPresenceChange} />
      </AppLayout>
    );
  }

  /* ---- Landing / Start Screen (admin only) ---- */
  if (!started) {
    return (
      <>
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 px-4 relative">
          {/* Decorative orbs */}
          <div className="absolute -top-8 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl pointer-events-none retro-float" />
          <div className="absolute -bottom-12 -left-16 w-36 h-36 rounded-full bg-gradient-to-tr from-accent/8 to-transparent blur-3xl pointer-events-none retro-float-reverse" />

          {/* Start Retro Card */}
          <div
            onClick={() => setShowStartModal(true)}
            className="rounded-3xl cursor-pointer group retro-slide-in overflow-hidden"
            style={{ border: "1px solid rgba(6, 194, 134, 0.1)", boxShadow: "0 12px 48px rgba(0, 50, 100, 0.06), 0 2px 8px rgba(6, 194, 134, 0.03)" }}
          >
            <div
              className="rounded-3xl p-10 text-center space-y-7 transition-all duration-500 group-hover:shadow-xl relative overflow-hidden"
              style={{ background: "linear-gradient(155deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 247, 244, 0.9) 40%, rgba(230, 236, 247, 0.85) 100%)" }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-accent/5 via-primary/3 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/5 via-accent/3 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />

              <div className="relative inline-flex items-center justify-center">
                <div className="absolute w-28 h-28 rounded-[24px] bg-gradient-to-br from-accent/10 to-primary/10 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
                <div className="relative w-20 h-20 rounded-[22px] bg-white border border-card-border/20 shadow-lg flex items-center justify-center group-hover:scale-105 group-hover:shadow-xl transition-all duration-500" style={{ boxShadow: "0 8px 32px rgba(0, 50, 100, 0.08), 0 2px 8px rgba(6, 194, 134, 0.06)" }}>
                  <ArrowPathIcon className="w-10 h-10" />
                </div>
              </div>

              <div className="relative space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent bg-[length:200%_100%]" style={{ animation: "retroGradientShift 8s ease-in-out infinite" }}>
                  Sprint Retrospective
                </h1>
                <p className="text-muted/80 max-w-sm mx-auto leading-relaxed text-[13px] font-medium">
                  Reflect on the last sprint, celebrate wins, identify improvements, and define
                  concrete action items for the team.
                </p>
              </div>

              <div className="relative pt-1">
                <span className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold text-white shadow-xl group-hover:shadow-2xl group-hover:scale-[1.03] transition-all duration-300 overflow-hidden relative" style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)", boxShadow: "0 8px 30px rgba(6, 194, 134, 0.3), 0 2px 8px rgba(0, 50, 150, 0.15)" }}>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <svg className="relative w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="relative">Start New Retrospective</span>
                </span>
              </div>

              {/* Meeting flow preview */}
              <div className="relative flex items-center justify-center gap-2 pt-3">
                {PHASES.slice(0, 5).map((phase) => (
                  <div key={phase.id} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/80 border border-card-border/15 shadow-sm transition-transform duration-300 group-hover:scale-105" style={{ animationDelay: `${phase.id * 50}ms` }}>
                    {phase.icon("w-3.5 h-3.5")}
                  </div>
                ))}
                <span className="text-[11px] text-muted/60 font-semibold ml-1.5">+{PHASES.length - 5} more</span>
              </div>
            </div>
          </div>

          {/* Completed Sessions */}
          <div className="mt-12 space-y-5 retro-slide-in-delay-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2.5 tracking-tight">
                <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Past Retrospectives
              </h2>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { id: "all", label: "All" },
                  { id: "finished", label: "Completed" },
                  { id: "archived", label: "Archived" },
                ].map((f) => {
                  const count = f.id === "all"
                    ? completedSessions.length
                    : completedSessions.filter((s) => s.status === f.id).length;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setHistoryFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        historyFilter === f.id
                          ? f.id === "archived"
                            ? "bg-red-50 text-danger border-red-200"
                            : "bg-accent/10 text-accent border-accent/20"
                          : "bg-white/60 text-muted border-card-border hover:bg-white/80"
                      }`}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {completedSessions.length === 0 ? (
              <div className="retro-gradient-border rounded-2xl">
                <div className="rounded-2xl p-8 text-center" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
                  <p className="text-sm text-muted">No completed retrospectives yet. Start one above!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {completedSessions
                  .filter((s) => historyFilter === "all" || s.status === historyFilter)
                  .map((session) => {
                  const isExpanded = expandedSession === session.id;
                  const isArchived = session.status === "archived";
                  const dateStr = session.finished_at
                    ? new Date(session.finished_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "";
                  const timeStr = session.finished_at
                    ? new Date(session.finished_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                    : "";
                  const totalItems = session.stats
                    ? session.stats.went_well + session.stats.didnt_go_well + session.stats.should_try + session.stats.action_items + session.stats.appreciation
                    : 0;
                  const phaseStopped = session.current_phase != null ? session.current_phase + 1 : null;

                  return (
                    <div key={session.id} className="retro-gradient-border rounded-2xl">
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{ background: isArchived
                          ? "linear-gradient(145deg, rgba(254, 242, 242, 0.95) 0%, rgba(254, 226, 226, 0.6) 50%, rgba(240, 247, 244, 0.8) 100%)"
                          : "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)"
                        }}
                      >
                        {/* Session header - clickable */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleSession(session.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSession(session.id); } }}
                          className="w-full p-5 text-left flex items-center gap-4 cursor-pointer hover:bg-white/30 transition-colors"
                        >
                          <div className={`w-10 h-10 rounded-xl border border-white/60 flex items-center justify-center flex-shrink-0 ${
                            isArchived
                              ? "bg-gradient-to-br from-red-100/60 to-red-50/40"
                              : "bg-gradient-to-br from-primary/10 to-accent/10"
                          }`}>
                            {isArchived ? (
                              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            ) : (
                              <ClipboardCheckIcon className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-foreground text-sm truncate">
                                {session.title || "Untitled Retrospective"}
                              </h3>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                isArchived
                                  ? "bg-red-50 text-danger border-red-200"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-200"
                              }`}>
                                {isArchived ? "Archived" : "Completed"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted">{dateStr} at {timeStr}</span>
                              <span className="text-xs text-muted">by {session.facilitator_name}</span>
                              {isArchived && phaseStopped && (
                                <span className="text-[10px] text-muted/60">stopped at step {phaseStopped}/{PHASES.length}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">{totalItems} items</span>
                              {session.stats?.moods > 0 && (
                                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{session.stats.moods} moods</span>
                              )}
                            </div>
                            {session.pdf_url && (
                              <a
                                href={session.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                title="Download PDF Report"
                              >
                                <DownloadIcon className="w-3.5 h-3.5" />
                                PDF
                              </a>
                            )}
                            {isAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(session.id); }}
                                className="p-1.5 rounded-lg text-muted/50 hover:text-danger hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                                title="Delete retrospective"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                            <svg
                              className={`w-4 h-4 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-card-border/30">
                            {loadingHistory ? (
                              <div className="flex justify-center py-8">
                                <div className="relative w-8 h-8">
                                  <div className="absolute inset-0 rounded-full border-2 border-card-border" />
                                  <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                                </div>
                              </div>
                            ) : expandedData ? (
                              <div className="pt-4 space-y-4">
                                {/* Mood summary */}
                                {expandedData.moods?.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                      <TargetIcon className="w-3.5 h-3.5" /> Set the Stage — Moods
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {expandedData.moods.map((m, i) => (
                                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/70 border border-card-border/60 text-xs">
                                          <span>{m.mood === "great" ? "😄" : m.mood === "good" ? "🙂" : m.mood === "neutral" ? "😐" : m.mood === "concerned" ? "😟" : "😤"}</span>
                                          <span className="text-foreground/70 font-medium">{m.user_name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Board phases */}
                                {[
                                  { phase: "went_well", label: "Went Well", emoji: "🟢" },
                                  { phase: "didnt_go_well", label: "Didn't Go Well", emoji: "🔴" },
                                  { phase: "should_try", label: "Should Try", emoji: "🔵" },
                                ].map(({ phase, label, emoji }) => {
                                  const items = (expandedData.items || []).filter((i) => i.phase === phase);
                                  if (items.length === 0) return null;
                                  return (
                                    <div key={phase} className="space-y-2">
                                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <span>{emoji}</span> {label}
                                      </h4>
                                      <div className="space-y-1.5">
                                        {items.map((item) => (
                                          <div key={item.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/70 border border-card-border/40 text-xs">
                                            {item.avatar_url ? (
                                              <img src={item.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover mt-0.5 flex-shrink-0" />
                                            ) : (
                                              <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center mt-0.5 flex-shrink-0">
                                                <span className="text-[9px] font-bold text-primary-dark">{item.user_name?.charAt(0)?.toUpperCase()}</span>
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-foreground/80 leading-relaxed">{item.content}</p>
                                              {item.group_name && (
                                                <span className="inline-block mt-1 text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                                                  {item.group_name}
                                                </span>
                                              )}
                                            </div>
                                            {item.votes_count > 0 && (
                                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                                {item.votes_count} ★
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Action items */}
                                {(() => {
                                  const actions = (expandedData.items || []).filter((i) => i.phase === "action_items");
                                  if (actions.length === 0) return null;
                                  return (
                                    <div className="space-y-2">
                                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <RocketIcon className="w-3.5 h-3.5" /> Action Items
                                      </h4>
                                      <div className="space-y-1.5">
                                        {actions.map((item) => (
                                          <div key={item.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/70 border border-card-border/40 text-xs">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${item.done ? "bg-accent border-accent" : "border-card-border"}`}>
                                              {item.done && (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className={`leading-relaxed ${item.done ? "line-through text-muted" : "text-foreground/80"}`}>{item.content}</p>
                                              <div className="flex items-center gap-2 mt-1">
                                                {item.assignee && <span className="text-[10px] text-muted font-medium">→ {item.assignee}</span>}
                                                {item.due_date && <span className="text-[10px] text-muted">due {item.due_date}</span>}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Appreciation */}
                                {(() => {
                                  const appreciations = (expandedData.items || []).filter((i) => i.phase === "appreciation");
                                  if (appreciations.length === 0) return null;
                                  return (
                                    <div className="space-y-2">
                                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <HandHeartIcon className="w-3.5 h-3.5" /> Appreciation
                                      </h4>
                                      <div className="space-y-1.5">
                                        {appreciations.map((item) => (
                                          <div key={item.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/70 border border-card-border/40 text-xs">
                                            {item.avatar_url ? (
                                              <img src={item.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover mt-0.5 flex-shrink-0" />
                                            ) : (
                                              <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center mt-0.5 flex-shrink-0">
                                                <span className="text-[9px] font-bold text-primary-dark">{item.user_name?.charAt(0)?.toUpperCase()}</span>
                                              </div>
                                            )}
                                            <p className="text-foreground/80 leading-relaxed flex-1">{item.content}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Empty state */}
                                {(expandedData.items || []).length === 0 && (expandedData.moods || []).length === 0 && (
                                  <p className="text-sm text-muted text-center py-6 italic">No data recorded for this session</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted text-center py-6 italic">Failed to load session data</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Delete Retrospective Confirmation */}
          {deleteConfirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirmId(null)} />
              <div className="relative bg-card rounded-2xl border border-card-border shadow-2xl max-w-sm w-full p-6 space-y-5">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Delete Retrospective?</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    This will permanently delete this retrospective session, including all items, moods, votes, and the PDF report. This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-colors cursor-pointer disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={() => handleDeleteSession(deleteConfirmId)} disabled={deleting} className="flex-1 rounded-lg bg-danger text-white py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
                    {deleting ? (
                      <span className="inline-flex items-center gap-2 justify-center">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </span>
                    ) : "Yes, Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal is rendered via portal-like pattern below */}
      </AppLayout>
      {showStartModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStartModal(false)} />
          <div
            className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden retro-slide-in"
            style={{ background: "linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 50%, rgba(240,247,244,0.98) 100%)", boxShadow: "0 24px 80px rgba(0, 50, 100, 0.15), 0 8px 24px rgba(0, 0, 0, 0.06)" }}
          >
              {/* Modal header */}
              <div className="relative px-8 pt-8 pb-4">
                <button
                  onClick={() => setShowStartModal(false)}
                  className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-gray-100/80 hover:bg-gray-200 flex items-center justify-center transition-all duration-200 cursor-pointer hover:rotate-90"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex items-center gap-3.5 mb-1">
                  <div className="w-11 h-11 rounded-[14px] bg-white border border-card-border/15 shadow-md flex items-center justify-center" style={{ boxShadow: "0 4px 16px rgba(0, 50, 100, 0.08)" }}>
                    <ArrowPathIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight">New Retrospective</h2>
                    <p className="text-xs text-muted/70 font-medium">Set up your retro session</p>
                  </div>
                </div>
              </div>

              <div className="px-8 pb-8 space-y-5">
                {/* Sprint title input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g. Sprint 24 Retrospective"
                    className="w-full px-4 py-3 rounded-xl border border-card-border bg-white/80 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
                  />
                </div>

                {/* Team Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Select Team
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setSelectedTeams([])}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selectedTeams.length === 0
                          ? "bg-accent text-white border-accent shadow-md shadow-accent/20"
                          : "bg-white/60 text-muted border-card-border hover:bg-white/80"
                      }`}
                    >
                      All Teams ({allEmployees.length})
                    </button>
                    {TEAMS.map((team) => {
                      const count = allEmployees.filter((e) => (e.teams || []).includes(team.id)).length;
                      const isSelected = selectedTeams.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          onClick={() => {
                            setSelectedTeams((prev) =>
                              prev.includes(team.id)
                                ? prev.filter((t) => t !== team.id)
                                : [...prev, team.id]
                            );
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? team.color + " shadow-md"
                              : "bg-white/60 text-muted border-card-border hover:bg-white/80"
                          }`}
                        >
                          {team.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Members preview */}
                <div className="rounded-2xl border border-card-border/50 bg-white/50 p-4 space-y-2">
                  <p className="text-xs text-muted font-medium">
                    {filteredEmployees.length} member{filteredEmployees.length !== 1 ? "s" : ""} in this retro
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {filteredEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/70 border border-card-border/60 text-xs"
                      >
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center">
                            <span className="text-[9px] font-bold text-primary-dark">
                              {emp.name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                        <span className="text-foreground/80 font-medium">{emp.name}</span>
                      </div>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <p className="text-xs text-muted/60 italic">No members found for this team</p>
                    )}
                  </div>
                </div>

                {/* Start button */}
                <button
                  onClick={() => {
                    setShowStartModal(false);
                    startMeeting();
                  }}
                  disabled={filteredEmployees.length === 0}
                  className={`w-full group flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-semibold shadow-xl transition-all btn-press btn-shimmer cursor-pointer ${
                    filteredEmployees.length === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-primary to-accent text-white shadow-accent/20 hover:shadow-2xl hover:shadow-accent/30 hover:scale-[1.01]"
                  }`}
                >
                  <span>Start Retrospective</span>
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ---- Active Meeting ---- */
  const canNavigate = isFacilitator || !facilitatorInfo;
  const navNext = canNavigate ? next : null;
  const navPrev = canNavigate ? prev : null;
  const navFinish = canNavigate ? finish : null;

  return (
    <SessionContext.Provider value={sessionId}>
      <AppLayout>
        <div className="space-y-8 pb-8">
          <div className="max-w-4xl mx-auto space-y-5">
            {sessionTeamIds.length > 0 && (
              <div className="flex justify-center gap-2 flex-wrap retro-slide-in">
                {sessionTeamIds.map((tid) => (
                  <span key={tid} className={`text-[10px] font-bold px-3.5 py-1.5 rounded-full border shadow-sm ${getTeamColor(tid)}`}>
                    {getTeamLabel(tid)}
                  </span>
                ))}
              </div>
            )}
            <ProgressBar currentPhase={currentPhase} />
            <div className="flex items-center justify-between retro-slide-in-delay-1">
              <div className="flex items-center gap-2">
                {canNavigate ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowFacilitatorMenu((v) => !v)}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border backdrop-blur-sm cursor-pointer hover:border-accent/20 transition-all duration-300"
                      style={{
                        background: "linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(248,250,252,0.82) 100%)",
                        border: "1px solid rgba(0, 0, 0, 0.06)",
                        boxShadow: "0 2px 12px rgba(0,50,100,0.05), 0 1px 3px rgba(6,194,134,0.04)",
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        {facilitatorInfo?.avatar ? (
                          <img src={facilitatorInfo.avatar} alt="" className="w-8 h-8 rounded-lg object-cover border-2 border-white shadow-sm" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/15 via-accent/10 to-primary/20 border-2 border-white shadow-sm flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary-dark">{facilitatorInfo?.name?.charAt(0)?.toUpperCase() || "?"}</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-accent">Facilitator</span>
                        <p className="text-xs font-semibold text-foreground truncate max-w-[120px] leading-tight">{facilitatorInfo?.name}</p>
                      </div>
                      <svg className={`w-3.5 h-3.5 text-muted/60 transition-transform ${showFacilitatorMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showFacilitatorMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowFacilitatorMenu(false)} />
                        <div className="absolute left-0 top-full mt-2 z-50 w-52 rounded-xl border border-card-border bg-card shadow-xl overflow-hidden">
                          <button
                            onClick={() => { setShowFacilitatorMenu(false); setShowEndConfirm(true); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-sm">End Meeting</p>
                              <p className="text-[11px] text-muted">Save progress & finish</p>
                            </div>
                          </button>
                          <div className="border-t border-card-border/50" />
                          <button
                            onClick={() => { setShowFacilitatorMenu(false); setShowArchiveConfirm(true); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-sm">Archive Meeting</p>
                              <p className="text-[11px] text-muted">Discard & archive session</p>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <FacilitatorWidget facilitatorInfo={facilitatorInfo} currentPhase={currentPhase} />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200/50">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-[11px] font-medium text-emerald-700">Syncing</span>
                    </div>
                  </>
                )}
              </div>
              <PhaseTimer phaseIndex={currentPhase} isFacilitator={isFacilitator} broadcastTimer={broadcastTimer} timerEvent={timerEvent} timerRequestEvent={timerRequestEvent} requestTimer={requestTimer} />
            </div>

            {/* End Meeting Confirmation */}
            {showEndConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !ending && setShowEndConfirm(false)} />
                <div className="relative bg-card rounded-2xl border border-card-border shadow-2xl max-w-sm w-full p-6 space-y-5">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">End Retrospective?</h3>
                    <p className="text-sm text-muted leading-relaxed">
                      This will finish the retrospective at{" "}
                      <span className="font-semibold text-foreground">{PHASES[currentPhase]?.label} (Step {currentPhase + 1}/{PHASES.length})</span>.
                      All progress will be saved.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowEndConfirm(false)} disabled={ending} className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-colors cursor-pointer disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={handleEndMeeting} disabled={ending} className="flex-1 rounded-lg bg-amber-500 text-white py-2.5 text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer disabled:opacity-50">
                      {ending ? (
                        <span className="inline-flex items-center gap-2 justify-center">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {pdfGenerating ? "Generating PDF..." : "Ending..."}
                        </span>
                      ) : "Yes, End Meeting"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF Generating Overlay */}
            {pdfGenerating && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div className="relative bg-card rounded-2xl border border-card-border shadow-2xl max-w-xs w-full p-8 space-y-4 text-center">
                  <div className="flex justify-center">
                    <div className="relative w-14 h-14">
                      <div className="absolute inset-0 rounded-full border-4 border-card-border" />
                      <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Generating PDF Report</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    Capturing phase screenshots and compiling your retrospective report. This may take a moment...
                  </p>
                </div>
              </div>
            )}

            {/* Archive Meeting Confirmation */}
            {showArchiveConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !archiving && setShowArchiveConfirm(false)} />
                <div className="relative bg-card rounded-2xl border border-card-border shadow-2xl max-w-sm w-full p-6 space-y-5">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                      <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Archive Retrospective?</h3>
                    <p className="text-sm text-muted leading-relaxed">
                      This will archive the session and discard any unfinished work. Currently at{" "}
                      <span className="font-semibold text-foreground">{PHASES[currentPhase]?.label} (Step {currentPhase + 1}/{PHASES.length})</span>.
                      This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowArchiveConfirm(false)} disabled={archiving} className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-colors cursor-pointer disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={handleArchiveMeeting} disabled={archiving} className="flex-1 rounded-lg bg-danger text-white py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
                      {archiving ? (
                        <span className="inline-flex items-center gap-2 justify-center">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Archiving...
                        </span>
                      ) : "Yes, Archive"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            ref={phaseContentRef}
            key={currentPhase}
            className={`min-h-[420px] mx-auto retro-phase-in ${[3, 4, 5, 6].includes(currentPhase) ? "max-w-full px-8" : "max-w-4xl"}`}
          >
            {currentPhase === 0 && (
              canNavigate
                ? <IceBreakerPhase employees={employees} onNext={next} broadcastIcebreakerState={broadcastIcebreakerState} broadcastSpin={broadcastSpin} />
                : <EmployeeIceBreakerView employees={employees} icebreakerState={icebreakerState} spinTrigger={spinTrigger} />
            )}
            {currentPhase === 1 && <SetTheStagePhase employees={employees} role={role} onNext={navNext} onPrev={navPrev} actionEvent={actionEvent} broadcastAction={canNavigate ? broadcastAction : null} />}
            {currentPhase === 2 && <PreviousOpenActionsPhase employees={employees} role={role} onNext={navNext} onPrev={navPrev} toggleEvent={toggleEvent} broadcastToggle={broadcastToggle} />}
            {currentPhase === 3 && <RetroBoardPhase onNext={navNext} onPrev={navPrev} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />}
            {currentPhase === 4 && <AIGroupPhase role={role} isFacilitator={isFacilitator} onNext={navNext} onPrev={navPrev} groupEvent={groupEvent} groupBroadcast={groupBroadcast} />}
            {currentPhase === 5 && <VotingPhase employees={employees} role={role} onNext={navNext} onPrev={navPrev} voteEvent={voteEvent} itemVoteEvent={itemVoteEvent} broadcastVoteChange={broadcastVoteChange} broadcastItemVote={broadcastItemVote} groupBroadcast={groupBroadcast} groupEvent={groupEvent} />}
            {currentPhase === 6 && <VoteResultsPhase onNext={navNext} onPrev={navPrev} />}
            {currentPhase === 7 && <ActionItemsPhase employees={employees} onNext={navNext} onPrev={navPrev} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />}
            {currentPhase === 8 && <AppreciationPhase onNext={navNext} onPrev={navPrev} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />}
            {currentPhase === 9 && <MeetingWorthPhase employees={employees} role={role} onNext={navNext} onPrev={navPrev} actionEvent={actionEvent} broadcastAction={canNavigate ? broadcastAction : null} />}
            {currentPhase === 10 && <CloseSummaryPhase onPrev={navPrev} onFinish={navFinish} />}
          </div>
        </div>
      </AppLayout>
    </SessionContext.Provider>
  );
}
