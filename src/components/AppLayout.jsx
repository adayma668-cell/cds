"use client";

import Sidebar from "./Sidebar";
import PageTransition from "./PageTransition";
import { useSidebar } from "@/context/SidebarContext";

export default function AppLayout({ children }) {
  const { collapsed } = useSidebar();

  return (
    <div className="h-screen h-[100dvh] overflow-hidden">
      <Sidebar />
      <main
        className="h-screen h-[100dvh] overflow-y-auto transition-all duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? 72 : 256 }}
      >
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
