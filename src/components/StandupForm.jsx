"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const MOODS = [
  { value: "great", emoji: "😊", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "struggling", emoji: "😟", label: "Struggling" },
  { value: "blocked", emoji: "😤", label: "Blocked" },
];

export default function StandupForm() {
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("");
  const [mood, setMood] = useState("good");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = (e) => {
    e.preventDefault();
    setPreviewing(true);
  };

  const handleBack = () => setPreviewing(false);

  const selectedMood = MOODS.find((m) => m.value === mood);

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
        body: JSON.stringify({ yesterday, today, blockers, mood }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit standup");
      }

      setMessage({ text: "Standup submitted successfully!", type: "success" });
      setYesterday("");
      setToday("");
      setBlockers("");
      setMood("good");
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
          <div className="rounded-xl bg-background border border-card-border p-4 flex items-center gap-3">
            <span className="text-2xl">{selectedMood?.emoji}</span>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                Mood
              </p>
              <p className="text-sm font-medium text-foreground">
                {selectedMood?.label}
              </p>
            </div>
          </div>

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
      {/* Mood Selector */}
      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-2">
          How are you feeling today?
        </label>
        <div className="flex gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                mood === m.value
                  ? "border-primary bg-primary-light text-primary-dark scale-105 shadow-sm"
                  : "border-card-border bg-card text-muted hover:bg-background"
              }`}
            >
              <span className="text-xl">{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

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
