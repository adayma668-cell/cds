"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 text-sm text-muted hover:text-danger hover:bg-red-50 rounded-md transition-colors cursor-pointer"
    >
      Sign out
    </button>
  );
}
