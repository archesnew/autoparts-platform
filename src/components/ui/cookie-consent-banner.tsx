"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "zaptut_cookie_consent_v1";

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Small delay so it doesn't jarringly pop during initial paint
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Storage unavailable or disabled
    }
  }, []);

  const handleAccept = (type: "all" | "essential") => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, date: new Date().toISOString() }));
    } catch {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="region"
      aria-label="Уведомление об использовании cookie"
      className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="container max-w-4xl mx-auto pointer-events-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#383e41] bg-[#1e2124]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
          <div className="space-y-1.5 flex-1 pr-0 sm:pr-4">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#ff6428]" />
              <p className="text-[11px] font-black uppercase tracking-wider text-[#ff865c]">
                Файлы Cookie и конфиденциальность (152-ФЗ)
              </p>
            </div>
            <p className="text-xs leading-relaxed text-[#cbd0d1]">
              ZAPTUT.PRO использует технические cookie-файлы и локальное хранилище для авторизации,
              сохранения содержимого корзины и параметров автомобиля. Ознакомьтесь с нашей{" "}
              <Link
                href="/privacy-policy"
                className="text-[#f1f0eb] underline decoration-[#ff6428] underline-offset-2 transition hover:text-[#ff865c]"
              >
                Политикой обработки персональных данных
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleAccept("essential")}
              className="min-h-10 border border-[#414749] bg-transparent px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#cbd0d1] transition hover:border-[#ff6428] hover:text-[#f1f0eb]"
            >
              Только технические
            </button>
            <button
              type="button"
              onClick={() => handleAccept("all")}
              className="min-h-10 bg-[#ff6428] px-5 py-2 text-[11px] font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
            >
              Принять все
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
