"use client";

import { useState, useEffect, useRef } from "react";
import { TEAMS } from "@/lib/teams";

export default function TeamPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const allOptions = [{ id: "all", label: "All Teams" }, ...TEAMS];
  const selected = allOptions.find((t) => t.id === value) || allOptions[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3 text-left shadow-sm hover:border-accent/30 hover:shadow-md transition-all min-w-[200px]"
      >
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Select team</p>
          <p className="text-sm font-semibold text-foreground">{selected.label}</p>
        </div>
        <svg
          className={`w-5 h-5 text-muted ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-[100] w-[240px] rounded-2xl border border-card-border bg-card shadow-xl overflow-hidden"
          style={{ animation: "fadeInScale 0.2s ease-out" }}
        >
          <div className="py-1">
            {allOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                  value === option.id
                    ? "bg-accent-light/60 text-accent font-semibold"
                    : "text-foreground hover:bg-background"
                }`}
              >
                {option.id !== "all" && (
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${option.color?.split(" ")[0] || "bg-gray-200"}`} />
                )}
                {option.label}
                {value === option.id && (
                  <svg className="w-4 h-4 text-accent ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
