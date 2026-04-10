"use client";

import { useState, useEffect, useCallback } from "react";

const toLocalYMD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { TEAMS, getTeamLabel, getTeamColor } from "@/lib/teams";
import AppLayout from "@/components/AppLayout";
import DatePicker from "@/components/DatePicker";
import { TeamUpdatesSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

function StandupCard({
  standup,
  currentUserId,
  editingId,
  editForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditFormChange,
  saving,
}) {
  const isMine = standup.user_id === currentUserId;
  const isEditing = editingId === standup.id;
  const todayStr = new Date().toDateString();
  const standupDateStr = new Date(standup.created_at).toDateString();
  const canEdit = isMine && standupDateStr === todayStr;

  return (
    <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden card-hover">
      <div className="px-5 py-4 flex items-center justify-between border-b border-card-border bg-background/50">
        <div className="flex items-center gap-3">
          {standup.avatar_url ? (
            <img
              src={standup.avatar_url}
              alt={standup.employee_name || "User"}
              className="w-9 h-9 rounded-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextElementSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="w-9 h-9 rounded-full bg-accent-light items-center justify-center text-sm font-bold text-accent"
            style={{ display: standup.avatar_url ? "none" : "flex" }}
          >
            {(standup.employee_name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              {standup.employee_name || "Unknown"}
            </p>
            <p className="text-xs text-muted">
              {new Date(standup.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(standup.teams || []).map((t) => (
            <span
              key={t}
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${getTeamColor(t)}`}
            >
              {getTeamLabel(t)}
            </span>
          ))}
          {canEdit && !isEditing && (
            <button
              onClick={() => onStartEdit(standup)}
              className="text-xs font-semibold text-accent hover:text-accent/80 cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1">Yesterday</label>
              <textarea
                rows={2}
                value={editForm.yesterday || ""}
                onChange={(e) => onEditFormChange("yesterday", e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1">Today</label>
              <textarea
                rows={2}
                value={editForm.today || ""}
                onChange={(e) => onEditFormChange("today", e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1">Blockers</label>
              <textarea
                rows={2}
                value={editForm.blockers || ""}
                onChange={(e) => onEditFormChange("blockers", e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancelEdit}
                className="flex-1 rounded-lg border border-card-border py-2 text-sm font-semibold text-muted hover:bg-background cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => onSaveEdit(standup.id)}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary text-white py-2 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold text-primary-dark mb-1">Yesterday</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{standup.yesterday}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-accent mb-1">Today</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{standup.today}</p>
            </div>
            {standup.blockers && standup.blockers.trim() && (
              <div>
                <p className="text-xs font-semibold text-danger mb-1">Blockers</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{standup.blockers}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TeamUpdatesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [standups, setStandups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => toLocalYMD());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const isLeader = role === "super_admin" || role === "scrum_master";

  const fetchStandups = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const dateParam = selectedDate === toLocalYMD() ? "today" : selectedDate;
    const url = isLeader
      ? `/api/standup?date=${dateParam}&include=teams`
      : `/api/standup?date=${dateParam}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const data = await res.json();
    setStandups(data.standups || []);
    setLoading(false);
  }, [selectedDate, isLeader]);

  useEffect(() => {
    if (!authLoading && user) {
      setLoading(true);
      fetchStandups();
    }
  }, [authLoading, user, fetchStandups]);

  const startEdit = (standup) => {
    setEditingId(standup.id);
    setEditForm({
      yesterday: standup.yesterday,
      today: standup.today,
      blockers: standup.blockers || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditFormChange = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }));
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
      body: JSON.stringify({
        id,
        yesterday: editForm.yesterday,
        today: editForm.today,
        blockers: editForm.blockers,
      }),
    });
    setEditingId(null);
    setEditForm({});
    setSaving(false);
    fetchStandups();
  };

  if (authLoading) {
    return (
      <AppLayout>
        <TeamUpdatesSkeleton />
      </AppLayout>
    );
  }

  if (!user) return null;

  const displayed =
    isLeader && selectedTeam !== "all"
      ? standups.filter((s) => (s.teams || []).includes(selectedTeam))
      : standups;

  const displayedBlockerCount = displayed.filter((s) => s.blockers?.trim()).length;
  const dateLabel =
    selectedDate === toLocalYMD()
      ? "Today"
      : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-accent">Team Updates</h1>
            <p className="text-sm text-muted mt-1">
              {dateLabel} &middot; {displayed.length} update{displayed.length !== 1 && "s"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {/* Date picker + Team filter - leaders only, stacked above cards */}
        {isLeader && (
          <div className="relative z-10 space-y-3">
            <DatePicker value={selectedDate} onChange={setSelectedDate} />
            <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTeam("all")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                selectedTeam === "all"
                  ? "bg-accent text-white"
                  : "bg-card border border-card-border text-muted hover:text-foreground"
              }`}
            >
              All Teams
            </button>
            {TEAMS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  selectedTeam === t.id ? t.color : "bg-card border border-card-border text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
            </div>
          </div>
        )}

        {/* Blocker alert */}
        {displayedBlockerCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-800">
              {displayedBlockerCount} member{displayedBlockerCount !== 1 && "s"} reported blockers
            </p>
          </div>
        )}

        {/* Standup cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-card-border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-muted/30 animate-pulse" />
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-muted/30 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-3 w-full bg-muted/30 rounded animate-pulse mb-2" />
                <div className="h-3 w-[80%] bg-muted/30 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            type="team"
            title={`No updates yet${isLeader && selectedTeam !== "all" ? " for this team" : ""}`}
            description={
              isLeader && selectedTeam !== "all"
                ? "No members from this team have submitted their standup for this date."
                : "No standups submitted for this date yet."
            }
            action={
              <p className="text-sm text-muted">
                Be the first to submit your standup for today.
              </p>
            }
          />
        ) : (
          <div className="space-y-3">
            {displayed.map((standup) => (
              <StandupCard
                key={standup.id}
                standup={standup}
                currentUserId={user.id}
                editingId={editingId}
                editForm={editForm}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onEditFormChange={handleEditFormChange}
                saving={saving}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
