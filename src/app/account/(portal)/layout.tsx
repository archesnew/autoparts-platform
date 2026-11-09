import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerContext } from "@/lib/server/customer-session";
import { CustomerSessionProvider } from "@/components/customer/customer-session-provider";
import { CustomerPortalNav } from "@/components/customer/customer-nav";
import { BrandLogo } from "@/components/brand/brand-logo";

export default async function CustomerPortalLayout({ children }: { children: ReactNode }) {
  const customer = await getCustomerContext();

  if (!customer) {
    redirect("/account/login");
  }

  return (
    <CustomerSessionProvider value={customer}>
      <div className="min-h-screen bg-[#17191b] text-[#f1f0eb]">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-[#383e41] bg-[#17191b]/95 backdrop-blur">
          <div className="container flex min-h-[64px] items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/" aria-label="ZAPTUT.PRO — на главную" className="block w-36 sm:w-44">
                <BrandLogo variant="dark" className="w-full" priority />
              </Link>
              <span className="hidden border border-[#523223] bg-[#2a1c17] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#ff865c] md:inline">
                Личный кабинет
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="hidden text-right sm:block">
                <p className="font-bold text-[#f1f0eb]">{customer.name}</p>
                <p className="text-[10px] text-[#888b8d]">{customer.email}</p>
              </div>
              <div
                aria-hidden="true"
                className="grid h-8 w-8 place-items-center rounded-full bg-[#2a2e31] border border-[#414749] text-xs font-black text-[#ff865c]"
              >
                {(customer.name || "K")
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("") || "ZP"}
              </div>
              <Link
                href="/"
                className="hidden border border-[#414749] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6] hover:border-[#ff6428] hover:text-[#f1f0eb] md:inline"
              >
                На сайт →
              </Link>
            </div>
          </div>
        </header>

        {/* Portal Body with Sidebar */}
        <div className="container py-6 sm:py-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
            <aside>
              <CustomerPortalNav />
            </aside>
            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </CustomerSessionProvider>
  );
}
