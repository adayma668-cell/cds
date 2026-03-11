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
      window.location.href = "/login";
    } catch {
      setSigningOut(false);
      window.location.href = "/login";
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={signingOut}
      type="button"
      className="px-3 py-1.5 text-sm text-muted hover:text-danger hover:bg-red-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
    >
      {signingOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
