"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const TYPE_BADGES = {
  "User Story": { bg: "bg-blue-100", text: "text-blue-700", label: "Story" },
  Task: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Task" },
  Bug: { bg: "bg-red-100", text: "text-red-700", label: "Bug" },
  Feature: { bg: "bg-purple-100", text: "text-purple-700", label: "Feature" },
  Epic: { bg: "bg-orange-100", text: "text-orange-700", label: "Epic" },
};

const STATE_COLORS = {
  New: "text-slate-500",
  Active: "text-blue-600",
  Resolved: "text-green-600",
  Closed: "text-green-700",
  "In Progress": "text-blue-600",
  Done: "text-green-700",
};

function mapAzureStateToStatus(state) {
  const s = state?.toLowerCase() || "";
  if (["new", "to do", "approved"].includes(s)) return "to_be_done";
  if (["active", "in progress", "committed", "resolved"].includes(s)) return "in_progress";
  if (["closed", "done", "removed"].includes(s)) return "closed";
  return "to_be_done";
}

export default function AzureWorkItemPicker({ onSelect, disabled }) {
  const [search, setSearch] = useState("");
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchWorkItems = useCallback(async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const url = query
        ? `/api/azure-devops/work-items?search=${encodeURIComponent(query)}`
        : "/api/azure-devops/work-items";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch work items");
        setGrouped({});
      } else {
        setGrouped(data.grouped || {});
        setError(null);
      }
    } catch {
      setError("Failed to connect to server");
      setGrouped({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialLoaded) {
      fetchWorkItems();
      setInitialLoaded(true);
    }
  }, [initialLoaded, fetchWorkItems]);

  useEffect(() => {
    if (!initialLoaded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchWorkItems(search);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search, fetchWorkItems, initialLoaded]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (wi) => {
    onSelect({
      ticket_number: String(wi.id),
      title: wi.title,
      status: mapAzureStateToStatus(wi.state),
      due_date: wi.dueDate || "",
    });
    setSearch("");
    setOpen(false);
  };

  const totalItems = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
  const projects = Object.keys(grouped);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
        Import from Azure DevOps
      </label>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by work item ID or title..."
          disabled={disabled}
          className="w-full rounded-lg border border-card-border bg-background pl-10 pr-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-50 transition-shadow"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1.5 bg-card border border-card-border rounded-xl shadow-xl max-h-80 overflow-auto">
          {error ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => fetchWorkItems(search)}
                className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : loading && totalItems === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted mt-2">Fetching work items...</p>
            </div>
          ) : totalItems === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted">No work items found</p>
              <p className="text-xs text-muted/70 mt-1">
                {search ? "Try a different search term" : "No items assigned to you"}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {projects.map((project) => (
                <div key={project}>
                  <div className="px-3 py-2 bg-background/50 border-b border-card-border/50 sticky top-0">
                    <p className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {project}
                    </p>
                  </div>
                  {grouped[project].map((wi) => {
                    const badge = TYPE_BADGES[wi.type] || { bg: "bg-gray-100", text: "text-gray-700", label: wi.type };
                    const stateColor = STATE_COLORS[wi.state] || "text-muted";
                    const devopsUrl = `https://dev.azure.com/${process.env.NEXT_PUBLIC_AZURE_DEVOPS_ORG}/${encodeURIComponent(project)}/_workitems/edit/${wi.id}`;
                    return (
                      <div
                        key={wi.id}
                        className="flex items-start gap-0 hover:bg-primary-light/20 transition-colors group"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelect(wi)}
                          className="flex-1 text-left px-3 py-2.5 cursor-pointer flex items-start gap-2.5 min-w-0"
                        >
                          <span className="text-xs font-bold text-muted/70 mt-0.5 shrink-0 w-12 text-right group-hover:text-primary">
                            #{wi.id}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate leading-snug">
                              {wi.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                              <span className={`text-[10px] font-semibold ${stateColor}`}>
                                {wi.state}
                              </span>
                              {wi.dueDate && (
                                <span className="text-[10px] text-muted">
                                  Due: {new Date(wi.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <a
                          href={devopsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open in Azure DevOps"
                          className="shrink-0 px-2.5 py-3 flex items-center justify-center text-muted/30 hover:text-blue-600 hover:bg-blue-50/60 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
