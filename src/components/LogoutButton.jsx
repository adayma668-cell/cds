"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { clearAllDrafts } from "@/components/StandupForm";

export default function LogoutButton({ collapsed }) {
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("csu-greeting-shown");
        clearAllDrafts();
      }
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
      className={`group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted hover:text-danger hover:bg-red-50 rounded-xl transition-all cursor-pointer disabled:opacity-50 w-full ${
        collapsed ? "justify-center" : ""
      }`}
      title={collapsed ? "Sign out" : undefined}
    >
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span
        className={`whitespace-nowrap transition-all duration-300 ${
          collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
        }`}
      >
        {signingOut ? "Signing out..." : "Sign out"}
      </span>
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-foreground text-background text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50">
          Sign out
        </span>
      )}
    </button>
  );
}
