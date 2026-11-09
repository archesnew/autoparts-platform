"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ADMIN_CLIENT_ERROR_BOUNDARY:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#17191b] p-6 text-[#f1f0eb]">
      <div className="w-full max-w-lg border border-[#383e41] bg-[#1e2124] p-6 sm:p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo variant="light" className="w-44" sizes="176px" />
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#ff6428]">
            Сбой интерфейса CRM
          </p>
          <h1 className="mt-2 text-xl font-extrabold uppercase">
            Возникла ошибка отображения
          </h1>
        </div>

        <div className="border border-red-900/50 bg-red-950/20 p-4 font-mono text-xs text-red-300">
          <p className="font-bold text-red-400">Сообщение системы:</p>
          <p className="mt-1 break-words">{error.message || "Непредвиденная ошибка клиента"}</p>
          {error.digest && (
            <p className="mt-2 text-[10px] text-[#888b8d]">Digest: {error.digest}</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 bg-[#ff6428] py-3 text-center text-xs font-extrabold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
          >
            Попробовать снова ↻
          </button>
          <a
            href="/admin"
            className="border border-[#51595c] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#f1f0eb] hover:border-[#ff6428]"
          >
            В панель управления
          </a>
        </div>
      </div>
    </div>
  );
}
