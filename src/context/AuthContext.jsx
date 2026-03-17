"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
});

const FETCH_ME_TIMEOUT_MS = 8000;

async function fetchMe(accessToken) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_ME_TIMEOUT_MS);
  try {
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session) {
          setLoading(false);
          return;
        }

        // Use /api/me - server-side fetch bypasses RLS, correct role for all users
        setUser(session.user);
        const data = await fetchMe(session.access_token);
        if (cancelled) return;
        setRole(data?.role ?? "employee");
      } catch {
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN") {
        setUser(session.user);
        setLoading(true);
        fetchMe(session.access_token).then((data) => {
          setRole(data?.role ?? "employee");
          setLoading(false);
        }).catch(() => {
          setRole("employee");
          setLoading(false);
        });
      } else if (event === "TOKEN_REFRESHED") {
        setUser(session.user);
        fetchMe(session.access_token).then((data) => {
          setRole(data?.role ?? "employee");
        }).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
