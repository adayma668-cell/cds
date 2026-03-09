"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push("/login"), 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-light via-background to-accent-light">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="bg-card rounded-2xl shadow-lg shadow-primary/5 border border-card-border p-8 space-y-5">
          <div className="w-14 h-14 rounded-full bg-accent-light flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-accent">Sign Up Disabled</h1>
          <p className="text-sm text-muted leading-relaxed">
            Account creation is managed by the admin. Please contact your
            administrator to get an account.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors shadow-md shadow-primary/20"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
