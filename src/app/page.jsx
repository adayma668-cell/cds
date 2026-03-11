"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden login-gradient-bg">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/20 -top-40 -right-40 blur-[100px] float-orb" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-accent/15 bottom-0 left-0 blur-[90px] float-orb-slow" />
        </div>
        <div className="relative flex flex-col items-center gap-6">
          <div className="animate-splash-logo opacity-0 flex flex-col items-center gap-3">
            <img src="/logo.svg" alt="xLM" className="h-16 drop-shadow-lg" />
            <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text text-transparent gradient-text-shift bg-[length:200%_auto]">
              cDS
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
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-8 overflow-y-auto relative login-gradient-bg">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-primary/25 -top-48 -right-32 blur-[100px] float-orb" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-accent/20 bottom-[-10%] left-[-10%] blur-[90px] float-orb-slow-delayed" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-primary/15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-[80px] float-orb float-orb-delayed" />
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-40 grid-pulse"
          style={{
            backgroundImage: "radial-gradient(rgba(6,194,134,0.15) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Splash screen */}
      {phase === "splash" && (
        <div
          ref={splashRef}
          className="fixed inset-0 z-20 flex flex-col items-center justify-center login-gradient-bg"
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/20 -top-40 -right-40 blur-[100px] float-orb" />
            <div className="absolute w-[450px] h-[450px] rounded-full bg-accent/15 bottom-0 left-0 blur-[90px] float-orb-slow" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: "radial-gradient(rgba(6,194,134,0.12) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
          </div>
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
                  cDS
                </span>
                <div
                  className="h-0.5 mt-3 mx-auto w-0 origin-center rounded-full bg-gradient-to-r from-transparent via-primary to-transparent animate-gradient-line"
                  style={{ maxWidth: "120px" }}
                />
              </div>
              <p className="animate-splash-text opacity-0 text-sm font-semibold text-muted uppercase tracking-[0.25em]">
                Continuous Daily Standup
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
                cDS
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
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground/90 mb-2"
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
                    className="w-full rounded-xl border border-card-border/80 bg-white/60 px-4 py-3.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white placeholder:text-muted/50 hover:border-primary/30"
                  />
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
                  className="btn-shimmer w-full rounded-xl bg-primary text-white py-3.5 text-sm font-semibold hover:bg-primary-dark transition-all duration-300 disabled:opacity-50 disabled:hover:bg-primary shadow-lg shadow-primary/30 hover:shadow-primary/40 cursor-pointer flex items-center justify-center gap-2.5 relative z-10"
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
