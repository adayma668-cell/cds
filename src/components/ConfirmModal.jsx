"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  const variantStyles = {
    danger:
      "bg-danger text-white hover:bg-red-700 focus:ring-danger/30",
    default:
      "bg-primary text-white hover:bg-primary-dark focus:ring-primary/30",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ height: "100dvh" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
        style={{ height: "100dvh" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-card-border bg-card shadow-xl p-6 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h2>
        <p className="text-sm text-muted mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-card-border py-2.5 text-sm font-semibold text-muted hover:bg-background transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${variantStyles[variant] || variantStyles.default}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
