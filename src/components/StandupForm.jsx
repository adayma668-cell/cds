"use client";

import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/context/AuthContext";

const STATUS_COLORS = {
  in_progress: "bg-blue-100/80 text-blue-700 border-blue-200/60",
  to_be_done: "bg-amber-100/80 text-amber-700 border-amber-200/60",
  closed: "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUS_LABELS = { in_progress: "In Progress", to_be_done: "To Do", closed: "Closed" };

const TYPE_BADGES = {
  "User Story": "bg-blue-50 text-blue-600",
  Task: "bg-yellow-50 text-yellow-700",
  Bug: "bg-red-50 text-red-600",
  Feature: "bg-purple-50 text-purple-600",
  Epic: "bg-orange-50 text-orange-600",
  Requirement: "bg-teal-50 text-teal-600",
};

function mapAzureState(state) {
  const s = (state || "").toLowerCase();
  if (["new", "to do", "approved", "new / backlog", "parking lot", "parking lot / future use"].includes(s)) return "to_be_done";
  if (["active", "in progress", "committed", "resolved"].includes(s)) return "in_progress";
  if (["closed", "done", "removed", "rejected", "accepted / done"].includes(s)) return "closed";
  return "to_be_done";
}

const SECTION_META = {
  Yesterday: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accentBg: "bg-violet-500",
    accentText: "text-violet-600",
    accentLight: "bg-violet-50",
    accentBorder: "border-violet-100",
    ringColor: "ring-violet-500/20",
    step: "1",
    subtitle: "What did you accomplish?",
  },
  Today: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    accentBg: "bg-primary",
    accentText: "text-primary-dark",
    accentLight: "bg-primary-light",
    accentBorder: "border-primary/15",
    ringColor: "ring-primary/20",
    step: "2",
    subtitle: "What will you work on?",
  },
  Blockers: {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    accentBg: "bg-orange-500",
    accentText: "text-orange-600",
    accentLight: "bg-orange-50",
    accentBorder: "border-orange-100",
    ringColor: "ring-orange-500/20",
    step: "3",
    subtitle: "Anything blocking progress?",
  },
};

const TicketsCtx = createContext({ tickets: [], activeTickets: [] });

