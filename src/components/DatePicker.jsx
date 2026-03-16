"use client";

import { useState, useEffect, useRef } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value + "T12:00:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
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

  // Use local date components—toISOString() would convert to UTC and shift the day in some timezones
  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const today = toYMD(new Date());
  const selected = value || today;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1));

  const rows = [];
  let row = [];
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrevMonth - firstDay + i + 1;
    const dateStr = toYMD(new Date(year, month - 1, d));
    row.push(
      <button
        key={`prev-${i}`}
        type="button"
        onClick={() => { onChange(dateStr); setOpen(false); }}
        className="w-9 h-9 rounded-lg text-sm text-muted/60 hover:bg-accent-light/50 hover:text-accent transition-colors"
      >
        {d}
      </button>
    );
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toYMD(new Date(year, month, d));
    const isToday = dateStr === today;
    const isSelected = dateStr === selected;
    row.push(
      <button
        key={d}
        type="button"
        onClick={() => { onChange(dateStr); setOpen(false); }}
        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
          isSelected
            ? "bg-accent text-white shadow-md"
            : isToday
            ? "bg-primary-light text-primary-dark border border-primary/30"
            : "text-foreground hover:bg-accent-light/60 hover:text-accent"
        }`}
      >
        {d}
      </button>
    );
    if (row.length === 7) {
      rows.push(<div key={rows.length} className="grid grid-cols-7 gap-1">{row}</div>);
      row = [];
    }
  }
  let nextD = 1;
  while (row.length < 7) {
    const dateStr = toYMD(new Date(year, month + 1, nextD));
    row.push(
      <button
        key={`next-${nextD}`}
        type="button"
        onClick={() => { onChange(dateStr); setOpen(false); }}
        className="w-9 h-9 rounded-lg text-sm text-muted/60 hover:bg-accent-light/50 hover:text-accent transition-colors"
      >
        {nextD}
      </button>
    );
    nextD++;
  }
  rows.push(<div key={rows.length} className="grid grid-cols-7 gap-1">{row}</div>);

  const displayLabel = selected === today
    ? "Today"
    : new Date(selected + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3 text-left shadow-sm hover:border-accent/30 hover:shadow-md transition-all min-w-[200px]"
      >
        <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center">
          <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Select date</p>
          <p className="text-sm font-semibold text-foreground">{displayLabel}</p>
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
        <div className="absolute top-full left-0 mt-2 z-[100] w-[280px] rounded-2xl border border-card-border bg-card shadow-xl overflow-hidden" style={{ animation: "fadeInScale 0.2s ease-out" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-accent-light/30">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-accent">
                {MONTHS[month]} {year}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="w-8 h-8 rounded-lg hover:bg-accent-light flex items-center justify-center text-accent transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-8 h-8 rounded-lg hover:bg-accent-light flex items-center justify-center text-accent transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="px-3 pt-3 pb-1">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <span key={w} className="w-9 h-6 flex items-center justify-center text-[10px] font-bold text-muted uppercase">
                  {w}
                </span>
              ))}
            </div>
          </div>

          {/* Days grid */}
          <div className="px-3 pb-3 space-y-1">
            {rows}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-card-border bg-background/50 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { onChange(today); setOpen(false); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-accent hover:bg-accent-light transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
