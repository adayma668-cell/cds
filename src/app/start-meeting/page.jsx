"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";

const ALLOWED_ROLES = ["scrum_master"];
const TIMER_SECONDS = 120;

const DUMMY_PENDING = [
  {
    id: "p1",
    name: "Kavita Reddy",
    email: "kavita@continuousvalidation.com",
    teams: ["ai_ml"],
  },
  {
    id: "p2",
    name: "Rohan Mehta",
    email: "rohan@continuousvalidation.com",
    teams: ["it", "spt"],
  },
  {
    id: "p3",
    name: "Neha Joshi",
    email: "neha@continuousvalidation.com",
    teams: ["marketing"],
  },
];

const DUMMY_STANDUPS = [
  {
    id: "1",
    name: "Rahul Sharma",
    email: "rahul@continuousvalidation.com",
    teams: ["ai_ml"],
    yesterday:
      "Completed the API integration for user authentication module. Fixed 3 bugs related to token refresh flow. Reviewed PRs from the frontend team.",
    today:
      "Will work on the payment gateway integration. Need to set up Stripe webhook handlers and test the checkout flow end-to-end.",
    blockers:
      "Waiting on the design team for the updated checkout UI mockups.",
  },
  {
    id: "2",
    name: "Priya Patel",
    email: "priya@continuousvalidation.com",
    teams: ["marketing", "spt"],
    yesterday:
      "Designed the new dashboard wireframes and shared with stakeholders. Updated the component library with new button variants.",
    today:
      "Starting the responsive layout implementation for the analytics dashboard. Will pair with Rahul on the checkout page design.",
    blockers: "",
  },
  {
    id: "3",
    name: "Amit Kumar",
    email: "amit@continuousvalidation.com",
    teams: ["it"],
    yesterday:
      "Set up CI/CD pipeline for the staging environment. Configured Docker containers for the microservices. Wrote unit tests for the notification service.",
    today:
      "Will configure monitoring and alerting with Grafana. Need to set up log aggregation for production debugging.",
    blockers:
      "AWS IAM permissions are pending approval from the DevOps lead. Cannot proceed with production deployment until resolved.",
  },
  {
    id: "4",
    name: "Sneha Gupta",
    email: "sneha@continuousvalidation.com",
    teams: ["ai_ml", "it"],
    yesterday:
      "Wrote integration tests for the order management module. Fixed flaky test in the CI pipeline. Documented the testing strategy for new developers.",
    today:
      "Will work on E2E tests for the user onboarding flow. Planning to set up visual regression testing with Playwright.",
    blockers: "",
  },
  {
    id: "5",
    name: "Vikram Singh",
    email: "vikram@continuousvalidation.com",
    teams: ["spt"],
    yesterday:
      "Optimized database queries reducing page load time by 40%. Migrated legacy endpoints to the new REST API structure.",
    today:
      "Will implement caching layer with Redis for the product catalog. Need to benchmark performance before and after changes.",
    blockers:
      "The Redis instance on staging is not provisioned yet.",
  },
];

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
  const { loading } = useAuth({ allowedRoles: ALLOWED_ROLES });
  const [phase, setPhase] = useState("lobby");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seconds, setSeconds] = useState(TIMER_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const filteredStandups =
    selectedTeam === "all"
      ? DUMMY_STANDUPS
      : DUMMY_STANDUPS.filter((m) => m.teams.includes(selectedTeam));

  const filteredPending =
    selectedTeam === "all"
      ? DUMMY_PENDING
      : DUMMY_PENDING.filter((m) => m.teams.includes(selectedTeam));

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                Select a team and start the standup
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
                All Teams ({DUMMY_STANDUPS.length})
              </button>
              {TEAMS.map((team) => {
                const count = DUMMY_STANDUPS.filter((m) =>
                  m.teams.includes(team.id)
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
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-muted truncate">
                            {member.email}
                          </p>
                          {member.teams.map((t) => (
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
                  No submissions yet for this team
                </div>
              ) : (
                <div className="divide-y divide-card-border/50">
                  {filteredStandups.map((member, i) => (
                    <div
                      key={member.id}
                      className="px-6 py-3.5 flex items-center gap-4"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary-dark">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-muted truncate">
                            {member.email}
                          </p>
                          {member.teams.map((t) => (
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

            <button
              onClick={startMeeting}
              disabled={filteredStandups.length === 0}
              className="w-full rounded-xl bg-accent text-white py-3.5 text-sm font-semibold hover:bg-accent-dark transition-colors shadow-lg shadow-accent/20 cursor-pointer disabled:opacity-50"
            >
              Start Meeting ({totalMembers} submitted member{totalMembers !== 1 ? "s" : ""})
            </button>
          </div>
        )}

        {/* ── ACTIVE MEETING ── */}
        {phase === "active" && (
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
              <div className="flex items-center justify-center gap-2 pt-1">
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
                    {m.name.charAt(0)}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Member Card */}
            <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
              {/* Header with name + timer */}
              <div className="px-6 sm:px-8 py-6 border-b border-card-border bg-accent-light/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center">
                    <span className="text-lg font-bold text-accent">
                      {currentMember.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {currentMember.name}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-sm text-muted">{currentMember.email}</p>
                      {currentMember.teams.map((t) => (
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
                <div className="rounded-xl bg-primary-light/50 border border-primary/10 p-4">
                  <p className="text-xs font-semibold text-primary-dark uppercase tracking-wide mb-1.5">
                    Yesterday
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {currentMember.yesterday}
                  </p>
                </div>

                <div className="rounded-xl bg-accent-light/50 border border-accent/10 p-4">
                  <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">
                    Today
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {currentMember.today}
                  </p>
                </div>

                {currentMember.blockers && (
                  <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
                    <p className="text-xs font-semibold text-danger uppercase tracking-wide mb-1.5">
                      Blockers
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
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
                All {totalMembers} team members have presented their standup
                updates. Great job keeping the meeting on track!
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
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-foreground">
                        {member.name}
                      </p>
                      {member.teams.map((t) => (
                        <span
                          key={t}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${getTeamColor(t)}`}
                        >
                          {getTeamLabel(t)}
                        </span>
                      ))}
                      {member.blockers && (
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
                          {member.today.slice(0, 80)}...
                        </span>
                      </div>
                      {member.blockers && (
                        <div className="text-xs">
                          <span className="font-semibold text-danger">
                            Blocker:{" "}
                          </span>
                          <span className="text-muted">
                            {member.blockers.slice(0, 80)}...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
