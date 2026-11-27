import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

type LegalPageLayoutProps = {
  title: string;
  subtitle?: string;
  updatedAt?: string;
  isDraftDocument?: boolean;
  children: React.ReactNode;
};

export function LegalPageLayout({
  title,
  subtitle,
  updatedAt = "Ноябрь 2026",
  isDraftDocument = true,
  children,
}: LegalPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[#17191b] text-[#f1f0eb]">
      {/* Header */}
      <header className="border-b border-[#383e41] bg-[#1e2124]">
        <div className="container flex min-h-[70px] items-center justify-between gap-4">
          <Link href="/" aria-label="ZAPTUT.PRO — на главную" className="block w-[140px] sm:w-[180px]">
            <BrandLogo variant="dark" className="w-full" priority sizes="180px" />
          </Link>
          <nav className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-[#888b8d]">
            <Link href="/catalog" className="text-[#f1f0eb] hover:text-[#ff6428] transition">Каталог</Link>
            <Link href="/" className="hover:text-[#f1f0eb] transition">Главная</Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="container max-w-4xl py-10 sm:py-14">
        {/* Draft Notice if document */}
        {isDraftDocument && (
          <div className="mb-8 border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-6 text-amber-200">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-400">
              <span>⚠️</span>
              <span>Проект документа (для согласования)</span>
            </div>
            <p className="mt-1">
              Данный текст подготовлен как юридический шаблон для коммерческого запуска ZAPTUT.PRO. Значения в квадратных скобках (<code>[Реквизиты]</code>, <code>[Адрес]</code>, <code>[ОГРН]</code>) подлежат финальной проверке владельцем платформы и профильным юристом перед подписанием.
            </p>
          </div>
        )}

        <div className="border-b border-[#383e41] pb-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ff6428]">
            ZAPTUT.PRO · Информация
          </p>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-[#f1f0eb] sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-[#888b8d]">{subtitle}</p>
          )}
          <p className="mt-3 text-[11px] text-[#737d80]">Редакция: {updatedAt}</p>
        </div>

        {/* Content Body */}
        <article className="prose prose-invert mt-8 max-w-none text-xs leading-7 text-[#cbd0d1] sm:text-sm">
          {children}
        </article>

        {/* Quick Footer Links */}
        <div className="mt-16 border-t border-[#383e41] pt-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
            Правовая и справочная информация
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#888b8d]">
            <Link href="/about" className="hover:text-[#ff6428]">О компании</Link>
            <Link href="/contacts" className="hover:text-[#ff6428]">Контакты</Link>
            <Link href="/payment-info" className="hover:text-[#ff6428]">Оплата</Link>
            <Link href="/delivery-info" className="hover:text-[#ff6428]">Доставка</Link>
            <Link href="/returns-warranty" className="hover:text-[#ff6428]">Возврат и гарантия</Link>
            <Link href="/privacy-policy" className="hover:text-[#ff6428]">Конфиденциальность</Link>
            <Link href="/terms" className="hover:text-[#ff6428]">Условия использования</Link>
            <Link href="/consent" className="hover:text-[#ff6428]">Согласие на обработку данных</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
