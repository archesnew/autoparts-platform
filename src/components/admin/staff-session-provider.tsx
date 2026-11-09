"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StaffContext } from "@/lib/server/staff-session";

const fallbackStaffContext: StaffContext = {
  userId: "local-admin",
  name: "Администратор",
  email: "admin@zaptut.pro",
  role: "SUPER_ADMIN",
  permissions: ["*"],
};

const StaffSessionContext = createContext<StaffContext | null>(null);

export function StaffSessionProvider({ value, children }: { value: StaffContext; children: ReactNode }) {
  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>;
}

export function useStaffSession(): StaffContext {
  const value = useContext(StaffSessionContext);
  return value ?? fallbackStaffContext;
}
