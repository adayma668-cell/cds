"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/context/AuthContext";
import AppLayout from "@/components/AppLayout";
import { useRetroChannel } from "@/hooks/useRetroChannel";
import { useOpenActionsChannel } from "@/hooks/useOpenActionsChannel";
import { useRetroBoardChannel } from "@/hooks/useRetroBoardChannel";
import { useVoteTrackerChannel } from "@/hooks/useVoteTrackerChannel";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";
import {
  DiceIcon, TargetIcon, PinIcon, NotepadIcon, BallotIcon, ChartBarIcon,
  RocketIcon, HandHeartIcon, ClipboardCheckIcon, BellAlertIcon, SparklesIcon,
  TrophyIcon, WarningIcon, StarIcon, UsersIcon, HeartIcon, ArrowPathIcon, MedalIcon,
  CheckCircleIcon, XCircleIcon, LightbulbIcon, HelpCircleIcon,
  FaceGreatIcon, FaceGoodIcon, FaceNeutralIcon, FaceConcernedIcon, FaceFrustratedIcon,
} from "@/lib/icons";

const SessionContext = createContext(null);
function useSessionId() { return useContext(SessionContext); }

const ALLOWED_ROLES = ["scrum_master", "super_admin"];

const PHASES = [
  { id: 0, label: "Ice Breaker", icon: (cls = "w-4 h-4") => <DiceIcon className={cls} />, short: "Ice Breaker" },
  { id: 1, label: "Set the Stage", icon: (cls = "w-4 h-4") => <TargetIcon className={cls} />, short: "Stage" },
  { id: 2, label: "Open Actions", icon: (cls = "w-4 h-4") => <PinIcon className={cls} />, short: "Actions" },
  { id: 3, label: "Retro Board", icon: (cls = "w-4 h-4") => <NotepadIcon className={cls} />, short: "Board" },
  { id: 4, label: "Vote", icon: (cls = "w-4 h-4") => <BallotIcon className={cls} />, short: "Vote" },
  { id: 5, label: "Results", icon: (cls = "w-4 h-4") => <ChartBarIcon className={cls} />, short: "Results" },
  { id: 6, label: "Action Items", icon: (cls = "w-4 h-4") => <RocketIcon className={cls} />, short: "New Actions" },
  { id: 7, label: "Appreciation", icon: (cls = "w-4 h-4") => <HandHeartIcon className={cls} />, short: "Thanks" },
  { id: 8, label: "Close & Summary", icon: (cls = "w-4 h-4") => <ClipboardCheckIcon className={cls} />, short: "Summary" },
];

