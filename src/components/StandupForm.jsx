"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

const STATUS_COLORS = {
  in_progress: "bg-blue-50 text-blue-600 border-blue-200",
  to_be_done: "bg-amber-50 text-amber-600 border-amber-200",
  closed: "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUS_LABELS = { in_progress: "In Progress", to_be_done: "To Do", closed: "Closed" };

const TicketsCtx = createContext({ tickets: [], activeTickets: [] });

function TicketSelect({ value, usedIds, onChange, containerRef }) {
  const { activeTickets } = useContext(TicketsCtx);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const inputRef = useRef(null);
  const [pos, setPos] = useState(null);

  const ticket = value ? activeTickets.find((t) => t.id === value) : null;

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
    const anchor = containerRef?.current || triggerRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const tr = triggerRef.current?.getBoundingClientRect();
    const spaceBelow = window.innerHeight - (tr?.bottom || r.bottom);
    const dropH = 240;
    const goUp = spaceBelow < dropH && (tr?.top || r.top) > spaceBelow;
    setPos({
      top: goUp ? undefined : (tr?.bottom || r.bottom) + 4,
      bottom: goUp ? window.innerHeight - (tr?.top || r.top) + 4 : undefined,
      left: r.left,
      width: r.width,
    });
    setOpen(true);
  };

  const available = activeTickets.filter(
    (t) => !usedIds.includes(t.id) && t.id !== value &&
      (t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
        (t.title || "").toLowerCase().includes(search.toLowerCase()))
  );

  const dropdown = open && pos && createPortal(
    <div
      ref={dropRef}
      className="fixed z-[9999] rounded-lg border border-card-border bg-card shadow-2xl overflow-hidden"
      style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width }}
    >
      <div className="px-2 py-1.5 border-b border-card-border/50">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tickets..."
          className="w-full rounded-md border border-card-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/40"
        />
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {available.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">
            {search ? "No matches" : "No tickets available"}
          </p>
        ) : (
          available.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onChange(t.id); setOpen(false); setSearch(""); }}
              className="w-full px-2.5 py-2 text-left flex items-center gap-2 hover:bg-primary-light/30 transition-colors cursor-pointer border-b border-card-border/20 last:border-0"
            >
              <span className="text-[11px] font-bold text-accent shrink-0">{t.ticket_number}</span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[t.status] || STATUS_COLORS.to_be_done}`}>
                {STATUS_LABELS[t.status] || t.status}
              </span>
              {t.title && <span className="text-xs text-foreground/60 truncate">{t.title}</span>}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );

  if (ticket) {
    return (
      <>
        <div ref={triggerRef} className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={openDrop}
            className="flex items-center gap-1.5 min-w-0 px-2 py-1 rounded-md bg-primary-light/40 border border-primary/15 hover:border-primary/30 transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-bold text-primary-dark shrink-0">{ticket.ticket_number}</span>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[ticket.status] || STATUS_COLORS.to_be_done}`}>
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
            {ticket.title && <span className="text-[11px] text-foreground/60 truncate">{ticket.title}</span>}
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            className="w-5 h-5 rounded flex items-center justify-center text-muted/40 hover:text-danger hover:bg-red-50/80 transition-colors cursor-pointer shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {dropdown}
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDrop}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-card-border text-[11px] text-muted/50 hover:border-primary/30 hover:text-primary/60 hover:bg-primary-light/10 transition-all cursor-pointer"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
        Link task
      </button>
      {dropdown}
    </>
  );
}

function TaskEntry({ entry, index, onUpdate, onRemove, canRemove, usedIds, descPlaceholder, showTickets }) {
  const cardRef = useRef(null);
  return (
    <div ref={cardRef} className="group relative rounded-lg border border-card-border/60 bg-card">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        {showTickets && (
          <TicketSelect
            value={entry.ticketId}
            usedIds={usedIds}
            onChange={(id) => onUpdate(index, { ticketId: id })}
            containerRef={cardRef}
          />
        )}
        <div className="flex-1" />
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="w-5 h-5 rounded flex items-center justify-center text-muted/30 hover:text-danger hover:bg-red-50/80 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      <div className="px-3 pb-2.5">
        <textarea
          rows={2}
          value={entry.description}
          onChange={(e) => onUpdate(index, { description: e.target.value })}
          placeholder={descPlaceholder}
          className="w-full rounded-md border-0 bg-transparent px-0 py-1 text-sm outline-none resize-none text-foreground placeholder:text-muted/40"
        />
      </div>
    </div>
  );
}

function Section({ label, entries, setEntries, descPlaceholder, showTickets }) {
  const usedIds = entries.map((e) => e.ticketId).filter(Boolean);
  const update = (i, p) => setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, ...p } : e));
  const remove = (i) => setEntries((prev) => prev.filter((_, idx) => idx !== i));
  const add = () => setEntries((prev) => [...prev, { ticketId: "", description: "" }]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-foreground">{label}</label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-primary/70 hover:text-primary hover:bg-primary-light/30 transition-all cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>
      <div className="space-y-2">
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
          />
        ))}
      </div>
    </div>
  );
}