function TicketSelect({ value, usedIds, onChange, containerRef, includeClosed }) {
  const { activeTickets, tickets: allTickets } = useContext(TicketsCtx);
  const pool = includeClosed ? allTickets : activeTickets;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsedBoards, setCollapsedBoards] = useState({});
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const inputRef = useRef(null);
  const [dropUp, setDropUp] = useState(false);

  const ticket = value ? pool.find((t) => t.id === value) : null;

  useEffect(() => {
    if (!open) return;
    function onClickOut(e) {
      if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const openDrop = () => {
    const tr = triggerRef.current;
    if (!tr) return;
    const r = tr.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const dropH = 340;
    setDropUp(spaceBelow < dropH && r.top > spaceBelow);
    setOpen(true);
  };

  const available = pool.filter(
    (t) => !usedIds.includes(t.id) && t.id !== value &&
      (t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
        (t.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (t._project || "").toLowerCase().includes(search.toLowerCase()))
  );

  const dropdown = open && (
    <div
      ref={dropRef}
      className={`absolute left-0 right-0 z-[100] rounded-xl border border-card-border/80 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden standup-dropdown-in ${dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
      style={{ minWidth: 320 }}
    >
      <div className="px-3 py-2.5 border-b border-card-border/40 bg-gray-50/50">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket #, title, or board..."
            className="w-full rounded-lg border border-card-border/60 bg-white pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted/35"
          />
        </div>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {available.length === 0 ? (
          <div className="text-center py-6 px-4">
            <svg className="w-8 h-8 text-muted/20 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-muted/50 font-medium">
              {search ? "No matching tickets" : "No tickets available"}
            </p>
          </div>
        ) : (
          (() => {
            const grouped = {};
            available.forEach((t) => {
              const board = t._project || "Other";
              if (!grouped[board]) grouped[board] = [];
              grouped[board].push(t);
            });
            const boards = Object.keys(grouped);
            const showHeaders = boards.length > 1 || (boards.length === 1 && boards[0] !== "Other");
            const toggleBoard = (board) => setCollapsedBoards((prev) => ({ ...prev, [board]: !prev[board] }));
            const isSearching = search.trim().length > 0;
            return boards.map((board) => {
              const isCollapsed = !isSearching && collapsedBoards[board];
              const items = grouped[board];
              return (
                <div key={board}>
                  {showHeaders && (
                    <button
                      type="button"
                      onClick={() => toggleBoard(board)}
                      className="sticky top-0 z-10 w-full px-3 py-2 bg-gray-50/95 backdrop-blur-sm border-b border-card-border/30 cursor-pointer hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-wider">{board}</span>
                          <span className="text-[10px] font-medium text-muted/40 ml-0.5">({items.length})</span>
                        </div>
                        <svg
                          className={`w-3.5 h-3.5 text-muted/40 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                  )}
                  {!isCollapsed && items.map((t) => {
                    const displayTitle = t.title || t.description?.split("\n")[0]?.slice(0, 60) || "";
                    const typeBadge = TYPE_BADGES[t._type] || "";
                    const devopsUrl = t._project
                      ? `https://dev.azure.com/${process.env.NEXT_PUBLIC_AZURE_DEVOPS_ORG || "xLMValiMation"}/${encodeURIComponent(t._project)}/_workitems/edit/${t.ticket_number}`
                      : null;
                    return (
                      <div
                        key={t.id}
                        className="flex items-start gap-0 border-b border-card-border/15 last:border-0 group hover:bg-primary-light/40 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => { onChange(t.id); setOpen(false); setSearch(""); }}
                          className="flex-1 px-3 py-2.5 text-left flex items-start gap-3 cursor-pointer min-w-0"
                        >
                          <span className="text-xs font-bold text-accent bg-accent-light px-2 py-0.5 rounded-md shrink-0 mt-0.5 group-hover:bg-accent/10 transition-colors">#{t.ticket_number}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug truncate ${displayTitle ? "text-foreground/80" : "text-muted/40 italic"}`}>
                              {displayTitle || "Untitled"}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {t._type && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeBadge || "bg-gray-50 text-gray-600"}`}>
                                  {t._type}
                                </span>
                              )}
                              <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[t.status] || STATUS_COLORS.to_be_done}`}>
                                {t._state || STATUS_LABELS[t.status] || t.status}
                              </span>
                            </div>
                          </div>
                        </button>
                        {devopsUrl && (
                          <a
                            href={devopsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in Azure DevOps"
                            className="shrink-0 px-2.5 py-3 flex items-center justify-center text-muted/30 hover:text-blue-600 hover:bg-blue-50/60 transition-colors rounded-r-lg cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );

  if (ticket) {
    const chipTitle = ticket.title || ticket.description?.split("\n")[0]?.slice(0, 60) || "";
    return (
      <div className="relative" ref={triggerRef}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-accent-light/60 via-accent-light/40 to-primary-light/30 border border-accent/10">
          <button
            type="button"
            onClick={openDrop}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <span className="text-sm font-bold text-accent bg-white/80 px-2 py-0.5 rounded-md shadow-sm shrink-0">#{ticket.ticket_number}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[ticket.status] || STATUS_COLORS.to_be_done}`}>
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
            {chipTitle && <span className="text-sm text-foreground/70 truncate">{chipTitle}</span>}
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted/40 hover:text-danger hover:bg-red-50 transition-all cursor-pointer shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {dropdown}
      </div>
    );
  }

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={openDrop}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-card-border/80 text-xs font-medium text-muted/60 hover:border-primary/40 hover:text-primary hover:bg-primary-light/20 hover:shadow-sm transition-all cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Link ticket
      </button>
      {dropdown}
    </div>
  );
}

const BULLET = "• ";

function ensureFirstBullet(text) {
  if (!text) return BULLET;
  if (!text.startsWith(BULLET)) return BULLET + text;
  return text;
}

function BulletTextarea({ value, onChange, placeholder, autoResizeDep }) {
  const ref = useRef(null);

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 40) + "px";
  }, []);

  useEffect(() => { autoResize(); }, [value, autoResize, autoResizeDep]);

  const handleFocus = () => {
    if (!value) onChange(BULLET);
  };

  const handleBlur = () => {
    if (value === BULLET || value.trim() === "•") onChange("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const el = ref.current;
      const pos = el.selectionStart;
      const before = value.slice(0, pos);
      const after = value.slice(pos);
      const newValue = before + "\n" + BULLET + after;
      onChange(newValue);
      requestAnimationFrame(() => {
        const newPos = pos + 1 + BULLET.length;
        el.selectionStart = newPos;
        el.selectionEnd = newPos;
        autoResize();
      });
      return;
    }

    if (e.key === "Backspace") {
      const el = ref.current;
      const pos = el.selectionStart;
      const selEnd = el.selectionEnd;
      if (pos !== selEnd) return;

      const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
      const lineText = value.slice(lineStart, pos);

      if (lineText === BULLET && lineStart > 0) {
        e.preventDefault();
        const newValue = value.slice(0, lineStart - 1) + value.slice(pos);
        onChange(newValue);
        requestAnimationFrame(() => {
          const newPos = lineStart - 1;
          el.selectionStart = newPos;
          el.selectionEnd = newPos;
          autoResize();
        });
        return;
      }

      if (lineText === BULLET && lineStart === 0) {
        e.preventDefault();
        return;
      }
    }
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    autoResize();
  };

  const lines = (value || "").split("\n");
  const hasBullets = lines.some((l) => l.startsWith(BULLET));

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      placeholder={placeholder}
      className={`w-full border-0 bg-transparent px-0 py-1.5 text-[15px] leading-[1.85] outline-none resize-none text-foreground placeholder:text-muted/30 ${hasBullets ? "standup-bullet-text" : ""}`}
    />
  );
}

function TaskEntry({ entry, index, onUpdate, onRemove, canRemove, usedIds, descPlaceholder, showTickets, isLast, includeClosed }) {
  const cardRef = useRef(null);

  return (
    <div ref={cardRef} className="group relative standup-entry-in">
      <div className="rounded-xl border border-card-border/50 bg-white/80 hover:bg-white hover:border-card-border/80 hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-200">
        {showTickets && entry.ticketId && (
          <div className="px-3 pt-3">
            <TicketSelect
              value={entry.ticketId}
              usedIds={usedIds}
              onChange={(id) => onUpdate(index, { ticketId: id })}
              containerRef={cardRef}
              includeClosed={includeClosed}
            />
          </div>
        )}
        <div className="px-3 pt-2 pb-1">
          <BulletTextarea
            value={entry.description}
            onChange={(val) => onUpdate(index, { description: val })}
            placeholder={descPlaceholder}
          />
        </div>
        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-1.5">
            {showTickets && !entry.ticketId && (
              <TicketSelect
                value={entry.ticketId}
                usedIds={usedIds}
                onChange={(id) => onUpdate(index, { ticketId: id })}
                containerRef={cardRef}
                includeClosed={includeClosed}
              />
            )}
          </div>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted/30 hover:text-danger hover:bg-red-50/80 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, entries, setEntries, descPlaceholder, showTickets, includeClosed, onRestore, restoring }) {
  const meta = SECTION_META[label] || SECTION_META.Today;
  const usedIds = entries.map((e) => e.ticketId).filter(Boolean);
  const update = (i, p) => setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, ...p } : e));
  const remove = (i) => setEntries((prev) => prev.filter((_, idx) => idx !== i));
  const add = () => setEntries((prev) => [...prev, { ticketId: "", description: "" }]);

  // Section wrappers use transform animations (globals.css), which create stacking contexts.
  // Without explicit z-order, a later section (e.g. Today) paints over an earlier one, so ticket
  // dropdowns from Yesterday sit underneath the next section. Earlier sections get higher z-index.
  const sectionStack =
    label === "Yesterday" ? "relative z-[30]" : label === "Today" ? "relative z-[20]" : "relative z-[10]";

  return (
    <div className={`standup-section-in ${sectionStack}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg ${meta.accentBg} flex items-center justify-center text-white shrink-0 shadow-sm`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-foreground leading-tight">{label}</h3>
              <p className="text-xs text-muted/50 mt-0.5">{meta.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {onRestore && (
                <button
                  type="button"
                  onClick={onRestore}
                  disabled={restoring}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200/60 hover:bg-violet-100/60 hover:border-violet-300/60 hover:shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {restoring ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Restoring...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Restore
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={add}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${meta.accentText} ${meta.accentLight} border ${meta.accentBorder} hover:shadow-sm transition-all cursor-pointer`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add entry
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2 ml-11">
        {entries.map((entry, i) => (
          <TaskEntry
            key={i}
            entry={entry}
            index={i}
            onUpdate={update}
            onRemove={remove}
            canRemove={entries.length > 1}
            usedIds={usedIds}
            descPlaceholder={descPlaceholder}
            showTickets={showTickets}
            isLast={i === entries.length - 1}
            includeClosed={includeClosed}
          />
        ))}
      </div>
    </div>
  );
}

const DRAFT_KEY_PREFIX = "standup-form-draft";

function getDraftKey(userId) {
  return userId ? `${DRAFT_KEY_PREFIX}-${userId}` : null;
}

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadDraft(userId) {
  const key = getDraftKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.date && parsed.date !== getTodayDateString()) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(userId, yesterday, today, blockers) {
  const key = getDraftKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ yesterday, today, blockers, date: getTodayDateString() }));
  } catch { /* quota exceeded – ignore */ }
}

function clearDraft(userId) {
  const key = getDraftKey(userId);
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function clearAllDrafts() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DRAFT_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

export { clearAllDrafts };

const defaultEntry = () => [{ ticketId: "", description: "" }];

export default function StandupForm({ onSubmitted, initialData }) {
  const { user } = useAuthContext();
  const userId = user?.id;
  const [yesterdayEntries, setYesterdayEntries] = useState(defaultEntry);
  const [todayEntries, setTodayEntries] = useState(defaultEntry);
  const [blockerEntries, setBlockerEntries] = useState(defaultEntry);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try { sessionStorage.removeItem("standup-form-draft"); } catch { /* ignore */ }
    try { sessionStorage.removeItem(`standup-form-draft-${userId}`); } catch { /* ignore */ }

    if (initialData) {
      setYesterdayEntries(initialData.yesterday || defaultEntry());
      setTodayEntries(initialData.today || defaultEntry());
      setBlockerEntries(initialData.blockers || defaultEntry());
      setDraftLoaded(true);
      return;
    }

    const draft = loadDraft(userId);
    if (draft) {
      setYesterdayEntries(draft.yesterday || defaultEntry());
      setTodayEntries(draft.today || defaultEntry());
      setBlockerEntries(draft.blockers || defaultEntry());
    }
    setDraftLoaded(true);
  }, [userId, initialData]);

  useEffect(() => {
    if (!draftLoaded || !userId) return;
    saveDraft(userId, yesterdayEntries, todayEntries, blockerEntries);
  }, [yesterdayEntries, todayEntries, blockerEntries, draftLoaded, userId]);

  useEffect(() => {
    async function fetchWorkItems() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/azure-devops/work-items", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const { workItems } = await res.json();
        const mapped = (workItems || []).map((wi) => ({
          id: String(wi.id),
          ticket_number: String(wi.id),
          title: wi.title || "",
          status: mapAzureState(wi.state),
          description: "",
          _type: wi.type,
          _state: wi.state,
          _project: wi.project,
        }));
        setTickets(mapped);
      } catch { /* silent */ } finally { setTicketsLoading(false); }
    }
    fetchWorkItems();
  }, []);

  const activeTickets = tickets.filter((t) => t.status !== "closed");
  const showTickets = !ticketsLoading && tickets.length > 0;

  const handleRestore = async () => {
    setRestoring(true);
    setMessage({ text: "", type: "" });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch("/api/standup?scope=mine&before=today&limit=1", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch previous standup");
      const { standups } = await res.json();
      if (!standups || standups.length === 0) {
        setMessage({ text: "No previous standup found to restore from", type: "error" });
        return;
      }
      const prev = standups[0];
      const todayText = prev.today || "";
      const todayTickets = prev.today_tickets || [];

      const appendToYesterday = (newEntries) => {
        setYesterdayEntries((prev) => {
          const existing = prev.filter((e) => e.ticketId || stripBullets(e.description));
          return existing.length > 0 ? [...existing, ...newEntries] : newEntries;
        });
      };

      if (todayTickets.length > 0) {
        const entries = todayTickets.map((t) => ({
          ticketId: t.ticket_id || "",
          description: t.description || "",
        }));
        if (entries.length === 0) entries.push({ ticketId: "", description: "" });
        appendToYesterday(entries);
      } else if (todayText.trim()) {
        const blocks = todayText.split("\n\n").filter(Boolean);
        const entries = blocks.map((block) => {
          const ticketMatch = block.match(/^\[#(\d+)\]\s*/);
          const desc = ticketMatch ? block.replace(ticketMatch[0], "") : block;
          const bulletLines = desc.split("\n").map((line) =>
            line.startsWith(BULLET) ? line : BULLET + line
          ).join("\n");
          return { ticketId: "", description: bulletLines };
        });
        if (entries.length === 0) entries.push({ ticketId: "", description: "" });
        appendToYesterday(entries);
      } else {
        setMessage({ text: "Previous standup had no 'Today' content to restore", type: "error" });
        return;
      }
      setRestored(true);
      setMessage({ text: `Added entries from your standup on ${prev.standup_date}. Feel free to edit.`, type: "success" });
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setRestoring(false);
    }
  };

  const stripBullets = (text) =>
    text.replace(/^• /gm, "").trim();

  const buildText = (entries) =>
    entries.map((e) => {
      const t = e.ticketId ? tickets.find((tk) => tk.id === e.ticketId) : null;
      const desc = stripBullets(e.description);
      return `${t ? `[#${t.ticket_number}] ` : ""}${desc}`.trim();
    }).filter(Boolean).join("\n\n");

  const buildTicketData = (entries) =>
    entries.filter((e) => e.ticketId || stripBullets(e.description)).map((e) => {
      const t = e.ticketId ? tickets.find((tk) => tk.id === e.ticketId) : null;
      return {
        ticket_id: e.ticketId || null,
        ticket_number: t?.ticket_number || null,
        title: t?.title || null,
        description: e.description,
      };
    });

  const hasContent = (entries) => entries.some((e) => stripBullets(e.description).length > 0 || e.ticketId);

  const filledSections = [hasContent(yesterdayEntries), hasContent(todayEntries), hasContent(blockerEntries)].filter(Boolean).length;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!hasContent(yesterdayEntries)) {
      setMessage({ text: "Please add at least one update for Yesterday", type: "error" }); return;
    }
    if (!hasContent(todayEntries)) {
      setMessage({ text: "Please add at least one update for Today", type: "error" }); return;
    }
    setMessage({ text: "", type: "" });
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/standup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          yesterday: buildText(yesterdayEntries), today: buildText(todayEntries), blockers: buildText(blockerEntries),
          yesterday_tickets: buildTicketData(yesterdayEntries), today_tickets: buildTicketData(todayEntries), blocker_tickets: buildTicketData(blockerEntries),
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to submit standup"); }
      clearDraft(userId);
      if (onSubmitted) {
        onSubmitted({
          yesterday: buildText(yesterdayEntries), today: buildText(todayEntries), blockers: buildText(blockerEntries),
          yesterday_tickets: buildTicketData(yesterdayEntries), today_tickets: buildTicketData(todayEntries), blocker_tickets: buildTicketData(blockerEntries),
          _ticketMap: Object.fromEntries(tickets.map((t) => [t.id, t])),
        });
        return;
      }
      setMessage({ text: "Standup submitted successfully!", type: "success" });
      setYesterdayEntries(defaultEntry());
      setTodayEntries(defaultEntry());
      setBlockerEntries(defaultEntry());
    } catch (err) { setMessage({ text: err.message, type: "error" }); }
    finally { setLoading(false); }
  };

  const ctxValue = { tickets, activeTickets };

  return (
    <TicketsCtx.Provider value={ctxValue}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 pb-1">
          <div className="flex items-center gap-1.5 text-xs text-muted/50">
            <span className={`w-2 h-2 rounded-full transition-colors ${hasContent(yesterdayEntries) ? "bg-violet-500" : "bg-card-border"}`} />
            <span className={`w-2 h-2 rounded-full transition-colors ${hasContent(todayEntries) ? "bg-primary" : "bg-card-border"}`} />
            <span className={`w-2 h-2 rounded-full transition-colors ${hasContent(blockerEntries) ? "bg-orange-500" : "bg-card-border"}`} />
          </div>
          <span className="text-xs text-muted/40 font-medium">{filledSections}/3 sections filled</span>
        </div>

        <Section label="Yesterday" entries={yesterdayEntries} setEntries={setYesterdayEntries}
          descPlaceholder="What did you accomplish yesterday?" showTickets={showTickets} includeClosed
          onRestore={!restored ? handleRestore : undefined} restoring={restoring} />

        <div className="border-t border-card-border/30" />

        <Section label="Today" entries={todayEntries} setEntries={setTodayEntries}
          descPlaceholder="What are you planning to work on?" showTickets={showTickets} includeClosed />

        <div className="border-t border-card-border/30" />

        <Section label="Blockers" entries={blockerEntries} setEntries={setBlockerEntries}
          descPlaceholder="Any impediments or blockers? (optional)" showTickets={showTickets} includeClosed />

        {message.text && (
          <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 border ${message.type === "success" ? "text-primary-dark bg-primary-light border-primary/20" : "text-danger bg-red-50 border-red-100"}`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {message.type === "success" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            {message.text}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="btn-press btn-shimmer w-full rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white py-3.5 text-sm font-bold transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 cursor-pointer">
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Submit Standup
              </>
            )}
          </span>
        </button>
      </form>
    </TicketsCtx.Provider>
  );
}
