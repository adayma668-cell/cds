"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [userId, setUserId] = useState("");
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const uid = urlParams.get("uid");

    if (token && uid) {
      setInviteToken(token);
      setUserId(uid);
      setFormReady(true);
    } else {
      setError("Invalid or expired invite link. Please ask your admin to resend the invitation.");
    }

    setVerifying(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken, userId, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-card-border" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary-light mx-auto flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Password Set!</h1>
            <p className="text-sm text-muted mt-2">Redirecting you to the login page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-8 overflow-y-auto relative">
      <div className="relative w-full max-w-md animate-login-in">
        {/* Logo */}
        <div className="animate-login-stagger-1 flex flex-col items-center gap-4 mb-10">
          <img src="/logo.svg" alt="xLM" className="h-16 drop-shadow-lg" />
          <div>
            <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text text-transparent">
              cSU
            </span>
          </div>
        </div>

        {/* Form card */}
        <div className="animate-login-stagger-2 login-glass login-glass-glow rounded-3xl shadow-2xl shadow-primary/10 p-8 sm:p-10 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Set Your Password
            </h1>
            <p className="text-sm text-muted">
              Create a password to access your workspace
            </p>
          </div>

          {!formReady ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-red-50 mx-auto flex items-center justify-center">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-red-600">{error}</p>
              <a
                href="/"
                className="inline-block text-sm font-medium text-accent hover:text-accent-dark transition-colors"
              >
                Go to login page
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="animate-login-stagger-3 space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground/90 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-card-border/80 bg-white/60 px-4 py-3.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white placeholder:text-muted/50 hover:border-primary/30"
                  />
                </div>
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-foreground/90 mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full rounded-xl border border-card-border/80 bg-white/60 px-4 py-3.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white placeholder:text-muted/50 hover:border-primary/30"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 rounded-xl bg-red-50/90 border border-red-200/80 px-4 py-3.5 text-sm text-red-700 backdrop-blur-sm">
                  <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="animate-login-stagger-5 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-shimmer btn-press w-full rounded-xl bg-primary text-white py-3.5 text-sm font-semibold hover:bg-primary-dark transition-all duration-300 disabled:opacity-50 shadow-lg shadow-primary/30 hover:shadow-primary/40 cursor-pointer flex items-center justify-center gap-2.5 relative z-10"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Setting password...
                    </>
                  ) : (
                    <>
                      <span>Set Password & Continue</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
