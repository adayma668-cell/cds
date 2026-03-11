"use client";

import Sidebar from "./Sidebar";

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen min-h-[100dvh]">
      <Sidebar />
      <main className="ml-64 min-h-screen min-h-[100dvh] overflow-auto">
        {children}
      </main>
    </div>
  );
}
