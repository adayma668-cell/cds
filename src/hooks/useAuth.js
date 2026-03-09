"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";

/**
 * @param {Object} options
 * @param {string[]} [options.allowedRoles] - Roles permitted on this page.
 */
export function useAuth({ allowedRoles } = {}) {
  const router = useRouter();
  const { user, role, loading } = useAuthContext();
  const rolesRef = useRef(allowedRoles);
  rolesRef.current = allowedRoles;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const allowed = rolesRef.current;
    if (allowed && !allowed.includes(role) && role !== "super_admin") {
      router.push("/dashboard");
    }
  }, [loading, user, role, router]);

  return { user, role, loading };
}
