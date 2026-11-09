"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CustomerContext } from "@/lib/server/customer-session";

const CustomerSessionContext = createContext<CustomerContext | null>(null);

export function CustomerSessionProvider({
  value,
  children,
}: {
  value: CustomerContext;
  children: ReactNode;
}) {
  return (
    <CustomerSessionContext.Provider value={value}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession(): CustomerContext {
  const value = useContext(CustomerSessionContext);
  if (!value) {
    throw new Error("useCustomerSession must be used within CustomerSessionProvider");
  }
  return value;
}
