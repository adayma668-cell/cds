"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";

export default function Dashboard() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const name = user.user_metadata?.name || "User";

  const roleBadge = {
    super_admin: "bg-accent-light text-accent",
    scrum_master: "bg-primary-light text-primary-dark",
    employee: "bg-background text-muted",
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Welcome Card */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-accent">
                Welcome, {name}
              </h1>
              <p className="text-sm text-muted mt-1">{user.email}</p>
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
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
              href="/submit"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all"
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
              href="/history"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mb-3 group-hover:bg-accent/15 transition-colors">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">My History</h3>
              <p className="text-sm text-muted mt-0.5">
                View and edit your past standups
              </p>
            </Link>

            <Link
              href="/team-updates"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">Team Updates</h3>
              <p className="text-sm text-muted mt-0.5">
                See what your team is working on today
              </p>
            </Link>

            <Link
              href="/blockers"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-red-300 hover:shadow-md hover:shadow-red-500/5 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mb-3 group-hover:bg-red-200/70 transition-colors">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-foreground">Blocker Board</h3>
              <p className="text-sm text-muted mt-0.5">
                Track and resolve team blockers
              </p>
            </Link>

            <Link
              href="/notes"
              className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-amber-300 hover:shadow-md hover:shadow-amber-500/5 transition-all"
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
                className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-all"
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
                href="/admin"
                className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-all"
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

            {role === "super_admin" && (
              <Link
                href="/roles"
                className="group bg-card rounded-xl border border-card-border shadow-sm p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground">Assign Roles</h3>
                <p className="text-sm text-muted mt-0.5">
                  Set Scrum Master or Employee roles
                </p>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
