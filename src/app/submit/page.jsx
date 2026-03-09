"use client";

import { useAuth } from "@/hooks/useAuth";
import StandupForm from "@/components/StandupForm";
import Navbar from "@/components/Navbar";

const ALLOWED_ROLES = ["employee", "scrum_master"];

export default function Submit() {
  const { loading } = useAuth({ allowedRoles: ALLOWED_ROLES });

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

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-accent">Submit Standup</h1>
          <p className="text-sm text-muted">Share your daily update</p>
        </div>

        <div className="bg-card rounded-2xl border border-card-border shadow-sm p-6 sm:p-8">
          <StandupForm />
        </div>
      </main>
    </div>
  );
}
