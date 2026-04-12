"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <img src="/logo.svg" alt="xLM" className="h-16 drop-shadow-lg" />
            <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text text-transparent">
              cSU
            </span>
          </div>

          <div className="login-glass login-glass-glow rounded-3xl shadow-2xl shadow-primary/10 p-8 sm:p-10 space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary-light mx-auto flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
              <p className="text-sm text-muted mt-2">
                If an account exists for <strong className="text-foreground">{email}</strong>, we&apos;ve sent a password reset link. Check your inbox and spam folder.
              </p>
            </div>
            <Link
              href="/"
              className="inline-block text-sm font-medium text-accent hover:text-accent-dark transition-colors"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-8 overflow-y-auto relative">
      <div className="relative w-full max-w-md animate-login-in">
        <div className="animate-login-stagger-1 flex flex-col items-center gap-4 mb-10">
          <img src="/logo.svg" alt="xLM" className="h-16 drop-shadow-lg" />
          <div>
            <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text text-transparent">
              cSU
            </span>
          </div>
        </div>

        <div className="animate-login-stagger-2 login-glass login-glass-glow rounded-3xl shadow-2xl shadow-primary/10 p-8 sm:p-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-primary-light mx-auto flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Forgot password?
            </h1>
            <p className="text-sm text-muted">
              Enter your email and we&apos;ll send you a link to reset your password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="animate-login-stagger-3">
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
                    Sending...
                  </>
                ) : (
                  <>
                    <span>Send reset link</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="animate-login-stagger-5 text-center text-sm text-muted/90 mt-8">
          Remember your password?{" "}
          <Link href="/" className="text-accent hover:text-accent-dark font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
