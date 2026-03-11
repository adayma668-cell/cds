"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";

const AUTH_LOAD_TIMEOUT_MS = 2000; // Show form if auth check hangs (e.g. slow network)

export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFormAnyway, setShowFormAnyway] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  // Safety: if auth loading hangs (network/Supabase slow), show form anyway
  useEffect(() => {
    if (authLoading && !showFormAnyway) {
      timeoutRef.current = setTimeout(() => setShowFormAnyway(true), AUTH_LOAD_TIMEOUT_MS);
    } else if (!authLoading) {
      setShowFormAnyway(false);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [authLoading, showFormAnyway]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  const showSpinner = (authLoading && !showFormAnyway) || user;
  if (showSpinner) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center overflow-y-auto">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-8 overflow-y-auto relative z-10 bg-gradient-to-br from-primary-light via-background to-accent-light">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2">
          <img src="/logo.svg" alt="xLM" className="h-14" />
          <span className="text-xl font-bold tracking-tight">
            <span className="text-primary">c</span>
            <span className="text-accent">DS</span>
          </span>
        </div>

        <div className="bg-card rounded-2xl shadow-lg shadow-primary/5 border border-card-border p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-accent">Welcome to cDS</h1>
            <p className="mt-1 text-sm text-muted">
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground/80 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground/80 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all"
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-red-50 rounded-lg px-3.5 py-2.5 border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted/70">
          Contact your admin to get an account
        </p>
      </div>
    </div>
  );
}
