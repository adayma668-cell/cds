"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 2;

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    avatar_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const fileInputRef = useRef(null);

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchProfile = async () => {
    const token = await getToken();
    const res = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setProfile({
        name: data.name || "",
        email: data.email || "",
        avatar_url: data.avatar_url || null,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (
      passwordForm.newPassword &&
      passwordForm.newPassword !== passwordForm.confirmPassword
    ) {
      setMessage({ type: "error", text: "Passwords do not match" });
      setSaving(false);
      return;
    }
    if (passwordForm.newPassword && passwordForm.newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      setSaving(false);
      return;
    }

    const token = await getToken();
    const payload = { name: profile.name.trim() };
    if (passwordForm.newPassword) payload.password = passwordForm.newPassword;

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMessage({ type: "success", text: "Profile updated successfully" });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setShowPasswordSection(false);
      await supabase.auth.refreshSession();
    } else {
      const data = await res.json();
      setMessage({ type: "error", text: data.error || "Failed to update" });
    }
    setSaving(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage({ type: "error", text: "Please use JPEG, PNG, WebP, or GIF" });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setMessage({
        type: "error",
        text: `Image must be under ${MAX_SIZE_MB}MB`,
      });
      return;
    }

    setUploading(true);
    setMessage(null);

    const token = await getToken();
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/profile/avatar", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      setMessage({
        type: "error",
        text: uploadData.error || "Upload failed",
      });
      setUploading(false);
      return;
    }

    const publicUrl = uploadData.url;

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });

    if (res.ok) {
      setProfile((p) => ({ ...p, avatar_url: publicUrl }));
      setMessage({ type: "success", text: "Profile image updated" });
      await supabase.auth.refreshSession();
    } else {
      const data = await res.json();
      setMessage({ type: "error", text: data.error || "Failed to save image" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveAvatarUrl = async () => {
    const url = avatarUrlInput.trim();
    if (!url) return;
    setUploading(true);
    setMessage(null);

    const token = await getToken();
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar_url: url }),
    });

    if (res.ok) {
      setProfile((p) => ({ ...p, avatar_url: url }));
      setMessage({ type: "success", text: "Profile image updated" });
      setAvatarUrlInput("");
      await supabase.auth.refreshSession();
    } else {
      const data = await res.json();
      setMessage({ type: "error", text: data.error || "Failed to save" });
    }
    setUploading(false);
  };

  const handleRemoveAvatar = async () => {
    if (!profile.avatar_url) return;
    setUploading(true);
    setMessage(null);

    const idx = profile.avatar_url.indexOf("avatars/");
    const path =
      idx >= 0 ? profile.avatar_url.slice(idx + 8).split("?")[0] : null;

    const token = await getToken();
    if (path) {
      await fetch(`/api/profile/avatar?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar_url: null }),
    });

    if (res.ok) {
      setProfile((p) => ({ ...p, avatar_url: null }));
      setMessage({ type: "success", text: "Profile image removed" });
      await supabase.auth.refreshSession();
    }
    setUploading(false);
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-accent">Settings</h1>
          <p className="text-sm text-muted mt-1">
            Manage your account and preferences
          </p>
        </div>

        {message && (
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
              message.type === "success"
                ? "bg-primary/5 border-primary/20 text-primary-dark"
                : "bg-red-50 border-red-100 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border bg-gradient-to-r from-accent/5 to-primary/5">
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wider flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Profile
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Your photo and personal information
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Avatar */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative shrink-0">
                {profile.avatar_url ? (
                  <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-card-border shadow-md aspect-square">
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-accent-light flex items-center justify-center border-2 border-card-border shadow-md">
                    <span className="text-3xl font-bold text-accent">
                      {(profile.name || profile.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 rounded-2xl bg-foreground/60 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {profile.avatar_url ? "Change photo" : "Add photo"}
                  </button>
                  {profile.avatar_url && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-danger hover:bg-red-50 border border-card-border transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted">
                  JPEG, PNG, WebP or GIF. Max {MAX_SIZE_MB}MB.
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                    placeholder="Or paste image URL"
                    className="flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAvatarUrl}
                    disabled={uploading || !avatarUrlInput.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-accent hover:bg-accent-light border border-accent/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Use URL
                  </button>
                </div>
              </div>
            </div>

            {/* Name & Email */}
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid gap-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Your name"
                    className="w-full rounded-xl border border-card-border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email
                  </label>
                  <input
                    type="text"
                    value={profile.email}
                    readOnly
                    disabled
                    className="w-full rounded-xl border border-card-border bg-background/50 px-4 py-3 text-sm text-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted mt-1.5 flex items-center gap-1">
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Email cannot be changed
                  </p>
                </div>
              </div>

              {/* Password Section */}
              <div className="pt-6 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-dark cursor-pointer"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      showPasswordSection ? "rotate-90" : ""
                    }`}
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
                  Change password
                </button>

                {showPasswordSection && (
                  <div className="mt-4 p-4 rounded-xl bg-background/50 border border-card-border space-y-4">
                    <p className="text-xs text-muted">
                      Leave blank to keep your current password.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
                        New password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({
                            ...p,
                            newPassword: e.target.value,
                          }))
                        }
                        placeholder="••••••••"
                        minLength={6}
                        className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
                        Confirm new password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({
                            ...p,
                            confirmPassword: e.target.value,
                          }))
                        }
                        placeholder="••••••••"
                        minLength={6}
                        className="w-full rounded-lg border border-card-border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-6 py-3 text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Save changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
