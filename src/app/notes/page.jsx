"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import EmptyState from "@/components/EmptyState";
import ConfirmModal from "@/components/ConfirmModal";
import { TargetIcon, NotepadIcon, LightbulbIcon, BellAlertIcon } from "@/lib/icons";

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [category, setCategory] = useState("goal");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const CATEGORIES = [
    { value: "goal", label: "Goal", icon: <TargetIcon className="w-3.5 h-3.5" />, color: "bg-primary-light text-primary-dark border-primary/20" },
    { value: "note", label: "Note", icon: <NotepadIcon className="w-3.5 h-3.5" />, color: "bg-accent-light text-accent border-accent/20" },
    { value: "idea", label: "Idea", icon: <LightbulbIcon className="w-3.5 h-3.5" />, color: "bg-amber-100 text-amber-700 border-amber-200" },
    { value: "reminder", label: "Reminder", icon: <BellAlertIcon className="w-3.5 h-3.5" />, color: "bg-purple-100 text-purple-700 border-purple-200" },
  ];

  const storageKey = user ? `standup-notes-${user.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setNotes(JSON.parse(stored));
      } catch {}
    }
  }, [storageKey]);

  const save = (updated) => {
    setNotes(updated);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const note = {
      id: Date.now().toString(),
      text: newNote.trim(),
      category,
      done: false,
      created_at: new Date().toISOString(),
    };
    save([note, ...notes]);
    setNewNote("");
  };

  const deleteNote = (id) => {
    setDeleteConfirm(null);
    save(notes.filter((n) => n.id !== id));
  };

  const toggleDone = (id) =>
    save(notes.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const saveEdit = (id) => {
    save(notes.map((n) => (n.id === id ? { ...n, text: editText } : n)));
    setEditingId(null);
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const activeNotes = notes.filter((n) => !n.done);
  const completedNotes = notes.filter((n) => n.done);
  const goalProgress =
    notes.filter((n) => n.category === "goal").length > 0
      ? Math.round(
          (notes.filter((n) => n.category === "goal" && n.done).length /
            notes.filter((n) => n.category === "goal").length) *
            100
        )
      : 0;

  return (
    <AppLayout>
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteNote(deleteConfirm)}
        title="Delete note"
        message="This note will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-accent">Notes & Goals</h1>
            <p className="text-sm text-muted mt-1">
              {activeNotes.length} active &middot; {completedNotes.length}{" "}
              completed
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        </div>

        {/* Goal Progress */}
        {notes.filter((n) => n.category === "goal").length > 0 && (
          <div className="bg-card rounded-xl border border-card-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                Goal Progress
              </h3>
              <span className="text-sm font-bold text-primary">{goalProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted mt-2">
              {notes.filter((n) => n.category === "goal" && n.done).length} of{" "}
              {notes.filter((n) => n.category === "goal").length} goals completed
            </p>
          </div>
        )}

        {/* Add New Note */}
        <div className="bg-card rounded-xl border border-card-border shadow-sm p-4 sm:p-5 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  category === c.value ? c.color : "border-card-border bg-background text-muted"
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder={`Add a ${category}...`}
              className="flex-1 rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none"
            />
            <button
              onClick={addNote}
              disabled={!newNote.trim()}
              className="btn-press px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-all disabled:opacity-50 cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>

        {/* Active Notes */}
        {activeNotes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
              Active
            </h3>
            {activeNotes.map((note) => {
              const cat = CATEGORIES.find((c) => c.value === note.category) || CATEGORIES[0];
              return (
                <div
                  key={note.id}
                  className="bg-card rounded-xl border border-card-border shadow-sm p-4 flex items-start gap-3 card-hover"
                >
                  <button
                    onClick={() => toggleDone(note.id)}
                    className="mt-0.5 w-5 h-5 rounded-md border-2 border-card-border hover:border-primary transition-all duration-200 cursor-pointer flex-shrink-0 checkbox-transition"
                  />
                  <div className="flex-1 min-w-0">
                    {editingId === note.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(note.id)}
                          className="flex-1 rounded-lg border border-card-border bg-background px-3 py-1.5 text-sm outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(note.id)}
                          className="text-xs font-semibold text-primary cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-semibold text-muted cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{note.text}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium inline-flex items-center gap-1 ${cat.color}`}>
                        {cat.icon} {cat.label}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(note.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  {editingId !== note.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1.5 text-muted hover:text-accent transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(note.id)}
                        className="btn-press p-1.5 text-muted hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Completed Notes */}
        {completedNotes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
              Completed
            </h3>
            {completedNotes.map((note) => {
              const cat = CATEGORIES.find((c) => c.value === note.category) || CATEGORIES[0];
              return (
                <div
                  key={note.id}
                  className="bg-card rounded-xl border border-card-border shadow-sm p-4 flex items-start gap-3 opacity-60"
                >
                  <button
                    onClick={() => toggleDone(note.id)}
                    className="mt-0.5 w-5 h-5 rounded-md bg-primary border-2 border-primary flex items-center justify-center cursor-pointer flex-shrink-0 checkbox-transition"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted line-through">{note.text}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium mt-1.5 inline-flex items-center gap-1 ${cat.color}`}>
                      {cat.icon} {cat.label}
                    </span>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(note.id)}
                    className="btn-press p-1.5 text-muted hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {notes.length === 0 && (
          <EmptyState
            type="notes"
            title="No notes yet"
            description="Add goals, reminders, or quick notes to stay on track. Your notes are private and stored on this device."
            action={
              <p className="text-sm text-muted">
                Use the form above to add your first note.
              </p>
            }
          />
        )}

        <p className="text-xs text-center text-muted">
          Notes are stored locally on this device
        </p>
      </div>
    </AppLayout>
  );
}
