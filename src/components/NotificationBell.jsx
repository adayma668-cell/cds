"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ACTION_COLORS = {
  created: "bg-emerald-500",
  submitted: "bg-emerald-500",
  started: "bg-emerald-500",
  cast: "bg-emerald-500",
  updated: "bg-blue-500",
  status_changed: "bg-amber-500",
  phase_changed: "bg-amber-500",
  changed: "bg-amber-500",
  completed: "bg-purple-500",
  reopened: "bg-orange-500",
  finished: "bg-indigo-500",
  deleted: "bg-red-500",
  removed: "bg-red-500",
  cleared_all: "bg-red-500",
};

const ENTITY_LABELS = {
  standup: "Standup",
  meeting: "Meeting",
  retro_session: "Retro",
  retro_item: "Retro Item",
  retro_mood: "Retro Mood",
  retro_vote: "Retro Vote",
  user: "User",
};

function timeAgo(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildMessage(log) {
  const entity = ENTITY_LABELS[log.entity_type] || log.entity_type;
  const actor = log.actor_name || "Someone";
  const action = log.action.replace(/_/g, " ");

  if (log.entity_type === "meeting" && log.action === "completed") {
    const count = log.metadata?.memberCount;
    return `${actor} finished a standup meeting${count ? ` with ${count} members` : ""}`;
  }

  if (log.entity_type === "standup") {
    if (log.action === "submitted") return `${actor} submitted their standup`;
    if (log.action === "updated") return `${actor} updated their standup`;
  }

  if (log.entity_type === "retro_session") {
    if (log.action === "started") return `${actor} started a retrospective`;
    if (log.action === "finished") return `${actor} finished the retrospective`;
    if (log.action === "phase_changed") {
      const to = log.metadata?.to_phase;
      return `${actor} moved retro to phase ${to}`;
    }
  }

  return `${actor} ${action} a ${entity.toLowerCase()}`;
}

export default function NotificationBell({ collapsed }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const lastSeenRef = useRef(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/admin/audit?limit=15&page=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.logs) {
        setNotifications(data.logs);
        const lastSeen = lastSeenRef.current || localStorage.getItem("notif_last_seen");
        if (lastSeen) {
          const count = data.logs.filter(
            (l) => new Date(l.created_at) > new Date(lastSeen)
          ).length;
          setUnreadCount(count);
        } else {
          setUnreadCount(data.logs.length);
        }
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open) {
      const now = new Date().toISOString();
      lastSeenRef.current = now;
      localStorage.setItem("notif_last_seen", now);
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl text-muted hover:text-foreground hover:bg-background/80 transition-all duration-200 ${
          open ? "bg-background/80 text-foreground" : ""
        }`}
        title="Notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute z-[100] mt-2 bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 left-0 w-[calc(100vw-2rem)] sm:w-[360px]"
          style={{ maxHeight: 480 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border/60 bg-background/30">
            <h3 className="text-sm font-bold text-foreground">Notifications</h3>
            <span className="text-[11px] text-muted">
              {notifications.length} recent
            </span>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="relative w-6 h-6">
                  <div className="absolute inset-0 rounded-full border-2 border-card-border" />
                  <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <svg
                  className="w-8 h-8 mx-auto text-muted/40 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="text-xs text-muted">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-card-border/40">
                {notifications.map((log) => {
                  const isNew =
                    lastSeenRef.current &&
                    new Date(log.created_at) >
                      new Date(
                        localStorage.getItem("notif_last_seen_prev") || 0
                      );

                  return (
                    <div
                      key={log.id}
                      className="px-4 py-3 hover:bg-background/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                            ACTION_COLORS[log.action] || "bg-gray-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground leading-snug">
                            {buildMessage(log)}
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {timeAgo(log.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-card-border/60 bg-background/30">
            <Link
              href="/admin/audit"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
            >
              View All Activity
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
