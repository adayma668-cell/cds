"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/context/SidebarContext";
import LogoutButton from "./LogoutButton";

const navItem = (href, label, icon) => ({ href, label, icon });

const WORK_ITEMS = [
  navItem("/dashboard", "Home", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )),
  navItem("/tasks", "My Tasks", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )),
  navItem("/submit", "Standup", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )),
  navItem("/team-updates", "Team Feed", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )),
  navItem("/notes", "Notes", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )),
];

const MEETING_ITEM = navItem("/start-meeting", "Start Meeting", (
  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
));

const RETRO_ITEM = navItem("/retrospective", "Retrospective", (
  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
));

const ADMIN_ITEMS = [
  navItem("/admin/tickets", "Tickets", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )),
  navItem("/admin", "Users", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )),
  navItem("/admin/audit", "Audit Trail", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )),
];

const ACCOUNT_ITEMS = [
  navItem("/settings", "Settings", (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )),
];

function NavLink({ href, label, icon, isActive, collapsed }) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-accent-light text-accent shadow-sm"
          : "text-muted hover:text-foreground hover:bg-background/80"
      } ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? label : undefined}
    >
      {icon}
      <span
        className={`whitespace-nowrap transition-all duration-300 ${
          collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
        }`}
      >
        {label}
      </span>
      {/* Tooltip on hover when collapsed */}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-foreground text-background text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50">
          {label}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ label, collapsed }) {
  if (collapsed) {
    return <div className="mx-auto my-2 w-6 h-px bg-card-border/60" />;
  }
  return (
    <p className="px-3 mb-2 text-[11px] font-semibold text-muted uppercase tracking-wider transition-opacity duration-300">
      {label}
    </p>
  );
}

export default function Sidebar() {
  const { role } = useAuth();
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const checkActive = (href) => {
    if (pathname === href) return true;
    if (href === "/admin") return false;
    if (href.startsWith("/admin/")) return pathname.startsWith(href);
    return false;
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-card/95 backdrop-blur-sm border-r border-card-border transition-all duration-300 ease-in-out ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className={`border-b border-card-border transition-all duration-300 ${collapsed ? "p-3 flex justify-center" : "p-5"}`}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="xLM" className="h-8 flex-shrink-0" />
          <span
            className={`text-lg font-bold tracking-tight transition-all duration-300 ${
              collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
            }`}
          >
            <span className="text-primary">c</span>
            <span className="text-accent">SU</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto space-y-4 transition-all duration-300 ${collapsed ? "p-2" : "p-4"}`}>
        <div>
          <SectionLabel label="Work" collapsed={collapsed} />
          <div className="space-y-1">
            {WORK_ITEMS.map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={label} icon={icon} isActive={checkActive(href)} collapsed={collapsed} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel label="Meeting" collapsed={collapsed} />
          <div className="space-y-1">
            {(role === "scrum_master" || role === "super_admin") && (
              <NavLink href={MEETING_ITEM.href} label={MEETING_ITEM.label} icon={MEETING_ITEM.icon} isActive={checkActive(MEETING_ITEM.href)} collapsed={collapsed} />
            )}
            <NavLink href={RETRO_ITEM.href} label={RETRO_ITEM.label} icon={RETRO_ITEM.icon} isActive={checkActive(RETRO_ITEM.href)} collapsed={collapsed} />
          </div>
        </div>

        {role === "super_admin" && (
          <div>
            <SectionLabel label="Admin" collapsed={collapsed} />
            <div className="space-y-1">
              {ADMIN_ITEMS.map(({ href, label, icon }) => (
                <NavLink key={href} href={href} label={label} icon={icon} isActive={checkActive(href)} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel label="Account" collapsed={collapsed} />
          <div className="space-y-1">
            {ACCOUNT_ITEMS.map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={label} icon={icon} isActive={checkActive(href)} collapsed={collapsed} />
            ))}
          </div>
        </div>
      </nav>

      {/* Sign out */}
      <div className={`border-t border-card-border transition-all duration-300 ${collapsed ? "p-2" : "p-4"}`}>
        <LogoutButton collapsed={collapsed} />
      </div>

      {/* Collapse toggle button — centered on sidebar right edge */}
      <button
        onClick={toggle}
        className="absolute top-1/2 -translate-y-1/2 -right-3.5 w-7 h-7 bg-card border border-card-border rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:bg-accent hover:text-white hover:border-accent text-muted transition-all duration-200 z-50"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  );
}
