"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBell,
  IconCar,
  IconDashboard,
  IconLogOut,
  IconOrders,
  IconPin,
  IconRequests,
  IconUser,
} from "@/components/ui/icons";

const navItems = [
  { href: "/account", label: "Обзор", Icon: IconDashboard },
  { href: "/account/notifications", label: "Уведомления", Icon: IconBell, hasBadge: true },
  { href: "/account/requests", label: "Мои заявки", Icon: IconRequests },
  { href: "/account/orders", label: "Мои заказы", Icon: IconOrders },
  { href: "/account/vehicles", label: "Мой гараж", Icon: IconCar },
  { href: "/account/addresses", label: "Адресная книга", Icon: IconPin },
  { href: "/account/profile", label: "Профиль и вход", Icon: IconUser },
];

export function CustomerPortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/customer/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {});
  }, [pathname]);

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
        {navItems.map(({ href, label, Icon, hasBadge }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 flex min-h-9 items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                active
                  ? "bg-[#ff6428] text-[#17191b]"
                  : "text-[#aeb5b6] hover:bg-[#252a2d] hover:text-[#f1f0eb]"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
              {hasBadge && unreadCount > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {unreadCount}
                </span>
              )}
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
          {navItems.map(({ href, label, Icon, hasBadge }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-10 items-center justify-between border-l-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                  active
                    ? "border-[#ff6428] bg-[#2a2e31] text-[#f1f0eb]"
                    : "border-transparent text-[#aeb5b6] hover:bg-[#23272a] hover:text-[#f1f0eb]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-[#ff6428]" />
                  <span>{label}</span>
                </div>
                {hasBadge && unreadCount > 0 && (
                  <span className="rounded-full bg-[#ff6428] px-2 py-0.5 text-[10px] font-bold leading-none text-[#17191b]">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 border-t border-[#343a3d] pt-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-red-400 transition hover:bg-red-950/20 disabled:opacity-50"
          >
            <IconLogOut className="h-4 w-4 shrink-0" />
            <span>{loggingOut ? "Выход..." : "Выйти из кабинета"}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
