"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";

const SPLASH_DURATION_MS = 2400;
const AUTH_LOAD_TIMEOUT_MS = 2000;

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const [phase, setPhase] = useState("splash");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showFormAnyway, setShowFormAnyway] = useState(false);
  const splashRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading && !showFormAnyway) {
      timeoutRef.current = setTimeout(
        () => setShowFormAnyway(true),
        AUTH_LOAD_TIMEOUT_MS
      );
    } else if (!authLoading) {
      setShowFormAnyway(false);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [authLoading, showFormAnyway]);

  useEffect(() => {
    if (phase !== "splash") return;
    const t = setTimeout(() => {
      if (splashRef.current) {
        splashRef.current.classList.add("animate-splash-out");
      }
      setTimeout(() => setPhase("login"), 500);
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

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
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  const showSpinner = (authLoading && !showFormAnyway) || user;
  if (showSpinner) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden relative">
        <div className="relative flex flex-col items-center gap-6">
          <div className="animate-splash-logo opacity-0 flex flex-col items-center gap-3">
            <img src="/logo.svg" alt="xLM" className="h-16 drop-shadow-lg" />
            <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text text-transparent gradient-text-shift bg-[length:200%_auto]">
              cSU
            </span>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/70 animate-dot-reveal"
                style={{ animationDelay: `${0.6 + i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-8 overflow-y-auto relative">

      {/* Splash screen */}
      {phase === "splash" && (
        <div
          ref={splashRef}
          className="fixed inset-0 z-20 flex flex-col items-center justify-center"
        >
          <div className="relative flex flex-col items-center gap-8">
            <div className="animate-splash-logo opacity-0 flex flex-col items-center gap-5">
              <div className="relative">
                <img
                  src="/logo.svg"
                  alt="xLM"
                  className="h-24 drop-shadow-xl"
                />
              </div>
              <div className="text-center">
                <span className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text text-transparent gradient-text-shift bg-[length:200%_auto]">
                  cSU
                </span>
                <div
                  className="h-0.5 mt-3 mx-auto w-0 origin-center rounded-full bg-gradient-to-r from-transparent via-primary to-transparent animate-gradient-line"
                  style={{ maxWidth: "120px" }}
                />
              </div>
              <p className="animate-splash-text opacity-0 text-sm font-semibold text-muted uppercase tracking-[0.25em]">
                Continuous Status Updates
              </p>
            </div>
            <div className="flex gap-2 mt-2 [&>div]:animate-splash-loader">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-primary/70"
                  style={{ animationDelay: `${0.5 + i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Login form */}
      {phase === "login" && (
        <div className="relative w-full max-w-md animate-login-in">
          <div className="animate-login-stagger-1 flex flex-col items-center gap-4 mb-10">
            <img
              src="/logo.svg"
              alt="xLM"
              className="h-16 drop-shadow-lg"
            />
            <div>
              <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text text-transparent">
                cSU
              </span>
            </div>
          </div>

          <div className="animate-login-stagger-2 login-glass login-glass-glow rounded-3xl shadow-2xl shadow-primary/10 p-8 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Welcome back
              </h1>
              <p className="text-sm text-muted">
                Sign in to continue to your workspace
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              <div className="animate-login-stagger-3 space-y-5">
                <div className="group">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground/90 mb-2"
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
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-card-border/80 bg-white/60 px-4 py-3.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white placeholder:text-muted/50 hover:border-primary/30"
                  />
                </div>

                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-foreground/90"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-accent hover:text-accent-dark transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-card-border/80 bg-white/60 px-4 py-3.5 pr-12 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white placeholder:text-muted/50 hover:border-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted/60 hover:text-foreground/80 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="animate-login-stagger-4 flex items-center gap-3 rounded-xl bg-red-50/90 border border-red-200/80 px-4 py-3.5 text-sm text-red-700 backdrop-blur-sm">
                  <svg
                    className="w-5 h-5 shrink-0 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="animate-login-stagger-5 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="btn-shimmer btn-press w-full rounded-xl bg-primary text-white py-3.5 text-sm font-semibold hover:bg-primary-dark transition-all duration-300 disabled:opacity-50 disabled:hover:bg-primary shadow-lg shadow-primary/30 hover:shadow-primary/40 cursor-pointer flex items-center justify-center gap-2.5 relative z-10"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <p className="animate-login-stagger-5 text-center text-sm text-muted/90 mt-8">
            Don&apos;t have an account?{" "}
            <span className="text-muted">Contact your admin</span>
          </p>
        </div>
      )}
    </div>
  );
}
