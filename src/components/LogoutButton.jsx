"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LogoutButton() {
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      // Full page navigation ensures auth state is fully cleared before
      // Login page loads — avoids race where we'd redirect back to dashboard
      window.location.href = "/";
    } catch {
      setSigningOut(false);
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={signingOut}
      type="button"
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted hover:text-danger hover:bg-red-50 rounded-xl transition-all cursor-pointer disabled:opacity-50 w-full"
    >
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      {signingOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
