"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.replace("/login");
    }
  }
  return <button type="button" onClick={signOut} disabled={busy} className="border border-[#414749] px-3 py-2 text-[10px] font-bold uppercase text-[#c6cccd] hover:border-[#ff6428] hover:text-[#f1f0eb] disabled:opacity-60">{busy?"Выход…":"Выйти"}</button>;
}
