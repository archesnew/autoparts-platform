"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { IconMenu, IconUser } from "@/components/ui/icons";

const modes = ["VIN", "OEM", "Название"] as const;
type Mode = (typeof modes)[number];
const categories = [
  "Двигатель и компоненты",
  "Тормозная система",
  "Подвеска и рулевое",
  "Электрика и зажигание",
  "Кузов и оптика",
  "Фильтры и жидкости",
];

const quickOemChips = [
  { oem: "51712-C1A00", label: "Диск тормозной" },
  { oem: "28231-2F100", label: "Турбокомпрессор" },
  { oem: "58101-A6A00", label: "Колодки" },
  { oem: "37300-2E300", label: "Генератор" },
];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("VIN");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const placeholder =
    mode === "VIN"
      ? "Введите VIN автомобиля"
      : mode === "OEM"
      ? "Введите OEM или артикул детали"
      : "Например, передние тормозные колодки";

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setError("Введите VIN, OEM или название детали для поиска.");
      setNotice("");
      return;
    }
    setError("");
    router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
  }

  function selectQuickChip(chipOem: string) {
    setMode("OEM");
    setQuery(chipOem);
    router.push(`/catalog?q=${encodeURIComponent(chipOem)}`);
  }

  function chooseCategory(name: string) {
    router.push(`/catalog?q=${encodeURIComponent(name)}`);
  }

  return (
    <main className="min-h-screen bg-[#17191b] text-[#f1f0eb]">
      {/* Header */}
      <header className="relative z-20 border-b border-[#383e41] bg-[#17191b]">
        <div className="container flex min-h-[72px] items-center justify-between gap-2 sm:min-h-[76px] sm:gap-4">
          <Link href="#top" aria-label="ZAPTUT.PRO — на главную" className="block w-[116px] shrink-0 sm:w-[210px]">
            <BrandLogo variant="dark" className="w-full" priority sizes="(max-width: 640px) 116px, 210px" />
          </Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-6 text-sm font-medium text-[#888b8d] xl:flex">
            <Link className="transition hover:text-[#f1f0eb]" href="/catalog">Каталог</Link>
            <Link className="transition hover:text-[#f1f0eb]" href="#how">Как это работает</Link>
            <Link className="transition hover:text-[#f1f0eb]" href="/delivery-info">Доставка</Link>
            <Link className="transition hover:text-[#f1f0eb]" href="/about">О платформе</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap border border-[#ff6428] bg-[#ff6428] px-2.5 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050] sm:px-4 sm:text-xs"
              href="/account"
            >
              <IconUser className="h-3.5 w-3.5 shrink-0" />
              <span>Кабинет</span>
            </Link>
            <Link
              className="inline-flex min-h-10 items-center whitespace-nowrap border border-[#414749] bg-[#1e2124] px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#f1f0eb] transition hover:border-[#ff6428] hover:text-[#ff6428] sm:px-4 sm:text-xs"
              href="#search"
            >
              <span className="sm:hidden">Поиск</span>
              <span className="hidden sm:inline">Поиск деталей</span>
              <span className="ml-1 text-[#ff6428]">↗</span>
            </Link>
            <details className="relative xl:hidden">
              <summary
                aria-label="Открыть меню"
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center border border-[#414749] bg-[#1e2124] text-[#f1f0eb] transition hover:border-[#ff6428]"
              >
                <IconMenu />
              </summary>
              <nav
                aria-label="Меню сайта"
                className="absolute right-0 top-12 z-30 grid min-w-56 gap-1 border border-[#383e41] bg-[#1e2124] p-2 text-sm text-[#f1f0eb] shadow-2xl"
              >
                <Link className="p-3 font-bold text-[#ff6428] transition hover:bg-[#222629]" href="/account">Личный кабинет</Link>
                <Link className="p-3 font-semibold text-[#f1f0eb] transition hover:bg-[#222629] hover:text-[#ff6428]" href="/login">Вход в CRM (сотрудникам)</Link>
                <Link className="p-3 transition hover:bg-[#222629] hover:text-[#ff6428]" href="/catalog">Каталог запчастей</Link>
                <Link className="p-3 transition hover:bg-[#222629] hover:text-[#ff6428]" href="/delivery-info">Доставка</Link>
                <Link className="p-3 transition hover:bg-[#222629] hover:text-[#ff6428]" href="/payment-info">Оплата</Link>
                <Link className="p-3 transition hover:bg-[#222629] hover:text-[#ff6428]" href="/about">О платформе</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative isolate overflow-hidden bg-[#17191b]">
        <div className="container relative grid items-center gap-4 py-10 md:min-h-[650px] md:grid-cols-[.95fr_1.05fr] md:gap-0 md:py-12">
          <div className="relative z-10 order-1 md:py-8">
            <p className="mb-6 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[.2em] text-[#ff6428]">
              <span className="h-[2px] w-8 bg-[#ff6428]" />
              Международная платформа автозапчастей
            </p>
            <h1 className="text-5xl font-black uppercase leading-[.96] tracking-tight md:text-[64px] lg:text-[76px] text-[#f1f0eb]">
              Запчасти.<br />
              <span className="text-[#ff6428]">Без границ.</span>
            </h1>
            <p className="mt-6 max-w-[520px] text-base leading-7 text-[#888b8d] md:text-lg">
              Единый поиск автозапчастей в России, Беларуси и Польше. Оригинальные номера, проверенные аналоги и детали с разборок.
            </p>

            {/* Search Box */}
            <div id="search" className="mt-8 max-w-[630px] border border-[#383e41] bg-[#1e2124] p-3 sm:p-4">
              <div className="flex gap-2 border-b border-[#383e41] px-1 pb-3" role="tablist" aria-label="Тип поиска">
                {modes.map((item) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === item}
                    key={item}
                    onClick={() => {
                      setMode(item);
                      setError("");
                      setNotice("");
                    }}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                      mode === item
                        ? "border-b-2 border-[#ff6428] text-[#f1f0eb]"
                        : "text-[#888b8d] hover:text-[#f1f0eb]"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <form className="flex flex-col gap-3 pt-3 sm:flex-row" onSubmit={search} noValidate>
                <label className="sr-only" htmlFor="part-search">Поиск: {mode}</label>
                <input
                  id="part-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "search-error" : undefined}
                  className="min-h-12 min-w-0 flex-1 border border-transparent bg-[#f1f0eb] px-4 text-sm font-semibold text-[#17191b] outline-none placeholder:text-[#888b8d] focus:border-[#ff6428]"
                  placeholder={placeholder}
                />
                <button
                  className="min-h-12 whitespace-nowrap bg-[#ff6428] px-6 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
                  type="submit"
                >
                  Найти деталь <span className="ml-1 text-sm">→</span>
                </button>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">Быстрый OEM:</span>
                {quickOemChips.map((chip) => (
                  <button
                    key={chip.oem}
                    type="button"
                    onClick={() => selectQuickChip(chip.oem)}
                    className="border border-[#383e41] bg-[#17191b] px-2 py-0.5 text-[11px] font-mono text-[#f1f0eb] transition hover:border-[#ff6428] hover:text-[#ff6428]"
                  >
                    <span className="text-[#ff6428]">{chip.oem}</span> <span className="text-[#888b8d]">· {chip.label}</span>
                  </button>
                ))}
              </div>
              {error && <p id="search-error" role="alert" className="px-1 pt-2 text-xs font-semibold text-[#ff865c]">{error}</p>}
              {notice && <p role="status" className="px-1 pt-2 text-xs text-[#888b8d]">{notice}</p>}
            </div>
            <p className="mt-3 text-xs text-[#888b8d]">Введите VIN, OEM или наименование узла, чтобы сформировать запрос.</p>
          </div>

          {/* Hero Visual */}
          <div className="relative order-2 mx-[-24px] aspect-[16/9] overflow-hidden md:absolute md:inset-y-0 md:right-[-5%] md:mx-0 md:aspect-auto md:w-[66%]">
            <Image
              src="/brake-hero.webp"
              alt="Крупный план тормозного диска и оранжевого автомобильного суппорта"
              fill
              priority
              sizes="(max-width: 767px) 100vw, (max-width: 1200px) 66vw, 800px"
              className="hero-brake-image object-contain object-center md:object-right"
            />
          </div>

          {/* Metrics Ribbon */}
          <div className="relative z-10 order-3 grid grid-cols-2 gap-px border-t border-[#383e41] bg-[#383e41] pt-px md:col-span-2 md:mt-auto md:grid-cols-4">
            {[
              ["3 рынка", "в одном запросе"],
              ["Новые и Б/У", "проверенные запчасти"],
              ["Проверка", "экспертом по VIN"],
              ["Поддержка", "на всех этапах поставки"],
            ].map(([title, copy]) => (
              <div key={title} className="bg-[#17191b] px-4 py-4 text-xs uppercase tracking-wide text-[#888b8d]">
                <b className="block text-sm font-extrabold text-[#f1f0eb]">{title}</b>
                {copy}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="border-t border-[#383e41] bg-[#1e2124] py-14 md:py-16">
        <div className="container">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[#ff6428]">Каталог компонентов</p>
          <h2 className="text-3xl font-black uppercase tracking-tight text-[#f1f0eb] md:text-4xl">
            Найдите нужную категорию
          </h2>
          <div className="mt-8 grid gap-px border border-[#383e41] bg-[#383e41] sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((name, index) => (
              <button
                type="button"
                onClick={() => chooseCategory(name)}
                key={name}
                className="group flex min-h-[105px] items-center gap-4 bg-[#17191b] p-5 text-left transition hover:bg-[#222629]"
              >
                <span className="text-xs font-bold text-[#ff6428]">0{index + 1}</span>
                <b className="flex-1 text-sm font-extrabold uppercase text-[#f1f0eb]">{name}</b>
                <span className="text-xl text-[#888b8d] transition group-hover:text-[#ff6428]">↗</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-[#383e41] bg-[#17191b] py-14 md:py-16">
        <div className="container grid gap-9 md:grid-cols-[.8fr_1.2fr] md:items-center">
          <div id="about">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[#ff6428]">ZAPTUT.PRO · О платформе</p>
            <h2 className="text-3xl font-black uppercase leading-tight tracking-tight text-[#f1f0eb] md:text-4xl">
              От номера детали<br />до точного выбора
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[#888b8d]">
              Единый агрегатор автозапчастей с прямым доступом к складам и разборкам России, Беларуси и Польши.
            </p>
          </div>
          <div className="grid gap-px border border-[#383e41] bg-[#383e41] sm:grid-cols-3">
            {[
              ["01", "Поиск", "VIN, OEM, артикул или точное наименование узла"],
              ["02", "Сравнение", "Предложения складов и разборок в одном интерфейсе"],
              ["03", "Контроль", "Проверка совместимости и сопровождение сделки"],
            ].map(([number, title, copy]) => (
              <article className="min-h-[160px] bg-[#1e2124] p-5" key={number}>
                <span className="text-xs font-black text-[#ff6428]">/{number}</span>
                <h3 className="mt-6 text-sm font-black uppercase text-[#f1f0eb]">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#888b8d]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="suppliers" className="border-t border-[#383e41] bg-[#1e2124] py-10">
        <div className="container grid gap-6 md:grid-cols-[1.2fr_1.8fr] md:items-start">
          <div>
            <Link href="#top" aria-label="ZAPTUT.PRO — наверх" className="block w-[180px]">
              <BrandLogo variant="dark" className="w-full" sizes="180px" />
            </Link>
            <p className="mt-3 max-w-xs text-xs leading-5 text-[#888b8d]">
              Агрегатор автозапчастей с проверкой совместимости и поставками из России, Беларуси и Польши.
            </p>
            <a href="mailto:partners@zaptut.pro" className="mt-4 inline-block text-xs font-bold uppercase tracking-wider text-[#ff6428] transition hover:text-[#f1f0eb]">
              Поставщикам — подключить B2B-фиды →
            </a>
          </div>
          <div className="grid grid-cols-2 gap-6 text-xs sm:grid-cols-3">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#f1f0eb]">Платформа</p>
              <ul className="space-y-2 text-[#888b8d]">
                <li><Link href="/catalog" className="hover:text-[#ff6428] transition">Каталог деталей</Link></li>
                <li><Link href="/about" className="hover:text-[#ff6428] transition">О компании</Link></li>
                <li><Link href="/contacts" className="hover:text-[#ff6428] transition">Контакты</Link></li>
                <li><Link href="/login" className="hover:text-[#ff6428] transition">Вход в CRM</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#f1f0eb]">Покупателям</p>
              <ul className="space-y-2 text-[#888b8d]">
                <li><Link href="/account" className="hover:text-[#ff6428] transition">Личный кабинет</Link></li>
                <li><Link href="/payment-info" className="hover:text-[#ff6428] transition">Оплата</Link></li>
                <li><Link href="/delivery-info" className="hover:text-[#ff6428] transition">Доставка</Link></li>
                <li><Link href="/returns-warranty" className="hover:text-[#ff6428] transition">Возврат и гарантия</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#f1f0eb]">Документы</p>
              <ul className="space-y-2 text-[#888b8d]">
                <li><Link href="/privacy-policy" className="hover:text-[#ff6428] transition">Конфиденциальность</Link></li>
                <li><Link href="/terms" className="hover:text-[#ff6428] transition">Соглашение</Link></li>
                <li><Link href="/consent" className="hover:text-[#ff6428] transition">Обработка ПДн</Link></li>
                <li className="pt-2 text-[#737d80]">© 2026 · ZAPTUT.PRO</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