function PreviewEntry({ ticket, description, badgeBg, badgeText, borderColor }) {
  return (
    <div className={`rounded-lg bg-white/60 border ${borderColor} px-3 py-2`}>
      {ticket && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[11px] font-bold ${badgeText} ${badgeBg} px-1.5 py-0.5 rounded`}>{ticket.ticket_number}</span>
          {ticket.title && <span className="text-xs text-foreground/60">{ticket.title}</span>}
        </div>
      )}
      {description && (
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{description}</p>
      )}
    </div>
  );
}

const DRAFT_KEY = "standup-form-draft";

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft(yesterday, today, blockers) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ yesterday, today, blockers }));
  } catch { /* quota exceeded – ignore */ }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

const defaultEntry = () => [{ ticketId: "", description: "" }];

export default function StandupForm({ onSubmitted }) {
  const [yesterdayEntries, setYesterdayEntries] = useState(() => loadDraft()?.yesterday || defaultEntry());
  const [todayEntries, setTodayEntries] = useState(() => loadDraft()?.today || defaultEntry());
  const [blockerEntries, setBlockerEntries] = useState(() => loadDraft()?.blockers || defaultEntry());
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    saveDraft(yesterdayEntries, todayEntries, blockerEntries);
  }, [yesterdayEntries, todayEntries, blockerEntries]);

  useEffect(() => {
    async function fetchTickets() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/tickets", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const { tickets: data } = await res.json();
        setTickets(data || []);
      } catch { /* silent */ } finally { setTicketsLoading(false); }
    }
    fetchTickets();
  }, []);

  const activeTickets = tickets.filter((t) => t.status !== "closed");
  const showTickets = !ticketsLoading && activeTickets.length > 0;

  const buildText = (entries) =>
    entries.map((e) => {
      const t = e.ticketId ? tickets.find((tk) => tk.id === e.ticketId) : null;
      return `${t ? `[${t.ticket_number}] ` : ""}${e.description}`.trim();
    }).filter(Boolean).join("\n\n");

  const buildTicketData = (entries) =>
    entries.filter((e) => e.ticketId).map((e) => ({ ticket_id: e.ticketId, description: e.description }));

  const hasContent = (entries) => entries.some((e) => e.description.trim() || e.ticketId);

  const handlePreview = (e) => {
    e.preventDefault();
    if (!hasContent(yesterdayEntries)) {
      setMessage({ text: "Please add at least one update for Yesterday", type: "error" }); return;
    }
    if (!hasContent(todayEntries)) {
      setMessage({ text: "Please add at least one update for Today", type: "error" }); return;
    }
    setMessage({ text: "", type: "" });
    setPreviewing(true);
  };

  const handleSubmit = async () => {
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
      clearDraft();
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
      setPreviewing(false);
    } catch (err) { setMessage({ text: err.message, type: "error" }); }
    finally { setLoading(false); }
  };

  const ctxValue = { tickets, activeTickets };

  if (previewing) {
    const resolve = (entries) =>
      entries.filter((e) => e.description.trim() || e.ticketId).map((e) => ({
        ticket: e.ticketId ? tickets.find((t) => t.id === e.ticketId) : null,
        description: e.description,
      }));
    const yItems = resolve(yesterdayEntries);
    const tItems = resolve(todayEntries);
    const bItems = resolve(blockerEntries);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-light flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wide">Preview</h2>
        </div>

        <div className="space-y-2.5">
          <div className="rounded-xl bg-primary-light/40 border border-primary/10 p-3">
            <p className="text-[11px] font-semibold text-primary-dark uppercase tracking-wide mb-1.5">Yesterday</p>
            <div className="space-y-1.5">
              {yItems.map((item, i) => (
                <PreviewEntry key={i} ticket={item.ticket} description={item.description} badgeBg="bg-primary-light" badgeText="text-primary-dark" borderColor="border-primary/10" />
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-accent-light/40 border border-accent/10 p-3">
            <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-1.5">Today</p>
            <div className="space-y-1.5">
              {tItems.map((item, i) => (
                <PreviewEntry key={i} ticket={item.ticket} description={item.description} badgeBg="bg-accent-light" badgeText="text-accent" borderColor="border-accent/10" />
              ))}
            </div>
          </div>

          {bItems.length > 0 && (
            <div className="rounded-xl bg-red-50/40 border border-red-100 p-3">
              <p className="text-[11px] font-semibold text-danger uppercase tracking-wide mb-1.5">Blockers</p>
              <div className="space-y-1.5">
                {bItems.map((item, i) => (
                  <PreviewEntry key={i} ticket={item.ticket} description={item.description} badgeBg="bg-red-50" badgeText="text-danger" borderColor="border-red-100" />
                ))}
              </div>
            </div>
          )}
        </div>

        {message.text && (
          <p className={`text-sm rounded-lg px-3 py-2 border ${message.type === "success" ? "text-primary-dark bg-primary-light border-primary/20" : "text-danger bg-red-50 border-red-100"}`}>
            {message.text}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setPreviewing(false)} disabled={loading}
            className="flex-1 rounded-lg border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-colors disabled:opacity-50 cursor-pointer">
            Edit
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="btn-press flex-1 rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer">
            {loading ? "Submitting..." : "Confirm & Submit"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <TicketsCtx.Provider value={ctxValue}>
      <form onSubmit={handlePreview} className="space-y-5">
        <Section label="Yesterday" entries={yesterdayEntries} setEntries={setYesterdayEntries}
          descPlaceholder="What did you do?" showTickets={showTickets} />

        <Section label="Today" entries={todayEntries} setEntries={setTodayEntries}
          descPlaceholder="What will you do?" showTickets={showTickets} />

        <Section label="Blockers" entries={blockerEntries} setEntries={setBlockerEntries}
          descPlaceholder="Any blockers? (optional)" showTickets={showTickets} />

        {message.text && (
          <p className={`text-sm rounded-lg px-3 py-2 border ${message.type === "success" ? "text-primary-dark bg-primary-light border-primary/20" : "text-danger bg-red-50 border-red-100"}`}>
            {message.text}
          </p>
        )}

        <button type="submit"
          className="btn-press w-full rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-primary-dark transition-all shadow-md shadow-primary/20 cursor-pointer">
          Preview Standup
        </button>
      </form>
    </TicketsCtx.Provider>
  );
}
