"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

const MOODS = {
  great: { emoji: "😊", label: "Great" },
  good: { emoji: "🙂", label: "Good" },
  okay: { emoji: "😐", label: "Okay" },
  struggling: { emoji: "😟", label: "Struggling" },
  blocked: { emoji: "😤", label: "Blocked" },
};

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [standups, setStandups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchHistory = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/standup?scope=mine", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const data = await res.json();
    setStandups(data.standups || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) fetchHistory();
  }, [authLoading, user, fetchHistory]);

  const startEdit = (standup) => {
    setEditingId(standup.id);
    setEditForm({
      yesterday: standup.yesterday,
      today: standup.today,
      blockers: standup.blockers || "",
      mood: standup.mood || "good",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id) => {
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch("/api/standup", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id, ...editForm }),
    });
    setEditingId(null);
    setSaving(false);
    fetchHistory();
  };

  const groupByDate = (items) => {
    const groups = {};
    items.forEach((item) => {
      const date = new Date(item.created_at).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const grouped = groupByDate(standups);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-accent">My Standup History</h1>
            <p className="text-sm text-muted mt-1">
              {standups.length} standup{standups.length !== 1 && "s"} submitted
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {standups.length === 0 ? (
          <div className="bg-card rounded-2xl border border-card-border shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">No standups yet</h3>
            <p className="text-sm text-muted">Submit your first standup to see it here!</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  {date}
                </span>
                <div className="flex-1 h-px bg-card-border" />
              </div>

              {items.map((standup) => {
                const moodData = MOODS[standup.mood] || MOODS.good;
                const editable = isToday(standup.created_at);
                const isEditing = editingId === standup.id;

                return (
                  <div
                    key={standup.id}
                    className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden"
                  >
                    <div className="px-5 py-4 flex items-center justify-between border-b border-card-border bg-background/50">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{moodData.emoji}</span>
                        <span className="text-xs font-semibold text-muted">
                          {new Date(standup.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            standup.mood === "great"
                              ? "bg-green-100 text-green-700"
                              : standup.mood === "blocked" || standup.mood === "struggling"
                              ? "bg-red-100 text-red-700"
                              : "bg-primary-light text-primary-dark"
                          }`}
                        >
                          {moodData.label}
                        </span>
                      </div>
                      {editable && !isEditing && (
                        <button
                          onClick={() => startEdit(standup)}
                          className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="p-5 space-y-4">
                        <div className="flex gap-2 mb-3">
                          {Object.entries(MOODS).map(([k, v]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() =>
                                setEditForm((f) => ({ ...f, mood: k }))
                              }
                              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                                editForm.mood === k
                                  ? "border-primary bg-primary-light text-primary-dark"
                                  : "border-card-border bg-card text-muted"
                              }`}
                            >
                              <span className="text-lg">{v.emoji}</span>
                              <span>{v.label}</span>
                            </button>
                          ))}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted uppercase">
                            Yesterday
                          </label>
                          <textarea
                            rows={2}
                            value={editForm.yesterday}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                yesterday: e.target.value,
                              }))
                            }
                            className="w-full mt-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted uppercase">
                            Today
                          </label>
                          <textarea
                            rows={2}
                            value={editForm.today}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                today: e.target.value,
                              }))
                            }
                            className="w-full mt-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted uppercase">
                            Blockers
                          </label>
                          <textarea
                            rows={2}
                            value={editForm.blockers}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                blockers: e.target.value,
                              }))
                            }
                            className="w-full mt-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="flex-1 rounded-lg border border-card-border py-2 text-sm font-semibold text-muted hover:bg-background transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(standup.id)}
                            disabled={saving}
                            className="flex-1 rounded-lg bg-primary text-white py-2 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {saving ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-primary-dark mb-1">
                            Yesterday
                          </p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {standup.yesterday}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-accent mb-1">
                            Today
                          </p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {standup.today}
                          </p>
                        </div>
                        {standup.blockers && (
                          <div>
                            <p className="text-xs font-semibold text-danger mb-1">
                              Blockers
                            </p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {standup.blockers}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
