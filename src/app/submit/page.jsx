"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingChannel } from "@/hooks/useMeetingChannel";
import StandupForm from "@/components/StandupForm";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { getTeamLabel, getTeamColor } from "@/lib/teams";

const ALLOWED_ROLES = ["employee", "scrum_master"];

function WaitingRoom({ submittedData }) {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="text-center space-y-1">
        <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-accent">Standup Submitted</h1>
        <p className="text-sm text-muted">Your update has been recorded</p>
      </div>

      <div className="bg-card rounded-2xl border border-card-border shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-primary-dark uppercase tracking-wide">
            Your Updates
          </h2>
        </div>

        <div className="rounded-xl bg-primary-light/50 border border-primary/10 p-4">
          <p className="text-xs font-semibold text-primary-dark uppercase tracking-wide mb-1.5">
            Yesterday
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {submittedData.yesterday}
          </p>
        </div>

        <div className="rounded-xl bg-accent-light/50 border border-accent/10 p-4">
          <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">
            Today
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {submittedData.today}
          </p>
        </div>

        {submittedData.blockers && (
          <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
            <p className="text-xs font-semibold text-danger uppercase tracking-wide mb-1.5">
              Blockers
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {submittedData.blockers}
            </p>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Waiting for Scrum Master to start the meeting
          </p>
          <p className="text-xs text-amber-600 mt-1">
            This page will update automatically when the meeting begins
          </p>
        </div>
        <div className="flex justify-center gap-1.5 pt-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ActiveMeetingView({ meetingState }) {
  const { currentMember, currentIndex, totalMembers } = meetingState;

  if (!currentMember) return null;

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
      </div>

      {/* Now Speaking Card */}
      <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-card-border bg-accent-light/20 flex items-center gap-4">
          {currentMember.avatar_url ? (
            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-accent/20">
              <img src={currentMember.avatar_url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-accent">
                {(currentMember.name || "?").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground truncate">
                {currentMember.name}
              </h2>
              <span className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary text-white animate-pulse">
                NOW SPEAKING
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <p className="text-sm text-muted truncate">{currentMember.email}</p>
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

        <div className="p-6 sm:p-8 space-y-4">
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

function CompletedMeetingView({ meetingState }) {
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
  const { loading } = useAuth({ allowedRoles: ALLOWED_ROLES });
  const { meetingState } = useMeetingChannel("employee");
  const [submittedData, setSubmittedData] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    async function checkTodaySubmission() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setCheckingExisting(false); return; }

        const res = await fetch("/api/standup?scope=mine&date=today", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) { setCheckingExisting(false); return; }

        const { standups } = await res.json();
        if (standups && standups.length > 0) {
          const s = standups[0];
          setSubmittedData({ yesterday: s.yesterday, today: s.today, blockers: s.blockers });
        }
      } catch {
        // ignore – let user submit if check fails
      } finally {
        setCheckingExisting(false);
      }
    }
    if (!loading) checkTodaySubmission();
  }, [loading]);

  const handleSubmitted = (data) => {
    setSubmittedData(data);
  };

  if (loading || checkingExisting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const meetingPhase = meetingState?.phase;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Form phase — not yet submitted */}
        {!submittedData && (
          <>
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-accent">Submit Standup</h1>
              <p className="text-sm text-muted">Share your daily update</p>
            </div>
            <div className="bg-card rounded-2xl border border-card-border shadow-sm p-6 sm:p-8">
              <StandupForm onSubmitted={handleSubmitted} />
            </div>
          </>
        )}

        {/* Submitted + meeting not started or in lobby */}
        {submittedData && (!meetingPhase || meetingPhase === "lobby") && (
          <WaitingRoom submittedData={submittedData} />
        )}

        {/* Meeting active — show current speaker in sync */}
        {submittedData && meetingPhase === "active" && (
          <ActiveMeetingView meetingState={meetingState} />
        )}

        {/* Meeting completed */}
        {submittedData && meetingPhase === "completed" && (
          <CompletedMeetingView meetingState={meetingState} />
        )}
      </div>
    </AppLayout>
  );
}
