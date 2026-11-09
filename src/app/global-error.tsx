"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GLOBAL_ROOT_ERROR:", error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#17191b] p-6 text-[#f1f0eb]">
        <div className="w-full max-w-lg border border-[#383e41] bg-[#1e2124] p-6 sm:p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="text-2xl font-black tracking-widest text-[#f5f5f5]">
              ZAPTUT<span className="text-[#ff6428]">.PRO</span>
            </span>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#ff6428]">
              СИСТЕМНЫЙ СБОЙ
            </p>
            <h1 className="mt-2 text-xl font-extrabold uppercase">
              Ошибка загрузки приложения
            </h1>
          </div>

          <div className="border border-red-900/50 bg-red-950/20 p-4 font-mono text-xs text-red-300">
            <p className="font-bold text-red-400">Сообщение системы:</p>
            <p className="mt-1 break-words">{error.message || "Непредвиденный сбой клиента"}</p>
            {error.digest && (
              <p className="mt-2 text-[10px] text-[#888b8d]">Код ошибки: {error.digest}</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="flex-1 bg-[#ff6428] py-3 text-center text-xs font-extrabold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
            >
              Перезагрузить ↻
            </button>
            <a
              href="/admin"
              className="border border-[#51595c] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#f1f0eb] hover:border-[#ff6428]"
            >
              В панель CRM
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
