import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function CustomerAuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#17191b] p-4 text-[#f1f0eb] sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" aria-label="ZAPTUT.PRO — на главную" className="block w-44">
            <BrandLogo variant="dark" className="w-full" priority />
          </Link>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#ff6428]">
            Кабинет покупателя
          </p>
        </div>
        <div className="border border-[#383e41] bg-[#1e2124] p-6 shadow-2xl sm:p-8">
          {children}
        </div>
        <div className="mt-6 text-center text-xs text-[#888b8d]">
          <Link href="/" className="hover:text-[#f1f0eb] transition">
            ← Вернуться на главную ZAPTUT.PRO
          </Link>
        </div>
      </div>
    </main>
  );
}