/* ------------------------------------------------------------------ */
/*  Phase Timer with auto-start, reset, tick & finish sounds           */
/* ------------------------------------------------------------------ */
const PHASE_DURATIONS = {
  0: 5 * 60,   // Ice Breaker: 5 min
  1: 3 * 60,   // Set the Stage: 3 min
  2: 5 * 60,   // Open Actions: 5 min
  3: 10 * 60,  // Retro Board: 10 min
  4: 5 * 60,   // Vote: 5 min
  5: 3 * 60,   // Results: 3 min
  6: 7 * 60,   // Action Items: 7 min
  7: 3 * 60,   // Appreciation: 3 min
  8: 2 * 60,   // Summary: 2 min
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

function PhaseTimer({ phaseIndex }) {
  const defaultDuration = PHASE_DURATIONS[phaseIndex] || 5 * 60;
  const [duration, setDuration] = useState(defaultDuration);
  const [timeLeft, setTimeLeft] = useState(defaultDuration);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editMin, setEditMin] = useState("");
  const [editSec, setEditSec] = useState("");
  const tickingRef = useRef(false);
  const { playTick, playFinish } = useTimerSounds();

  useEffect(() => {
    const d = PHASE_DURATIONS[phaseIndex] || 5 * 60;
    setDuration(d);
    setTimeLeft(d);
    setRunning(true);
    setFinished(false);
    setEditing(false);
    tickingRef.current = false;
  }, [phaseIndex]);

  useEffect(() => {
    if (!running || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 10 && next > 0) playTick();
        if (next <= 0) {
          setRunning(false);
          setFinished(true);
          playFinish();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, timeLeft, playTick, playFinish]);

  const openEditor = () => {
    setRunning(false);
    setEditMin(String(Math.floor(timeLeft / 60)));
    setEditSec(String(timeLeft % 60));
    setEditing(true);
  };

  const applyCustomTime = () => {
    const m = Math.max(0, parseInt(editMin) || 0);
    const s = Math.max(0, Math.min(59, parseInt(editSec) || 0));
    const total = m * 60 + s;
    if (total > 0) {
      setDuration(total);
      setTimeLeft(total);
      setFinished(false);
      setRunning(true);
      tickingRef.current = false;
    }
    setEditing(false);
  };

  const togglePause = () => {
    if (finished) {
      setTimeLeft(duration);
      setFinished(false);
      setRunning(true);
      tickingRef.current = false;
      return;
    }
    setRunning((r) => !r);
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
    <div className={`inline-flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all duration-500 ${
      finished
        ? "border-red-300/40 retro-timer-critical"
        : isCritical
        ? "border-red-300/40 retro-timer-critical"
        : isWarning
        ? "border-amber-300/40"
        : "border-primary/15"
    }`} style={{
      background: finished || isCritical
        ? "linear-gradient(135deg, rgba(254, 242, 242, 0.92), rgba(254, 226, 226, 0.85))"
        : isWarning
        ? "linear-gradient(135deg, rgba(255, 251, 235, 0.92), rgba(254, 243, 199, 0.85))"
        : "linear-gradient(135deg, rgba(232, 250, 243, 0.92), rgba(230, 236, 247, 0.88))",
      boxShadow: finished || isCritical
        ? "0 8px 32px rgba(220, 38, 38, 0.12), 0 2px 8px rgba(220, 38, 38, 0.06)"
        : isWarning
        ? "0 8px 32px rgba(245, 158, 11, 0.12), 0 2px 8px rgba(245, 158, 11, 0.06)"
        : "0 8px 32px rgba(0, 50, 100, 0.08), 0 2px 8px rgba(6, 194, 134, 0.06)"
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

      {/* Time display / editor */}
      {editing ? (
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
      ) : (
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
      )}

      {/* Pause / Play */}
      {!editing && (
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
    <div className="relative rounded-3xl px-6 py-5 retro-slide-in retro-card-depth overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95) 0%, rgba(230, 236, 247, 0.92) 50%, rgba(240, 247, 244, 0.95) 100%)", border: "1px solid rgba(6, 194, 134, 0.15)" }}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-accent/[0.03] pointer-events-none" />

      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {PHASES.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= currentPhase ? "w-3 bg-gradient-to-r from-primary to-accent" : "w-1.5 bg-card-border/40"}`} />
            ))}
          </div>
          <span className="text-xs font-bold text-foreground/70 tabular-nums">
            {currentPhase + 1} / {PHASES.length}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/15">
          <span className="retro-active-node">{PHASES[currentPhase].icon("w-4 h-4")}</span>
          <span className="text-xs font-bold text-accent">{PHASES[currentPhase].label}</span>
        </div>
      </div>

      <div className="relative flex items-center justify-between">
        <div className="absolute top-[18px] left-5 right-5 h-[3px] rounded-full bg-card-border/30" />
        <div
          className="absolute top-[18px] left-5 h-[3px] rounded-full transition-all duration-700 ease-out retro-progress-shimmer overflow-hidden"
          style={{
            width: `calc(${progressPct}% - 40px + ${currentPhase === PHASES.length - 1 ? "40px" : "0px"})`,
            background: "linear-gradient(90deg, var(--primary) 0%, var(--accent) 50%, var(--primary) 100%)",
            backgroundSize: "200% 100%",
            boxShadow: "0 0 12px rgba(6, 194, 134, 0.4), 0 0 4px rgba(0, 50, 150, 0.2)",
          }}
        />

        {PHASES.map((phase) => {
          const done = phase.id < currentPhase;
          const active = phase.id === currentPhase;
          return (
            <div key={phase.id} className="relative z-10 flex flex-col items-center" style={{ width: 36 }}>
              {active && (
                <>
                  <div className="absolute top-0 left-[2px] w-9 h-9 rounded-full" style={{ animation: "retroPulseRing 2s ease-out infinite", background: "radial-gradient(circle, rgba(0, 50, 150, 0.15) 0%, transparent 70%)" }} />
                  <div className="absolute -inset-1 rounded-full bg-accent/10 blur-md" />
                </>
              )}
              <div
                className={`relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  done
                    ? "bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25"
                    : active
                    ? "bg-gradient-to-br from-accent via-accent-dark to-accent text-white shadow-xl shadow-accent/35 ring-[3px] ring-accent/20 ring-offset-2 ring-offset-transparent retro-node-glow retro-active-node"
                    : "bg-gradient-to-br from-background to-card border-2 border-card-border/50 text-muted/60"
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
              <span
                className={`text-[9px] mt-2 font-bold transition-all whitespace-nowrap hidden md:block ${
                  active ? "text-accent scale-105" : done ? "text-primary-dark" : "text-muted/40"
                }`}
              >
                {phase.short}
              </span>
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
    <div className="relative text-center mb-6 retro-phase-in">
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-56 h-32 rounded-full bg-gradient-to-br from-primary/12 via-accent/8 to-primary/6 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="relative inline-flex items-center justify-center mb-5">
          <div className="absolute w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/15 blur-xl retro-icon-pulse" />
          <div className="relative w-[68px] h-[68px] rounded-2xl flex items-center justify-center retro-icon-pulse" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)", border: "1.5px solid rgba(6, 194, 134, 0.2)", boxShadow: "0 8px 32px rgba(0, 50, 100, 0.1), 0 2px 8px rgba(6, 194, 134, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)" }}>
            {icon}
          </div>
        </div>

        <h2 className="text-2xl font-extrabold bg-gradient-to-r from-accent via-foreground to-primary bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-muted text-sm max-w-md mx-auto mt-2.5 leading-relaxed">{description}</p>
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
    <div className="flex items-center justify-between pt-6 mt-6 border-t border-card-border/30">
      <button
        onClick={onPrev}
        className="group flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-muted hover:text-foreground transition-all btn-press"
        style={{ background: "linear-gradient(135deg, rgba(240, 247, 244, 0.9), rgba(230, 236, 247, 0.85))", border: "1px solid rgba(6, 194, 134, 0.12)", boxShadow: "0 2px 8px rgba(0, 50, 100, 0.05)" }}
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Previous
      </button>
      <button
        onClick={onNext}
        className="group flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-accent via-accent-dark to-accent text-white rounded-2xl text-sm font-bold shadow-xl shadow-accent/25 hover:shadow-2xl hover:shadow-accent/35 hover:scale-[1.02] transition-all btn-press btn-shimmer"
      >
        {nextLabel}
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="relative retro-gradient-border rounded-3xl overflow-hidden">
      <div className="rounded-3xl p-6 space-y-5" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(255, 251, 235, 0.6) 50%, rgba(230, 236, 247, 0.9) 100%)" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground flex items-center gap-2.5 text-sm">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/25 to-orange-400/25 shadow-sm shadow-amber-500/10"><TrophyIcon className="w-4 h-4" /></span>
            Lucky Draw
          </h3>
          {winner && (
            <span className="text-[11px] font-bold text-primary bg-gradient-to-r from-primary/15 to-accent/15 px-3 py-1.5 rounded-full shadow-sm" style={{ animation: "retroWinnerCelebrate 0.5s ease-out" }}>
              Selected!
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
                  <button
                    onClick={fetchQuestions}
                    className="relative group flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Shuffle
                  </button>
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

                <div className="px-6 py-4 flex items-center justify-between border-t border-card-border/30">
                  <button
                    onClick={prevQ}
                    disabled={currentQ === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-white/60 transition-all disabled:opacity-25 disabled:cursor-not-allowed btn-press"
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
                            ? "w-8 h-2.5 bg-gradient-to-r from-primary to-accent shadow-md shadow-accent/30"
                            : "w-2.5 h-2.5 bg-card-border/60 hover:bg-muted/40 hover:scale-125"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={nextQ}
                    disabled={currentQ === questions.length - 1}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-white/60 transition-all disabled:opacity-25 disabled:cursor-not-allowed btn-press"
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
  { emoji: (cls = "w-6 h-6") => <FaceGreatIcon className={cls} />, label: "Great", bg: "from-green-400/20 to-green-500/10", border: "border-green-400/50", text: "text-green-600", bar: "bg-green-500" },
  { emoji: (cls = "w-6 h-6") => <FaceGoodIcon className={cls} />, label: "Good", bg: "from-blue-400/20 to-blue-500/10", border: "border-blue-400/50", text: "text-blue-600", bar: "bg-blue-500" },
  { emoji: (cls = "w-6 h-6") => <FaceNeutralIcon className={cls} />, label: "Neutral", bg: "from-yellow-400/20 to-yellow-500/10", border: "border-yellow-400/50", text: "text-yellow-600", bar: "bg-yellow-500" },
  { emoji: (cls = "w-6 h-6") => <FaceConcernedIcon className={cls} />, label: "Concerned", bg: "from-orange-400/20 to-orange-500/10", border: "border-orange-400/50", text: "text-orange-600", bar: "bg-orange-500" },
  { emoji: (cls = "w-6 h-6") => <FaceFrustratedIcon className={cls} />, label: "Frustrated", bg: "from-red-400/20 to-red-500/10", border: "border-red-400/50", text: "text-red-600", bar: "bg-red-500" },
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
function EmployeeMoodPicker() {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [selected, setSelected] = useState(null);
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
    return (
      <div className="max-w-md mx-auto text-center space-y-5">
        <PhaseHeader
          icon={<TargetIcon className="w-8 h-8" />}
          title="Set the Stage"
          description="Your mood has been recorded. Waiting for the facilitator to reveal results."
        />
        <div
          className={`inline-flex flex-col items-center gap-3 px-10 py-6 rounded-2xl border-2 bg-gradient-to-b ${m?.bg || ""} ${m?.border || ""}`}
          style={{ animation: "fadeInScale 0.3s ease-out" }}
        >
          <span>{m?.emoji("w-12 h-12")}</span>
          <span className={`text-sm font-bold ${m?.text}`}>{m?.label}</span>
        </div>
        <button
          onClick={changeVote}
          className="text-xs text-muted hover:text-accent underline underline-offset-2 transition-colors"
        >
          Change my response
        </button>
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

      <div className="flex justify-center gap-3 py-2">
        {MOODS.map((m) => (
          <button
            key={m.label}
            onClick={() => setSelected(m.label)}
            className={`flex flex-col items-center gap-3 px-5 py-6 rounded-2xl border-2 transition-all duration-300 btn-press ${
              selected === m.label
                ? `bg-gradient-to-b ${m.bg} ${m.border} scale-110 shadow-xl ring-4 ring-offset-2 ${m.border.replace("border-", "ring-")}/20`
                : "hover:shadow-lg hover:scale-105 hover:-translate-y-1"
            }`}
            style={selected !== m.label ? { background: "linear-gradient(180deg, rgba(240, 247, 244, 0.9), rgba(230, 236, 247, 0.8))", borderColor: "rgba(6, 194, 134, 0.12)" } : undefined}
          >
            <span className={`transition-transform duration-300 ${selected === m.label ? "scale-125 retro-icon-pulse" : ""}`}>
              {m.emoji("w-10 h-10")}
            </span>
            <span className={`text-[11px] font-bold ${selected === m.label ? m.text : "text-muted"}`}>
              {m.label}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={!selected || submitting}
        className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white rounded-2xl text-sm font-semibold shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:scale-[1.01] transition-all disabled:opacity-40 disabled:shadow-none btn-press btn-shimmer"
      >
        {submitting ? "Submitting..." : "Submit My Mood"}
      </button>
    </div>
  );
}

/* Admin view: live tracker + reveal */
function SetTheStageAdmin({ employees, onNext, onPrev }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const [moods, setMoods] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [polling, setPolling] = useState(true);
  const [myMood, setMyMood] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      <div className="rounded-2xl p-5 retro-card-depth" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95), rgba(230, 236, 247, 0.9))", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Your Mood</h3>
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
      <div className="rounded-2xl p-5 space-y-4 retro-card-depth" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95), rgba(230, 236, 247, 0.9))", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
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
          onClick={() => { setRevealed(true); setPolling(false); }}
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
function SetTheStagePhase({ employees, role, onNext, onPrev }) {
  const isAdmin = role === "scrum_master" || role === "super_admin";
  if (isAdmin) return <SetTheStageAdmin employees={employees} onNext={onNext} onPrev={onPrev} />;
  return <EmployeeMoodPicker />;
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

function PreviousOpenActionsPhase({ employees, role, onNext, onPrev }) {
  const token = useAccessToken();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toggleEvent, broadcastToggle } = useOpenActionsChannel();
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
        <div className="rounded-2xl overflow-hidden retro-card-depth retro-slide-in-delay-1" style={{ background: "linear-gradient(180deg, rgba(240, 247, 244, 0.95) 0%, rgba(255, 255, 255, 0.8) 100%)", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
          <div className="grid grid-cols-[40px_1fr_140px_110px] gap-3 px-5 py-3.5 border-b border-primary/10 text-[11px] font-semibold text-muted uppercase tracking-wider" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.6), rgba(230, 236, 247, 0.5))" }}>
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
                  className={`grid grid-cols-[40px_1fr_140px_110px] gap-3 px-5 py-3.5 items-center transition-all duration-300 ${
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

      <div className="flex gap-2 retro-slide-in-delay-1">
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={placeholder}
            className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/50 rounded-xl text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-5 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl text-sm font-semibold shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:scale-105 transition-all disabled:opacity-30 disabled:shadow-none btn-press"
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
              className="group flex items-center gap-3 p-4 rounded-xl hover:-translate-y-0.5 transition-all duration-300"
              style={{ animation: "retroSlideIn 0.3s ease-out both", animationDelay: `${idx * 40}ms`, background: "linear-gradient(135deg, rgba(240, 247, 244, 0.92), rgba(230, 236, 247, 0.85))", border: "1px solid rgba(6, 194, 134, 0.1)", boxShadow: "0 2px 12px rgba(0, 50, 100, 0.06)" }}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-accent flex items-center justify-center text-xs font-bold">
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
  { phase: "went_well", title: "What went well?", icon: (cls = "w-5 h-5") => <CheckCircleIcon className={cls} />, noteBg: "bg-emerald-100", noteText: "text-emerald-900", headerBg: "bg-white", headerBorder: "border-b-4 border-emerald-400", badge: "bg-emerald-500", inputBorder: "border-emerald-300", inputFocus: "focus:ring-emerald-400/40", btnBg: "bg-emerald-500 hover:bg-emerald-600" },
  { phase: "didnt_go_well", title: "What went less well?", icon: (cls = "w-5 h-5") => <XCircleIcon className={cls} />, noteBg: "bg-rose-100", noteText: "text-rose-900", headerBg: "bg-white", headerBorder: "border-b-4 border-rose-400", badge: "bg-rose-500", inputBorder: "border-rose-300", inputFocus: "focus:ring-rose-400/40", btnBg: "bg-rose-500 hover:bg-rose-600" },
  { phase: "should_try", title: "What do we want to try next?", icon: (cls = "w-5 h-5") => <LightbulbIcon className={cls} />, noteBg: "bg-sky-100", noteText: "text-sky-900", headerBg: "bg-white", headerBorder: "border-b-4 border-sky-400", badge: "bg-sky-500", inputBorder: "border-sky-300", inputFocus: "focus:ring-sky-400/40", btnBg: "bg-sky-500 hover:bg-sky-600" },
  { phase: "puzzles_us", title: "What puzzles us?", icon: (cls = "w-5 h-5") => <HelpCircleIcon className={cls} />, noteBg: "bg-amber-100", noteText: "text-amber-900", headerBg: "bg-white", headerBorder: "border-b-4 border-amber-400", badge: "bg-amber-500", inputBorder: "border-amber-300", inputFocus: "focus:ring-amber-400/40", btnBg: "bg-amber-500 hover:bg-amber-600" },
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
      className={`group relative ${col.noteBg} rounded-xl px-4 py-3 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-white/50`}
      style={{
        animation: "retroSlideIn 0.3s ease-out both",
        animationDelay: `${idx * 40}ms`,
        transform: `rotate(${idx % 3 === 0 ? -0.5 : idx % 3 === 1 ? 0.5 : 0}deg)`,
      }}
    >
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
          className={`w-full text-[13px] ${col.noteText} leading-relaxed font-medium bg-white/70 rounded-lg px-2 py-1.5 border ${col.inputBorder} focus:outline-none focus:ring-2 ${col.inputFocus} resize-none`}
          rows={2}
        />
      ) : (
        <p
          className={`text-[13px] ${col.noteText} leading-relaxed font-medium pr-6 ${isOwner ? "cursor-pointer hover:underline decoration-dotted underline-offset-2" : ""}`}
          onClick={() => { if (isOwner) { setEditText(item.content); setEditing(true); } }}
          title={isOwner ? "Click to edit" : ""}
        >
          {item.content}
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-2">
        {item.avatar_url ? (
          <img src={item.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white" />
        ) : (
          <div className={`w-5 h-5 rounded-full ${col.badge} flex items-center justify-center text-[8px] font-bold text-white shadow-sm`}>
            {item.user_name?.charAt(0)?.toUpperCase()}
          </div>
        )}
        <span className="text-[10px] text-gray-500 font-medium">{item.user_name}</span>
        {isOwner && !editing && (
          <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-60 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )}
        {item.votes > 0 && (
          <span className={`ml-auto text-[10px] font-bold ${col.badge} text-white px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm`}>{item.votes}</span>
        )}
      </div>
      {isOwner && (
        <button
          onClick={() => removeItem(item.id)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center text-xs transition-all hover:bg-black/70 hover:scale-110"
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
    <div className="flex flex-col rounded-2xl overflow-hidden border retro-card-depth transition-all duration-300" style={{ minHeight: 420, background: "linear-gradient(180deg, rgba(240, 247, 244, 0.95) 0%, rgba(255, 255, 255, 0.7) 100%)", borderColor: "rgba(6, 194, 134, 0.1)" }}>
      <div className={`flex items-center gap-2.5 px-5 py-4 ${col.headerBorder}`} style={{ background: `linear-gradient(135deg, ${col.noteBg === "bg-emerald-100" ? "rgba(209, 250, 229, 0.6)" : col.noteBg === "bg-rose-100" ? "rgba(255, 228, 230, 0.6)" : col.noteBg === "bg-sky-100" ? "rgba(224, 242, 254, 0.6)" : "rgba(254, 243, 199, 0.6)"} 0%, rgba(240, 247, 244, 0.4) 100%)` }}>
        <span className="retro-icon-pulse">{col.icon("w-5 h-5")}</span>
        <h3 className="text-sm font-bold text-gray-800 flex-1">{col.title}</h3>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${col.badge} text-white shadow-sm`}>{items.length}</span>
      </div>

      <div className="px-3 pt-3 pb-1">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Type & press enter..."
            className={`flex-1 px-3 py-2.5 text-sm border ${col.inputBorder} rounded-xl bg-background/80 placeholder:text-gray-400 ${col.inputFocus} focus:outline-none focus:ring-2 transition-all`}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className={`px-3.5 py-2.5 ${col.btnBg} text-white rounded-xl text-sm font-bold transition-all disabled:opacity-30 btn-press shadow-md hover:shadow-lg hover:scale-105`}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5" style={{ maxHeight: 500 }}>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <span className="mb-3 opacity-20 retro-float-slow">{col.icon("w-10 h-10")}</span>
            <p className="text-xs font-medium">No notes yet</p>
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

function RetroBoardPhase({ onNext, onPrev }) {
  const { event: boardEvent, broadcast: boardBroadcast } = useRetroBoardChannel();

  return (
    <div className="w-full space-y-5">
      <PhaseHeader icon={<NotepadIcon className="w-8 h-8" />} title="Retro Board" description="Add your thoughts to each column — be honest, be constructive!" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {BOARD_COLUMNS.map((col) => (
          <StickyColumn key={col.phase} col={col} boardEvent={boardEvent} boardBroadcast={boardBroadcast} />
        ))}
      </div>
      <PhaseNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase 4 – Voting (5 votes per employee, sorted by highest votes)   */
/* ------------------------------------------------------------------ */
const MAX_VOTES = 5;
const VOTE_PHASES = ["went_well", "didnt_go_well", "should_try", "puzzles_us"];

function VotingPhase({ employees, role, onNext, onPrev }) {
  const token = useAccessToken();
  const sessionId = useSessionId();
  const { user } = useAuthContext();
  const [allItems, setAllItems] = useState({});
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voteSummary, setVoteSummary] = useState({});
  const [showTracker, setShowTracker] = useState(true);
  const { voteEvent, broadcastVoteChange } = useVoteTrackerChannel();
  const isAdmin = role === "scrum_master" || role === "super_admin";

  const remaining = MAX_VOTES - myVotes.length;

  const fetchAll = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const hdrs = { Authorization: `Bearer ${token}` };
      const ts = Date.now();
      const [itemsRes, votesRes] = await Promise.all([
        fetch(`/api/retro/items?phase=all_board&session_id=${sessionId}&_t=${ts}`, { headers: hdrs, cache: "no-store" }),
        fetch(`/api/retro/votes?session_id=${sessionId}&_t=${ts}`, { headers: hdrs, cache: "no-store" }),
      ]);
      const itemsData = await itemsRes.json();
      const votesData = await votesRes.json();

      const grouped = {};
      for (const p of VOTE_PHASES) grouped[p] = [];
      for (const item of (itemsData.items || [])) {
        if (grouped[item.phase]) grouped[item.phase].push(item);
      }
      setAllItems(grouped);
      setMyVotes(votesData.votes || []);
    } catch (err) { console.error("VotingPhase fetch error:", err); }
    setLoading(false);
  }, [token, sessionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchSummary = useCallback(async () => {
    if (!isAdmin || !token || !sessionId) return;
    try {
      const res = await fetch(`/api/retro/votes/summary?session_id=${sessionId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (data.voteSummary) setVoteSummary(data.voteSummary);
    } catch {}
  }, [isAdmin, token, sessionId]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    if (!voteEvent) return;
    if (isAdmin) {
      setVoteSummary((prev) => ({ ...prev, [voteEvent.userId]: voteEvent.voteCount }));
    }
  }, [voteEvent, isAdmin]);

  const myVoteCount = (itemId) => myVotes.filter((id) => id === itemId).length;

  const castVote = async (itemId) => {
    if (remaining <= 0) return;
    const newVotes = [...myVotes, itemId];
    setMyVotes(newVotes);
    setAllItems((prev) => {
      const next = { ...prev };
      for (const p of VOTE_PHASES) {
        next[p] = next[p].map((i) => i.id === itemId ? { ...i, votes: (i.votes || 0) + 1 } : i);
      }
      return next;
    });
    if (user?.id) broadcastVoteChange(user.id, newVotes.length);
    try {
      await fetch("/api/retro/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: itemId, session_id: sessionId }),
      });
      fetchAll();
    } catch (err) { console.error("castVote error:", err); }
  };

  const removeVote = async (itemId) => {
    if (!myVotes.includes(itemId)) return;
    const idx = myVotes.indexOf(itemId);
    const newVotes = [...myVotes]; newVotes.splice(idx, 1);
    setMyVotes(newVotes);
    setAllItems((prev) => {
      const next = { ...prev };
      for (const p of VOTE_PHASES) {
        next[p] = next[p].map((i) => i.id === itemId ? { ...i, votes: Math.max((i.votes || 0) - 1, 0) } : i);
      }
      return next;
    });
    if (user?.id) broadcastVoteChange(user.id, newVotes.length);
    try {
      await fetch("/api/retro/votes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: itemId, session_id: sessionId }),
      });
      fetchAll();
    } catch (err) { console.error("removeVote error:", err); }
  };

  const colConfig = {
    went_well: { title: "What went well?", icon: (cls = "w-5 h-5") => <CheckCircleIcon className={cls} />, noteBg: "bg-emerald-100", noteText: "text-emerald-900", badge: "bg-emerald-500", border: "border-emerald-400" },
    didnt_go_well: { title: "What went less well?", icon: (cls = "w-5 h-5") => <XCircleIcon className={cls} />, noteBg: "bg-rose-100", noteText: "text-rose-900", badge: "bg-rose-500", border: "border-rose-400" },
    should_try: { title: "What do we want to try?", icon: (cls = "w-5 h-5") => <LightbulbIcon className={cls} />, noteBg: "bg-sky-100", noteText: "text-sky-900", badge: "bg-sky-500", border: "border-sky-400" },
    puzzles_us: { title: "What puzzles us?", icon: (cls = "w-5 h-5") => <HelpCircleIcon className={cls} />, noteBg: "bg-amber-100", noteText: "text-amber-900", badge: "bg-amber-500", border: "border-amber-400" },
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
        <div className="inline-flex items-center gap-3 mt-3 px-6 py-3 rounded-full retro-card-depth" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95), rgba(230, 236, 247, 0.92))", border: "1px solid rgba(6, 194, 134, 0.15)" }}>
          <span className="text-sm font-semibold text-gray-700">Votes remaining:</span>
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
        <div className="rounded-2xl overflow-hidden retro-card-depth" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.95), rgba(230, 236, 247, 0.92))", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
          <button
            onClick={() => setShowTracker(!showTracker)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-primary/[0.03] transition-colors"
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
        {VOTE_PHASES.map((phase) => {
          const cfg = colConfig[phase];
          const items = allItems[phase] || [];
          return (
            <div key={phase} className="flex flex-col rounded-2xl overflow-hidden border retro-card-depth" style={{ background: "linear-gradient(180deg, rgba(240, 247, 244, 0.95) 0%, rgba(255, 255, 255, 0.7) 100%)", borderColor: "rgba(6, 194, 134, 0.1)" }}>
              <div className={`flex items-center gap-2.5 px-5 py-4 border-b-4 ${cfg.border}`} style={{ background: `linear-gradient(135deg, ${cfg.noteBg === "bg-emerald-100" ? "rgba(209, 250, 229, 0.6)" : cfg.noteBg === "bg-rose-100" ? "rgba(255, 228, 230, 0.6)" : cfg.noteBg === "bg-sky-100" ? "rgba(224, 242, 254, 0.6)" : "rgba(254, 243, 199, 0.6)"} 0%, rgba(240, 247, 244, 0.4) 100%)` }}>
                <span>{cfg.icon("w-5 h-5")}</span>
                <h3 className="text-sm font-bold text-gray-800 flex-1">{cfg.title}</h3>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.badge} text-white shadow-sm`}>{items.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5" style={{ maxHeight: 500 }}>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-10">No items</p>
                ) : (
                  items.map((item, idx) => {
                    const myCount = myVoteCount(item.id);
                    const voted = myCount > 0;
                    return (
                      <div
                        key={item.id}
                        className={`relative ${cfg.noteBg} rounded-xl px-4 py-3 transition-all duration-300 border ${voted ? "ring-2 ring-accent shadow-lg border-accent/30" : "border-white/50 hover:shadow-md"}`}
                        style={{ animation: "retroSlideIn 0.3s ease-out both", animationDelay: `${idx * 40}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                            <button
                              onClick={() => castVote(item.id)}
                              disabled={remaining <= 0}
                              className={`w-8 h-6 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                remaining > 0
                                  ? "bg-white/80 text-gray-500 hover:bg-accent/20 hover:text-accent hover:scale-110 border border-white/60 shadow-sm"
                                  : "bg-gray-100/50 text-gray-300 cursor-not-allowed"
                              }`}
                              title={remaining > 0 ? "Upvote" : "No votes left"}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <span className={`text-xs font-black leading-none ${(item.votes || 0) > 0 ? cfg.text : "text-gray-400"}`}>{item.votes || 0}</span>
                            {voted && (
                              <button
                                onClick={() => removeVote(item.id)}
                                className="w-8 h-6 rounded-lg flex items-center justify-center bg-white/80 text-gray-400 hover:bg-red-100 hover:text-red-500 border border-white/60 shadow-sm transition-all duration-200 hover:scale-110"
                                title="Remove one vote"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] ${cfg.noteText} leading-snug font-medium`}>{item.content}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {item.avatar_url ? (
                                <img src={item.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                              ) : (
                                <div className={`w-4 h-4 rounded-full ${cfg.badge} flex items-center justify-center text-[7px] font-bold text-white`}>
                                  {item.user_name?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-[10px] text-gray-500">{item.user_name}</span>
                              {myCount > 0 && (
                                <span className="ml-auto text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                                  You: {myCount}
                                </span>
                              )}
                            </div>
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
/*  Phase 5 – Vote Results (sorted by highest votes)                   */
/* ------------------------------------------------------------------ */
const RESULT_COL_CONFIG = [
  { phase: "went_well", title: "What went well?", icon: (cls = "w-5 h-5") => <CheckCircleIcon className={cls} />, bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-400", badge: "bg-emerald-500", barBg: "bg-emerald-400" },
  { phase: "didnt_go_well", title: "What went less well?", icon: (cls = "w-5 h-5") => <XCircleIcon className={cls} />, bg: "bg-rose-100", text: "text-rose-900", border: "border-rose-400", badge: "bg-rose-500", barBg: "bg-rose-400" },
  { phase: "should_try", title: "What to try next?", icon: (cls = "w-5 h-5") => <LightbulbIcon className={cls} />, bg: "bg-sky-100", text: "text-sky-900", border: "border-sky-400", badge: "bg-sky-500", barBg: "bg-sky-400" },
  { phase: "puzzles_us", title: "What puzzles us?", icon: (cls = "w-5 h-5") => <HelpCircleIcon className={cls} />, bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-400", badge: "bg-amber-500", barBg: "bg-amber-400" },
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
            <div key={cfg.phase} className="rounded-2xl overflow-hidden border retro-card-depth flex flex-col" style={{ background: "linear-gradient(180deg, rgba(240, 247, 244, 0.95) 0%, rgba(255, 255, 255, 0.7) 100%)", borderColor: "rgba(6, 194, 134, 0.1)" }}>
              <div className={`flex items-center gap-2.5 px-5 py-4 border-b-4 ${cfg.border}`} style={{ background: `linear-gradient(135deg, ${cfg.bg === "bg-emerald-100" ? "rgba(209, 250, 229, 0.6)" : cfg.bg === "bg-rose-100" ? "rgba(255, 228, 230, 0.6)" : cfg.bg === "bg-sky-100" ? "rgba(224, 242, 254, 0.6)" : "rgba(254, 243, 199, 0.6)"} 0%, rgba(240, 247, 244, 0.4) 100%)` }}>
                <span>{cfg.icon("w-5 h-5")}</span>
                <h3 className="text-sm font-bold text-gray-800 flex-1">{cfg.title}</h3>
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
/*  Phase 6 – Action Items (persisted)                                 */
/* ------------------------------------------------------------------ */
function ActionItemsPhase({ employees, onNext, onPrev }) {
  const { items: actions, loading, addItem, removeItem } = useRetroItems("action_items", { all: true });
  const [input, setInput] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const handleAdd = () => {
    if (input.trim() && assignees.length > 0) {
      addItem(input.trim(), assignees.join(", "), dueDate || null);
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
          <div className="grid grid-cols-[1fr_140px_110px_40px] gap-3 px-5 py-3.5 border-b border-primary/10 text-[11px] font-semibold text-muted uppercase tracking-wider" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.6), rgba(230, 236, 247, 0.5))" }}>
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
                <div key={a.id} className="grid grid-cols-[1fr_140px_110px_40px] gap-3 px-5 py-3.5 items-center hover:bg-card-border/10 transition-colors">
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
                    onClick={() => removeItem(a.id)}
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
/*  Phase 7 – Appreciation (persisted)                                 */
/* ------------------------------------------------------------------ */
function AppreciationPhase({ onNext, onPrev }) {
  const { items: kudos, loading, addItem } = useRetroItems("appreciation");
  const [who, setWho] = useState("");
  const [reason, setReason] = useState("");

  const handleAdd = () => {
    if (who.trim() && reason.trim()) {
      addItem(`@${who.trim()}: ${reason.trim()}`);
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
/*  Phase 7 – Close & Summary                                          */
/* ------------------------------------------------------------------ */
function CloseSummaryPhase({ onPrev, onFinish }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 relative">
      <div className="absolute -top-12 -right-20 w-44 h-44 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl pointer-events-none retro-float" />
      <div className="absolute -bottom-12 -left-16 w-40 h-40 rounded-full bg-gradient-to-tr from-accent/10 to-transparent blur-3xl pointer-events-none retro-float-reverse" />

      <div className="text-center space-y-4 mb-2 retro-slide-in relative">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 blur-xl retro-icon-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 via-white to-accent/10 border border-white/60 shadow-lg flex items-center justify-center retro-icon-pulse">
            <SparklesIcon className="w-10 h-10" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Retrospective Complete!</h2>
        <p className="text-muted text-sm max-w-md mx-auto leading-relaxed">
          Great session! Remember — continuous improvement is a journey, not a destination.
          Take the action items forward and make the next sprint even better.
        </p>
      </div>

      <div className="retro-gradient-border rounded-3xl retro-slide-in-delay-1">
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
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
                className="flex items-center gap-2.5 p-3 rounded-xl text-sm transition-all hover:scale-[1.02]"
                style={{ animation: "retroSlideIn 0.3s ease-out both", animationDelay: `${idx * 50}ms`, background: "linear-gradient(135deg, rgba(232, 250, 243, 0.7), rgba(230, 236, 247, 0.6))", border: "1px solid rgba(6, 194, 134, 0.1)" }}
              >
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center shadow-md shadow-primary/20">
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
        <div className="flex items-center justify-between pt-6 mt-6 retro-slide-in-delay-2">
          <button
            onClick={onPrev}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium text-muted hover:text-foreground retro-glass hover:shadow-md border border-white/40 transition-all btn-press"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button
            onClick={onFinish}
            className="group flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-2xl text-sm font-semibold shadow-xl shadow-accent/20 hover:shadow-2xl hover:shadow-accent/30 hover:scale-[1.02] transition-all btn-press btn-shimmer"
          >
            Finish Retrospective
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Employee Retro View – follows the facilitator's phase via polling   */
/* ------------------------------------------------------------------ */
function EmployeeRetroView({ token, employees: allEmployees, role, icebreakerState, spinTrigger }) {
  const [currentPhase, setCurrentPhase] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessionTeamIds, setSessionTeamIds] = useState([]);
  const [hasSession, setHasSession] = useState(false);
  const [employees, setEmployees] = useState(allEmployees);
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
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [token]);

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
        <p className="text-muted text-sm">Waiting for the facilitator to start the session...</p>
        <div className="flex justify-center pt-4">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 blur-lg" />
            <div className="absolute inset-0 rounded-full border-2 border-card-border/40" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        </div>
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
        </div>

        <div className={`min-h-[420px] mx-auto retro-phase-in ${[3, 4, 5].includes(currentPhase) ? "max-w-full px-8" : "max-w-4xl"}`}>
          {currentPhase === 0 && <EmployeeIceBreakerView employees={employees} icebreakerState={icebreakerState} spinTrigger={spinTrigger} />}
          {currentPhase === 1 && <EmployeeMoodPicker />}
          {currentPhase === 2 && <PreviousOpenActionsPhase employees={employees} role={role} onNext={null} onPrev={null} />}
          {currentPhase === 3 && <RetroBoardPhase onNext={null} onPrev={null} />}
          {currentPhase === 4 && <VotingPhase employees={employees} role={role} onNext={null} onPrev={null} />}
          {currentPhase === 5 && <VoteResultsPhase onNext={null} onPrev={null} />}
          {currentPhase === 6 && <ActionItemsPhase employees={employees} onNext={null} onPrev={null} />}
          {currentPhase === 7 && <AppreciationPhase onNext={null} onPrev={null} />}
          {currentPhase === 8 && <CloseSummaryPhase onPrev={null} onFinish={null} />}
        </div>
      </div>
    </SessionContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function RetrospectivePage() {
  const { role, loading: authLoading } = useAuth();
  const token = useAccessToken();
  const [currentPhase, setCurrentPhase] = useState(0);
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [sessionTeamIds, setSessionTeamIds] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);

  const isAdmin = ALLOWED_ROLES.includes(role);
  const { icebreakerState, spinTrigger, broadcastIcebreakerState, broadcastSpin } = useRetroChannel(isAdmin ? "admin" : "employee");

  useEffect(() => {
    fetch("/api/retro/employees")
      .then((r) => r.json())
      .then((d) => {
        setAllEmployees(d.employees || []);
        setEmployees(d.employees || []);
      })
      .catch(() => {});
  }, []);

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
        }
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, [token]);

  const syncPhase = useCallback(async (phase) => {
    if (!token || !sessionId) return;
    try {
      await fetch("/api/retro/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId, current_phase: phase }),
      });
    } catch {}
  }, [token, sessionId]);

  const startMeeting = async () => {
    if (!token) return;
    try {
      const teamId = selectedTeams.length > 0 ? selectedTeams.join(",") : null;
      const res = await fetch("/api/retro/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ team_id: teamId }),
      });
      const data = await res.json();
      if (data.session) {
        setSessionId(data.session.id);
        setSessionTeamIds(selectedTeams);
        setCurrentPhase(0);
        setStarted(true);

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
        }, 100);
      }
    } catch {}
  };

  const next = () => {
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
        await fetch("/api/retro/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch {}
    }
    setStarted(false);
    setSessionId(null);
    setSessionTeamIds([]);
    setSelectedTeams([]);
    setCurrentPhase(0);
    setEmployees(allEmployees);
  };

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
        <EmployeeRetroView token={token} employees={employees} role={role} icebreakerState={icebreakerState} spinTrigger={spinTrigger} />
      </AppLayout>
    );
  }

  /* ---- Landing / Start Screen (admin only) ---- */
  if (!started) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto text-center py-12 space-y-8 relative">
          {/* Decorative orbs */}
          <div className="absolute -top-8 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl pointer-events-none retro-float" />
          <div className="absolute -bottom-12 -left-16 w-36 h-36 rounded-full bg-gradient-to-tr from-accent/8 to-transparent blur-3xl pointer-events-none retro-float-reverse" />

          <div className="space-y-4 retro-slide-in">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 to-accent/15 blur-xl retro-icon-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 via-white to-accent/10 border border-white/60 shadow-lg flex items-center justify-center retro-icon-pulse">
                <ArrowPathIcon className="w-10 h-10" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-foreground via-foreground to-accent bg-clip-text text-transparent">Sprint Retrospective</h1>
            <p className="text-muted max-w-sm mx-auto leading-relaxed text-sm">
              Reflect on the last sprint, celebrate wins, identify improvements, and define
              concrete action items for the team.
            </p>
          </div>

          {/* Team Selection */}
          <div className="retro-gradient-border rounded-3xl retro-slide-in-delay-1">
            <div className="rounded-3xl p-6 text-left space-y-4" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
              <h3 className="font-bold text-foreground flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/15 to-primary/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                Select Team
              </h3>
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

              {/* Filtered member preview */}
              <div className="pt-2 border-t border-card-border/50">
                <p className="text-xs text-muted mb-2.5">
                  {filteredEmployees.length} member{filteredEmployees.length !== 1 ? "s" : ""} in this retro
                </p>
                <div className="flex flex-wrap gap-2">
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
            </div>
          </div>

          {/* Meeting flow */}
          <div className="retro-gradient-border rounded-3xl retro-slide-in-delay-1">
            <div className="rounded-3xl p-6 text-left" style={{ background: "linear-gradient(145deg, rgba(240, 247, 244, 0.95) 0%, rgba(230, 236, 247, 0.9) 100%)" }}>
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/15 to-primary/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                Meeting Flow -- {PHASES.length} Phases
              </h3>
              <div className="space-y-1.5">
                {PHASES.map((phase, idx) => (
                  <div key={phase.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gradient-to-r hover:from-primary/8 hover:to-accent/6 transition-all group">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform" style={{ background: "linear-gradient(135deg, rgba(232, 250, 243, 0.8), rgba(230, 236, 247, 0.7))", border: "1px solid rgba(6, 194, 134, 0.12)" }}>
                      {phase.icon("w-4 h-4")}
                    </div>
                    <span className="text-sm text-foreground/80 font-medium">{phase.label}</span>
                    {idx === 0 && (
                      <span className="ml-auto text-[10px] font-bold text-white bg-gradient-to-r from-accent to-accent-dark px-2.5 py-0.5 rounded-full shadow-sm shadow-accent/20">
                        START
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="retro-slide-in-delay-2">
            <button
              onClick={startMeeting}
              disabled={filteredEmployees.length === 0}
              className={`group inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-semibold shadow-xl transition-all btn-press btn-shimmer ${
                filteredEmployees.length === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-primary to-accent text-white shadow-accent/20 hover:shadow-2xl hover:shadow-accent/30 hover:scale-[1.02]"
              }`}
            >
              <span>Start Retrospective</span>
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ---- Active Meeting ---- */
  return (
    <SessionContext.Provider value={sessionId}>
      <AppLayout>
        <div className="space-y-8 pb-8">
          <div className="max-w-4xl mx-auto space-y-4">
            {sessionTeamIds.length > 0 && (
              <div className="flex justify-center gap-1.5 flex-wrap retro-slide-in">
                {sessionTeamIds.map((tid) => (
                  <span key={tid} className={`text-[10px] font-semibold px-3 py-1.5 rounded-full border shadow-sm ${getTeamColor(tid)}`}>
                    {getTeamLabel(tid)}
                  </span>
                ))}
              </div>
            )}
            <ProgressBar currentPhase={currentPhase} />
            <div className="flex justify-end retro-slide-in-delay-1">
              <PhaseTimer phaseIndex={currentPhase} />
            </div>
          </div>

          <div
            key={currentPhase}
            className={`min-h-[420px] mx-auto retro-phase-in ${[3, 4, 5].includes(currentPhase) ? "max-w-full px-8" : "max-w-4xl"}`}
          >
            {currentPhase === 0 && <IceBreakerPhase employees={employees} onNext={next} broadcastIcebreakerState={broadcastIcebreakerState} broadcastSpin={broadcastSpin} />}
            {currentPhase === 1 && <SetTheStagePhase employees={employees} role={role} onNext={next} onPrev={prev} />}
            {currentPhase === 2 && <PreviousOpenActionsPhase employees={employees} role={role} onNext={next} onPrev={prev} />}
            {currentPhase === 3 && <RetroBoardPhase onNext={next} onPrev={prev} />}
            {currentPhase === 4 && <VotingPhase employees={employees} role={role} onNext={next} onPrev={prev} />}
            {currentPhase === 5 && <VoteResultsPhase onNext={next} onPrev={prev} />}
            {currentPhase === 6 && <ActionItemsPhase employees={employees} onNext={next} onPrev={prev} />}
            {currentPhase === 7 && <AppreciationPhase onNext={next} onPrev={prev} />}
            {currentPhase === 8 && <CloseSummaryPhase onPrev={prev} onFinish={finish} />}
          </div>
        </div>
      </AppLayout>
    </SessionContext.Provider>
  );
}
