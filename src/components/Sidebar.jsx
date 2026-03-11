"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LogoutButton from "./LogoutButton";

const navItem = (href, label, icon) => ({ href, label, icon });

const WORK_ITEMS = [
  navItem("/dashboard", "Home", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )),
  navItem("/tasks", "My Tasks", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )),
  navItem("/submit", "Standup", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )),
  navItem("/team-updates", "Team Feed", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )),
  navItem("/notes", "Notes", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )),
];

const MEETING_ITEM = navItem("/start-meeting", "Start Meeting", (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
));

const ADMIN_ITEMS = [
  navItem("/admin/tickets", "Tickets", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )),
  navItem("/admin", "Users", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )),
];

const ACCOUNT_ITEMS = [
  navItem("/settings", "Settings", (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )),
];

export default function Sidebar() {
  const { role } = useAuth();
  const pathname = usePathname();

  const isActive = (href) => {
    if (pathname === href) return true;
    if (href === "/admin") return false; // Users: exact match only
    if (href.startsWith("/admin/")) return pathname.startsWith(href);
    return false;
  };

  const linkClass = (href) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
      isActive(href)
        ? "bg-accent-light text-accent"
        : "text-muted hover:text-foreground hover:bg-background/80"
    }`;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-card/95 backdrop-blur-sm border-r border-card-border">
      {/* Logo */}
      <div className="p-5 border-b border-card-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="xLM" className="h-8" />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-primary">c</span>
            <span className="text-accent">DS</span>
          </span>
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <p className="px-3 mb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
            Work
          </p>
          <div className="space-y-1">
            {WORK_ITEMS.map(({ href, label, icon }) => (
              <Link key={href} href={href} className={linkClass(href)}>
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </div>

        {(role === "scrum_master" || role === "super_admin") && (
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
              Meeting
            </p>
            <div className="space-y-1">
              <Link href={MEETING_ITEM.href} className={linkClass(MEETING_ITEM.href)}>
                {MEETING_ITEM.icon}
                {MEETING_ITEM.label}
              </Link>
            </div>
          </div>
        )}

        {role === "super_admin" && (
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
              Admin
            </p>
            <div className="space-y-1">
              {ADMIN_ITEMS.map(({ href, label, icon }) => (
                <Link key={href} href={href} className={linkClass(href)}>
                  {icon}
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="px-3 mb-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
            Account
          </p>
          <div className="space-y-1">
            {ACCOUNT_ITEMS.map(({ href, label, icon }) => (
              <Link key={href} href={href} className={linkClass(href)}>
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-card-border">
        <LogoutButton />
      </div>
    </aside>
  );
}
