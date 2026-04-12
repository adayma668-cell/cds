"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { DashboardSkeleton } from "@/components/Skeleton";

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const GREETING_KEY = "csu-greeting-shown";

export default function Dashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const shown = typeof window !== "undefined" && sessionStorage.getItem(GREETING_KEY);
    if (!shown) {
      setShowGreeting(true);
      sessionStorage.setItem(GREETING_KEY, "1");
    }
  }, [user]);

  const dismissGreeting = () => {
    setShowGreeting(false);
  };

  useEffect(() => {
    if (!showGreeting) return;
    const t = setTimeout(dismissGreeting, 3500);
    return () => clearTimeout(t);
  }, [showGreeting]);

  if (loading || !user) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  const name = user.user_metadata?.name || "User";
  const avatarUrl = user.user_metadata?.avatar_url;

  const roleBadge = {
    super_admin: "bg-accent-light text-accent",
    scrum_master: "bg-primary-light text-primary-dark",
    employee: "bg-background text-muted",
  };

  return (
    <>
      {/* Time-based greeting popup — rendered outside AppLayout to avoid
          the PageTransition transform breaking position:fixed */}
      {showGreeting && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ height: "100dvh" }}
          role="dialog"
          aria-live="polite"
          aria-label="Welcome greeting"
        >
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            style={{ height: "100dvh" }}
            onClick={dismissGreeting}
            aria-hidden="true"
          />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-card-border bg-card shadow-2xl shadow-primary/10 p-6 sm:p-8"
            style={{
              animation: "greetingPopup 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            <button
              onClick={dismissGreeting}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-background/80 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex flex-col items-center text-center">
              {avatarUrl ? (
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30 shrink-0 mb-4">
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center border-2 border-primary/30 shrink-0 mb-4">
                  <span className="text-2xl font-bold text-primary">{name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">
                {getTimeGreeting()}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                {name}
              </h2>
              <p className="text-sm text-muted mt-1">
                Great to have you back. Ready to get started?
              </p>
              <div className="mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
          </div>
        </div>
      )}

      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Welcome Card */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {avatarUrl ? (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-card-border shrink-0 aspect-square">
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-accent-light flex items-center justify-center border-2 border-card-border shrink-0">
                  <span className="text-lg sm:text-xl font-bold text-accent">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-accent truncate">
                  Welcome, {name}
                </h1>
                <p className="text-sm text-muted mt-1 truncate">{user.email}</p>
              </div>
            </div>
            <span
              className={`self-start text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                roleBadge[role] || roleBadge.employee
              }`}
            >
              {role?.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider px-1">
            Quick Actions
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/tasks"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 card-hover hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">My Tasks</h3>
              <p className="text-sm text-muted mt-0.5">
                Add tickets, track status, update at end of day
              </p>
            </Link>

            <Link
              href="/submit"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 card-hover hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">Submit Standup</h3>
              <p className="text-sm text-muted mt-0.5">
                Share your daily update with the team
              </p>
            </Link>

            <Link
              href="/team-updates"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 card-hover hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mb-3 group-hover:bg-accent/15 transition-colors">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">Updates</h3>
              <p className="text-sm text-muted mt-0.5">
                View today&apos;s updates. Scrum masters can pick other dates.
              </p>
            </Link>

            <Link
              href="/notes"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 card-hover hover:border-amber-300 hover:shadow-md hover:shadow-amber-500/5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:ring-offset-2"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200/70 transition-colors">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">Notes & Goals</h3>
              <p className="text-sm text-muted mt-0.5">
                Personal notes, goals, and reminders
              </p>
            </Link>

            {(role === "scrum_master" || role === "super_admin") && (
              <Link
                href="/start-meeting"
                className="group bg-card rounded-xl border border-card-border shadow-sm p-5 card-hover hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mb-3 group-hover:bg-accent/15 transition-colors">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground">Start Meeting</h3>
                <p className="text-sm text-muted mt-0.5">
                  Begin a standup session for your team
                </p>
              </Link>
            )}

            {role === "super_admin" && (
              <Link
                href="/admin/tickets"
                className="group bg-card rounded-xl border border-card-border shadow-sm p-5 card-hover hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground">All Tickets</h3>
                <p className="text-sm text-muted mt-0.5">
                  View all tickets by team with user details
                </p>
              </Link>
            )}

            {role === "super_admin" && (
              <Link
                href="/admin"
                className="group bg-card rounded-xl border border-card-border shadow-sm p-5 card-hover hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mb-3 group-hover:bg-accent/15 transition-colors">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground">Admin Panel</h3>
                <p className="text-sm text-muted mt-0.5">
                  Manage users and credentials
                </p>
              </Link>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
    </>
  );
}
