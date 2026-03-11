"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function StandupForm() {
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = (e) => {
    e.preventDefault();
    setPreviewing(true);
  };

  const handleBack = () => setPreviewing(false);

  const handleSubmit = async () => {
    setMessage({ text: "", type: "" });
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/standup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ yesterday, today, blockers }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit standup");
      }

      setMessage({ text: "Standup submitted successfully!", type: "success" });
      setYesterday("");
      setToday("");
      setBlockers("");
      setPreviewing(false);
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (previewing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wide">
            Preview Your Standup
          </h2>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-primary-light/50 border border-primary/10 p-4">
            <p className="text-xs font-semibold text-primary-dark uppercase tracking-wide mb-1.5">
              Yesterday
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {yesterday}
            </p>
          </div>

          <div className="rounded-xl bg-accent-light/50 border border-accent/10 p-4">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1.5">
              Today
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {today}
            </p>
          </div>

          {blockers && (
            <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
              <p className="text-xs font-semibold text-danger uppercase tracking-wide mb-1.5">
                Blockers
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {blockers}
              </p>
            </div>
          )}
        </div>

        {message.text && (
          <p
            className={`text-sm rounded-lg px-3.5 py-2.5 border ${
              message.type === "success"
                ? "text-primary-dark bg-primary-light border-primary/20"
                : "text-danger bg-red-50 border-red-100"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-colors disabled:opacity-50 cursor-pointer"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
          >
            {loading ? "Submitting..." : "Confirm & Submit"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePreview} className="space-y-5">
      <div>
        <label htmlFor="yesterday" className="block text-sm font-medium text-foreground/80 mb-1.5">
          Yesterday
        </label>
        <textarea
          id="yesterday"
          required
          rows={3}
          value={yesterday}
          onChange={(e) => setYesterday(e.target.value)}
          placeholder="What did you work on yesterday?"
          className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all resize-none"
        />
      </div>

      <div>
        <label htmlFor="today" className="block text-sm font-medium text-foreground/80 mb-1.5">
          Today
        </label>
        <textarea
          id="today"
          required
          rows={3}
          value={today}
          onChange={(e) => setToday(e.target.value)}
          placeholder="What will you work on today?"
          className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all resize-none"
        />
      </div>

      <div>
        <label htmlFor="blockers" className="block text-sm font-medium text-foreground/80 mb-1.5">
          Blockers
        </label>
        <textarea
          id="blockers"
          rows={3}
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          placeholder="Any blockers? (optional)"
          className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none transition-all resize-none"
        />
      </div>

      {message.text && (
        <p
          className={`text-sm rounded-lg px-3.5 py-2.5 border ${
            message.type === "success"
              ? "text-primary-dark bg-primary-light border-primary/20"
              : "text-danger bg-red-50 border-red-100"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors shadow-md shadow-primary/20 cursor-pointer"
      >
        Preview Standup
      </button>
    </form>
  );
}
