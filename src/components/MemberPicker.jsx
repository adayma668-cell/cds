"use client";

import { useState, useEffect, useRef } from "react";

export default function MemberPicker({ value, onChange, members }) {
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

  const selected = members.find((m) => m.user_id === value);
  const displayLabel = selected ? selected.user_name || "Unknown" : "All Members";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3 text-left shadow-sm hover:border-accent/30 hover:shadow-md transition-all min-w-[200px]"
      >
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Select member</p>
          <p className="text-sm font-semibold text-foreground truncate">{displayLabel}</p>
        </div>
        <svg
          className={`w-5 h-5 text-muted ml-auto transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-[100] w-[280px] rounded-2xl border border-card-border bg-card shadow-xl overflow-hidden"
          style={{ animation: "fadeInScale 0.2s ease-out" }}
        >
          <div className="max-h-[300px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                value === "all"
                  ? "bg-accent-light/60 text-accent font-semibold"
                  : "text-foreground hover:bg-background"
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
              <span>All Members</span>
              {value === "all" && (
                <svg className="w-4 h-4 text-accent ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {members.length > 0 && (
              <div className="border-t border-card-border/50 mt-1 pt-1">
                {members.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => {
                      onChange(m.user_id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                      value === m.user_id
                        ? "bg-accent-light/60 text-accent font-semibold"
                        : "text-foreground hover:bg-background"
                    }`}
                  >
                    {m.user_avatar_url ? (
                      <img
                        src={m.user_avatar_url}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center text-xs font-bold text-accent shrink-0">
                        {(m.user_name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{m.user_name || "Unknown"}</p>
                      <p className={`text-xs truncate ${value === m.user_id ? "text-accent/70" : "text-muted"}`}>
                        {m.user_email}
                      </p>
                    </div>
                    {value === m.user_id && (
                      <svg className="w-4 h-4 text-accent ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {members.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted text-center">No members found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
