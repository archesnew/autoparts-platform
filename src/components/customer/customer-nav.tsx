"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/account", label: "Обзор", icon: "▦" },
  { href: "/account/requests", label: "Мои заявки", icon: "📋" },
  { href: "/account/orders", label: "Мои заказы", icon: "📦" },
  { href: "/account/vehicles", label: "Мой гараж", icon: "🚗" },
  { href: "/account/addresses", label: "Адресная книга", icon: "📍" },
  { href: "/account/profile", label: "Профиль и вход", icon: "👤" },
];

export function CustomerPortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSignOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch {
      // Ignore network errors on signout
    }
    router.push("/account/login");
    router.refresh();
  }

  return (
    <nav className="space-y-4">
      {/* Mobile Horizontal Bar */}
      <div className="flex gap-1 overflow-x-auto border border-[#383e41] bg-[#1e2124] p-1.5 lg:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                active
                  ? "bg-[#ff6428] text-[#17191b]"
                  : "text-[#aeb5b6] hover:bg-[#252a2d] hover:text-[#f1f0eb]"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Desktop Vertical Menu */}
      <div className="hidden border border-[#383e41] bg-[#1e2124] p-2 lg:block">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#888b8d]">
          Меню покупателя
        </p>
        <div className="mt-1 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                  active
                    ? "border-[#ff6428] bg-[#2a2e31] text-[#f1f0eb]"
                    : "border-transparent text-[#aeb5b6] hover:bg-[#23272a] hover:text-[#f1f0eb]"
                }`}
              >
                <span className="text-sm text-[#ff6428]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 border-t border-[#343a3d] pt-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-950/20 transition disabled:opacity-50"
          >
            <span>⎋</span>
            <span>{loggingOut ? "Выход..." : "Выйти из кабинета"}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
