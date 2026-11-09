import { redirect } from "next/navigation";
import { getSupplierContext } from "@/lib/server/supplier-session";
import { SupplierClientPage } from "./supplier-client-page";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export default async function SupplierPortalPage() {
  const ctx = await getSupplierContext();

  if (!ctx) {
    redirect("/login?callbackUrl=/supplier");
  }

  if (ctx.supplierStatus === "SUSPENDED" || ctx.supplierStatus === "REJECTED") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#17191b] p-4 text-[#f1f0eb]">
        <div className="w-full max-w-md border border-[#4b5255] bg-[#202325] p-6 text-center sm:p-8">
          <BrandLogo variant="dark" className="mx-auto w-36" />
          <div className="mt-6 border border-amber-600/40 bg-amber-950/20 p-4 text-left">
            <h1 className="text-sm font-black uppercase text-[#ff865c]">
              Кабинет временно приостановлен
            </h1>
            <p className="mt-2 text-xs leading-5 text-[#c5cbcc]">
              Доступ компании <b>{ctx.supplierName}</b> к личному кабинету поставщика
              приостановлен администрацией агрегатора (статус: {ctx.supplierStatus}).
            </p>
            <p className="mt-2 text-xs text-[#888b8d]">
              Пожалуйста, свяжитесь со службой поддержки ZAPTUT.PRO для уточнения деталей.
            </p>
          </div>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/"
              className="border border-[#4c5457] px-4 py-2 text-xs font-bold uppercase text-[#aeb5b6] hover:text-[#f1f0eb]"
            >
              На главную
            </Link>
            <Link
              href="/login"
              className="bg-[#ff6428] px-4 py-2 text-xs font-extrabold uppercase text-[#17191b]"
            >
              Сменить аккаунт
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <SupplierClientPage initialContext={ctx} />;
}
