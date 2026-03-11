"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LogoutButton from "./LogoutButton";

export default function Navbar() {
  const { role } = useAuth();
  const pathname = usePathname();

  const isActive = (href) => pathname === href;
  const linkClass = (href) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${
      isActive(href)
        ? "text-accent bg-accent-light font-semibold"
        : "text-muted hover:text-accent hover:bg-accent-light"
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-card-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="xLM" className="h-9" />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-primary">c</span>
            <span className="text-accent">DS</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            Dashboard
          </Link>
          <Link href="/tasks" className={linkClass("/tasks")}>
            Tasks
          </Link>
          <Link href="/submit" className={linkClass("/submit")}>
            Submit
          </Link>
          <Link href="/team-updates" className={linkClass("/team-updates")}>
            Updates
          </Link>
          <Link href="/notes" className={linkClass("/notes")}>
            Notes
          </Link>
          <Link href="/settings" className={linkClass("/settings")}>
            Settings
          </Link>

          {(role === "scrum_master" || role === "super_admin") && (
            <Link href="/start-meeting" className={linkClass("/start-meeting")}>
              Meeting
            </Link>
          )}

          {role === "super_admin" && (
            <>
              <Link href="/admin/tickets" className={linkClass("/admin/tickets")}>
                All Tickets
              </Link>
              <Link href="/admin" className={linkClass("/admin")}>
                Admin
              </Link>
            </>
          )}

          <div className="ml-2 pl-3 border-l border-card-border">
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
