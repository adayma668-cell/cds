"use client";

import Link from "next/link";
import Sidebar from "./Sidebar";
import PageTransition from "./PageTransition";
import { useSidebar } from "@/context/SidebarContext";

function MobileTopBar() {
  const { setMobileOpen } = useSidebar();

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-card/95 backdrop-blur-sm border-b border-card-border md:hidden">
      <button
        onClick={() => setMobileOpen(true)}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-background/80 transition-colors -ml-1"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Link href="/dashboard" className="flex items-center gap-2">
        <img src="/logo.svg" alt="xLM" className="h-7 flex-shrink-0" />
        <span className="text-base font-bold tracking-tight">
          <span className="text-primary">c</span>
          <span className="text-accent">SU</span>
        </span>
      </Link>
      <div className="w-9" />
    </div>
  );
}

export default function AppLayout({ children }) {
  const { collapsed, isMobile } = useSidebar();

  return (
    <div className="h-screen h-[100dvh] overflow-hidden">
      <Sidebar />
      <main
        className="h-screen h-[100dvh] overflow-y-auto transition-all duration-300 ease-in-out flex flex-col"
        style={{ marginLeft: isMobile ? 0 : (collapsed ? 72 : 256) }}
      >
        <MobileTopBar />
        <div className="flex-1">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
