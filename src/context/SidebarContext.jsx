"use client";

import { createContext, useContext, useState, useCallback } from "react";

const SidebarContext = createContext({ collapsed: false, toggle: () => {} });

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
