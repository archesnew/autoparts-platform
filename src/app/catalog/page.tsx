"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BrandLoader } from "@/components/brand/brand-loader";
import { IconCart } from "@/components/ui/icons";
import type { PublicOfferDto, PublicProductDto } from "@/lib/server/catalog-types";
import { CatalogCartDrawer } from "@/components/catalog/catalog-cart-drawer";
import {
  DualModeVehicleFilter,
  emptyVehicleFilterSelection,
  YEAR_SEMANTIC_SHORT,
  type VehicleFilterSelection,
} from "@/components/catalog/dual-mode-vehicle-filter";
import { BODY_TYPE_LABELS, type BodyType } from "@/lib/garage/vehicle-visual-registry";
import { CartItem, loadCartFromStorage, saveCartToStorage, clearCartStorage } from "@/lib/catalog-cart";

type Part = {
  id: string | number;
  title: string;
  oem: string;
  brand: string;
  condition: "Новая" | "БУ" | "Новая / БУ";
  badge: "ORIGINAL" | "ANALOG" | "USED" | "ARCHIVED_SOLD";
  country: "Россия" | "Беларусь" | "Польша" | string;
  countries?: string[];
  price: number | null;
  category: string;
  make: string;
  model: string;
  year: string;
  photo: string;
  description: string;
  offersCount?: number;
  offers?: PublicOfferDto[];
};

const categories = [
  "Тормозная система",
  "Двигатель",
  "Подвеска и рулевое управление",
  "Трансмиссия",
  "Электрика",
  "Кузовные детали",
  "Охлаждение",
  "Фильтры и расходники",
];

const quickOemChips = [
  { oem: "51712-C1A00", label: "Диск тормозной" },
  { oem: "28231-2F100", label: "Турбокомпрессор" },
  { oem: "58101-A6A00", label: "Колодки" },
  { oem: "37300-2E300", label: "Генератор" },
  { oem: "56500-D7000", label: "Рейка (архив)" },
];

const demoParts: Part[] = [
  {
    id: 1,
    title: "Диск тормозной передний, вентилируемый",
    oem: "51712-C1A00",
    brand: "NORTHLINE",
    condition: "Новая",
    badge: "ORIGINAL",
    country: "Россия",
    price: 6940,
    category: categories[0],
    make: "Kia",
    model: "Sportage",
    year: "2020–2024",
    photo: "/brake-rotor.webp",
    description: "Оригинальный тормозной диск. Высокая термостойкость, заводские параметры балансировки.",
  },
  {
    id: 2,
    title: "Суппорт тормозной передний, правый",
    oem: "58130-A6A00",
    brand: "PARTS LAB",
    condition: "БУ",
    badge: "USED",
    country: "Беларусь",
    price: null,
    category: categories[0],
    make: "Kia",
    model: "Sportage",
    year: "2019–2023",
    photo: "/brake-caliper.webp",
    description: "Контрактная деталь с европейской разборки. Проверена геометрия и целостность поршня.",
  },
  {
    id: 3,
    title: "Комплект тормозных колодок передний",
    oem: "58101-A6A00",
    brand: "NORTHLINE",
    condition: "Новая",
    badge: "ANALOG",
    country: "Польша",
    price: 4280,
    category: categories[0],
    make: "Hyundai",
    model: "Tucson",
    year: "2021–2025",
    photo: "/brake-pads.webp",
    description: "Сертифицированный европейский аналог. Низкий уровень пылеобразования и шума.",
  },
  {
    id: 4,
    title: "Турбокомпрессор в сборе",
    oem: "28231-2F100",
    brand: "MECHCORE",
    condition: "БУ",
    badge: "USED",
    country: "Россия",
    price: 38900,
    category: categories[1],
    make: "Hyundai",
    model: "Tucson",
    year: "2018–2022",
    photo: "/turbocharger.webp",
    description: "Оригинальный узел с малым пробегом. Проведена диагностика крыльчатки и клапана геометрии.",
  },
  {
    id: 5,
    title: "Амортизатор передний газомасляный",
    oem: "54651-D7A00",
    brand: "NORTHLINE",
    condition: "Новая",
    badge: "ORIGINAL",
    country: "Беларусь",
    price: 11800,
    category: categories[2],
    make: "Kia",
    model: "Sportage",
    year: "2020–2024",
    photo: "/shock-absorber.webp",
    description: "Заводская стойка амортизатора. Полное соответствие характеристикам штатной подвески.",
  },
  {
    id: 6,
    title: "Генератор автомобильный 14V",
    oem: "37300-2E300",
    brand: "PARTS LAB",
    condition: "БУ",
    badge: "USED",
    country: "Польша",
    price: null,
    category: categories[4],
    make: "Hyundai",
    model: "Tucson",
    year: "2019–2024",
    photo: "/alternator.webp",
    description: "Проверен на испытательном стенде под нагрузкой. Поставка со склада в Польше (Allegro B2B).",
  },
  {
    id: 7,
    title: "Рулевая рейка с электроусилителем (в сборе)",
    oem: "56500-D7000",
    brand: "ORIGINAL OEM",
    condition: "БУ",
    badge: "ARCHIVED_SOLD",
    country: "Польша",
    price: 34500,
    category: categories[2],
    make: "Kia",
    model: "Sportage",
    year: "2019–2022",
    photo: "/shock-absorber.webp",
    description: "Контрактный узел. Товар продан (ARCHIVED_SOLD). Карточка сохранена в вечном архиве для сверки характеристик и подбора аналогов.",
  },
];

const emptyFilters = {
  make: "",
  model: "",
  year: "",
  brand: "",
  condition: "",
  country: "",
  availability: "",
  minPrice: "",
  maxPrice: "",
  sortBy: "relevance",
};
const modes = ["VIN", "OEM", "Название"] as const;
type Mode = (typeof modes)[number];

const VEHICLE_STORAGE_KEY = "zaptut_catalog_vehicle_v1";

function formatVehicleSummary(sel: VehicleFilterSelection): string {
  const parts: string[] = [];
  if (sel.make) parts.push(sel.make);
  if (sel.model) parts.push(sel.model);
  if (sel.generation) parts.push(sel.generation);
  if (sel.year) {
    const sem = sel.yearSemantics ? YEAR_SEMANTIC_SHORT[sel.yearSemantics] : "";
    parts.push(sem ? `${sel.year} (${sem})` : sel.year);
  }
  if (sel.bodyType) parts.push(BODY_TYPE_LABELS[sel.bodyType as BodyType] || sel.bodyType);
  if (sel.engine) parts.push(sel.engine);
  if (sel.modification) parts.push(sel.modification);
  return parts.join(" · ");
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const urlMake = searchParams.get("make") ?? "";
  const urlModel = searchParams.get("model") ?? "";
  const urlYear = searchParams.get("year") ?? "";

  const [mode, setMode] = useState<Mode>("VIN");
  const [query, setQuery] = useState(initialQ);
  const [vehicleSelection, setVehicleSelection] = useState<VehicleFilterSelection>(() => ({
    ...emptyVehicleFilterSelection,
    make: urlMake,
    model: urlModel,
    year: urlYear,
  }));
  const [isVehicleLoaded, setIsVehicleLoaded] = useState(false);
  // Switch: OFF by default so selecting a vehicle does NOT hide the catalog assortment
  const [fitmentOnly, setFitmentOnly] = useState(false);
  const vehicleAsideRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState(() => ({
    ...emptyFilters,
    make: urlMake,
    model: urlModel,
    year: urlYear,
  }));

  // Restore saved vehicle context from localStorage when no URL vehicle override is present
  useEffect(() => {
    try {
      if (!urlMake) {
        const raw = window.localStorage.getItem(VEHICLE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            vehicle?: VehicleFilterSelection;
            fitmentOnly?: boolean;
          };
          if (parsed?.vehicle?.make) {
            setVehicleSelection({ ...emptyVehicleFilterSelection, ...parsed.vehicle });
            setFilters((cur) => ({
              ...cur,
              make: parsed.vehicle!.make || "",
              model: parsed.vehicle!.model || "",
              year: parsed.vehicle!.year || "",
            }));
            if (typeof parsed.fitmentOnly === "boolean") {
              setFitmentOnly(parsed.fitmentOnly);
            }
          }
        }
      }
    } catch {}
    setIsVehicleLoaded(true);
  }, [urlMake]);

  useEffect(() => {
    if (!isVehicleLoaded) return;
    try {
      if (vehicleSelection.make) {
        window.localStorage.setItem(
          VEHICLE_STORAGE_KEY,
          JSON.stringify({ vehicle: vehicleSelection, fitmentOnly })
        );
      } else {
        window.localStorage.removeItem(VEHICLE_STORAGE_KEY);
      }
    } catch {}
  }, [vehicleSelection, fitmentOnly, isVehicleLoaded]);

  function handleVehicleChange(next: VehicleFilterSelection) {
    setVehicleSelection(next);
    setFilters((current) => ({
      ...current,
      make: next.make,
      model: next.model,
      year: next.year,
    }));
    if (!next.make) {
      setFitmentOnly(false);
    }
  }
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Part | null>(null);
  const [requestPart, setRequestPart] = useState<Part | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartLoaded, setIsCartLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setCartItems(loadCartFromStorage());
    setIsCartLoaded(true);
  }, []);

  useEffect(() => {
    if (!isCartLoaded) return;
    saveCartToStorage(cartItems);
  }, [cartItems, isCartLoaded]);

  useEffect(() => {
    fetch("/api/customer/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.customer) setCustomer(data.customer);
      })
      .catch(() => {});
  }, []);

  function handleAddToCart(part: Part, qty = 1) {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((i) => String(i.partId) === String(part.id));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += qty;
        return copy;
      }
      return [
        ...prev,
        {
          id: `${part.id}-${Date.now()}`,
          partId: part.id,
          title: part.title,
          oem: part.oem,
          brand: part.brand,
          condition: part.condition,
          price: part.price,
          photo: part.photo,
          quantity: qty,
        },
      ];
    });
    setIsCartOpen(true);
  }

  function handleUpdateQuantity(id: string, delta: number) {
    setCartItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      })
    );
  }

  function handleRemoveItem(id: string) {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleClearCart() {
    setCartItems([]);
    clearCartStorage();
  }

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const [dbItems, setDbItems] = useState<Part[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (filters.make) params.set("make", filters.make);
    if (filters.model) params.set("model", filters.model);
    if (filters.year) params.set("year", filters.year);
    if (fitmentOnly && filters.make) params.set("fitmentOnly", "true");
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.country) params.set("country", filters.country);
    if (filters.availability) params.set("availability", filters.availability);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.sortBy && filters.sortBy !== "relevance") params.set("sortBy", filters.sortBy);

    setLoading(true);
    fetch(`/api/catalog?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Catalog request failed");
        return res.json();
      })
      .then((data) => {
        if (!active || !data?.items) return;
        const mapped: Part[] = data.items.map((item: PublicProductDto) => {
          const firstApp = item.applicability?.[0];
          return {
            id: item.id,
            title: item.canonicalName,
            oem: item.primaryOem,
            brand: item.brand,
            condition: item.condition,
            badge: item.badge,
            country: item.country,
            countries: item.countries,
            price: item.minPrice,
            category: item.category,
            make: firstApp?.make || "",
            model: firstApp?.model || "",
            year: firstApp?.year || "",
            photo: item.photos[0] || "/brake-rotor.webp",
            description: item.description || "",
            offersCount: item.offersCount,
            offers: item.offers,
          };
        });
        setDbItems(mapped);
      })
      .catch((err) => {
        console.error("Catalog API error, fallback to initial items:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, category, filters, fitmentOnly]);

  const fallbackFiltered = useMemo(() => {
    let result = demoParts.filter((part) => {
      const q = query.trim().toLocaleLowerCase("ru");
      const haystack = `${part.title} ${part.oem} ${part.brand} ${part.make} ${part.model} ${part.category}`.toLocaleLowerCase("ru");
      const minP = filters.minPrice ? parseInt(filters.minPrice, 10) : null;
      const maxP = filters.maxPrice ? parseInt(filters.maxPrice, 10) : null;

      return (
        (!q || haystack.includes(q)) &&
        (!category || part.category === category) &&
        (!fitmentOnly || !filters.make || part.make === filters.make) &&
        (!fitmentOnly || !filters.model || part.model === filters.model) &&
        (!fitmentOnly || !filters.year || part.year.includes(filters.year)) &&
        (!filters.brand || part.brand === filters.brand) &&
        (!filters.condition || part.condition === filters.condition) &&
        (!filters.country || part.country === filters.country) &&
        (!filters.availability ||
          (filters.availability === "IN_STOCK" && part.badge !== "ARCHIVED_SOLD") ||
          (filters.availability === "ARCHIVED_SOLD" && part.badge === "ARCHIVED_SOLD")) &&
        (minP === null || (part.price !== null && part.price >= minP)) &&
        (maxP === null || (part.price !== null && part.price <= maxP))
      );
    });

    if (filters.sortBy === "price_asc") {
      result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (filters.sortBy === "price_desc") {
      result.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    }

    return result;
  }, [query, category, filters]);

  const filtered = dbItems !== null ? dbItems : fallbackFiltered;

  function resetAllFilters() {
    setQuery("");
    setCategory("");
    setFilters(emptyFilters);
    setVehicleSelection(emptyVehicleFilterSelection);
    setFitmentOnly(false);
  }

  function setFilter(key: keyof typeof emptyFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function openRequest(part: Part | null) {
    setRequestPart(part);
    setRequestOpen(true);
    setRequestMessage("");
  }

  function findAnalog(oem: string) {
    setQuery(oem);
    setMode("OEM");
    setCategory("");
    setFilters(emptyFilters);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const selectClass =
    "mt-2 w-full border border-[#414749] bg-[#17191b] px-3 py-2.5 text-xs font-semibold text-[#f1f0eb] outline-none focus:border-[#ff6428]";
  const placeholder =
    mode === "VIN"
      ? "Введите VIN автомобиля"
      : mode === "OEM"
      ? "Введите OEM или артикул детали"
      : "Например, передние тормозные колодки";

  return (
    <main className="min-h-screen bg-[#17191b] text-[#f1f0eb]">
      {/* Header */}
      <header className="border-b border-[#383e41] bg-[#17191b]">
        <div className="container flex min-h-[72px] items-center justify-between gap-2 sm:min-h-[74px] sm:gap-3">
          <Link href="/" aria-label="ZAPTUT.PRO — на главную" className="block w-[116px] shrink-0 sm:w-[210px]">
            <BrandLogo variant="dark" className="w-full" priority sizes="(max-width: 640px) 116px, 210px" />
          </Link>
          <nav aria-label="Основная навигация" className="hidden gap-6 text-sm font-medium text-[#888b8d] lg:flex">
            <Link href="/catalog" className="text-[#f1f0eb]">Каталог</Link>
            <Link href="/#how" className="transition hover:text-[#f1f0eb]">Как это работает</Link>
            <Link href="/delivery-info" className="transition hover:text-[#f1f0eb]">Доставка</Link>
            <Link href="/about" className="transition hover:text-[#f1f0eb]">О платформе</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              id="cart-drawer-toggle"
              onClick={() => setIsCartOpen(true)}
              className={`flex min-h-10 items-center gap-1.5 border px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider transition sm:gap-2 sm:px-3 sm:text-xs ${
                totalCartCount > 0
                  ? "border-[#ff6428] bg-[#ff6428] text-[#17191b] hover:bg-[#ff7a45]"
                  : "border-[#414749] bg-[#1e2124] text-[#f1f0eb] hover:border-[#ff6428]"
              }`}
            >
              <IconCart className="h-3.5 w-3.5 shrink-0" />
              <span>Заявка</span>
              {totalCartCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#17191b] px-1 text-[10px] font-black text-[#ff865c]">
                  {totalCartCount}
                </span>
              )}
            </button>

            <Link
              href="/account/requests"
              className="hidden sm:inline-flex border border-[#414749] bg-[#1e2124] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] transition hover:border-[#ff6428] hover:text-[#ff6428]"
            >
              Мои заявки
            </Link>

            <Link
              href={customer ? "/account" : "/account/login?redirect=/catalog"}
              className="border border-[#414749] bg-[#1e2124] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] transition hover:border-[#ff6428] hover:text-[#ff6428]"
            >
              {customer ? "Кабинет" : "Вход"}
            </Link>
          </div>
        </div>
      </header>

      {/* Catalog Hero & Search */}
      <section className="border-b border-[#383e41] bg-[#1e2124] py-8 md:py-10">
        <div className="container">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#ff6428]">
                Каталог компонентов
              </p>
              <h1 className="text-3xl font-black uppercase leading-none tracking-tight text-[#f1f0eb] md:text-5xl">
                Каталог запчастей
              </h1>
              <p className="mt-3 text-sm text-[#888b8d] md:text-base">
                Поиск по складам и разборкам России, Беларуси и Польши.
              </p>
            </div>
            <span className="w-fit border border-[#383e41] bg-[#17191b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#ff986f]">
              3 рынка в одном поиске
            </span>
          </div>

          <div className="border border-[#383e41] bg-[#17191b] p-3 sm:p-4">
            <div className="mb-3 flex gap-2 border-b border-[#383e41] px-1 pb-2" role="tablist" aria-label="Тип поиска">
              {modes.map((item) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  key={item}
                  onClick={() => setMode(item)}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
                    mode === item
                      ? "border-b-2 border-[#ff6428] text-[#f1f0eb]"
                      : "text-[#888b8d] hover:text-[#f1f0eb]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="catalog-search">Поиск по {mode}</label>
              <input
                id="catalog-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="min-h-12 min-w-0 flex-1 bg-[#f1f0eb] px-4 text-sm font-semibold text-[#17191b] outline-none placeholder:text-[#888b8d] focus:ring-2 focus:ring-[#ff6428]"
              />
              <button
                type="submit"
                className="min-h-12 bg-[#ff6428] px-7 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
              >
                Найти деталь →
              </button>
            </form>
            {/* Quick OEM chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                Быстрый подбор OEM:
              </span>
              {quickOemChips.map((chip) => (
                <button
                  key={chip.oem}
                  type="button"
                  onClick={() => {
                    setQuery(chip.oem);
                    setMode("OEM");
                  }}
                  className={`border px-2.5 py-1 text-xs font-mono transition ${
                    query === chip.oem
                      ? "border-[#ff6428] bg-[#ff6428] font-bold text-[#17191b]"
                      : "border-[#414749] bg-[#1e2124] text-[#f1f0eb] hover:border-[#ff6428] hover:text-[#ff6428]"
                  }`}
                >
                  {chip.oem} <span className="font-sans text-[10px] text-[#888b8d]">({chip.label})</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#888b8d]">
              Фильтрация выполняется по артикулу, марке, модели и ключевым словам.
            </p>
          </div>
        </div>
      </section>

      {/* Categories Bar */}
      <section className="container py-8">
        <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[.2em] text-[#888b8d]">
          Разделы каталога
        </h2>
        <div className="grid gap-px border border-[#383e41] bg-[#383e41] sm:grid-cols-2 md:grid-cols-4">
          {categories.map((item, index) => (
            <button
              key={item}
              onClick={() => setCategory((current) => (current === item ? "" : item))}
              aria-pressed={category === item}
              className={`flex min-h-[72px] items-center gap-3 px-4 py-3 text-left text-xs font-bold uppercase transition ${
                category === item
                  ? "bg-[#ff6428] text-[#17191b]"
                  : "bg-[#1e2124] text-[#f1f0eb] hover:bg-[#222629]"
              }`}
            >
              <span className={`text-[10px] font-black ${category === item ? "text-[#17191b]" : "text-[#ff6428]"}`}>
                0{index + 1}
              </span>
              <span className="flex-1">{item}</span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>

      {/* Main Catalog View: Filters & Grid */}
      <section className="container pb-16">
        {/* Subtle Staging Preview Notice */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border border-[#383e41] bg-[#1e2124] px-4 py-2.5 text-xs text-[#aeb5b6]">
          <span>
            <strong className="text-[#f1f0eb]">Демо-режим каталога:</strong> цены ориентировочные по тарифам РФ, Беларуси и Польши; наличие подтверждается менеджером по заявке.
          </span>
          <span className="shrink-0 border border-[#414749] bg-[#17191b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff865c]">
            Демо-стенд
          </span>
        </div>

        <div className="grid gap-7 lg:grid-cols-[276px_1fr]">
        <aside className="h-fit border border-[#383e41] bg-[#1e2124] p-5">
          <div className="mb-5 flex items-center justify-between border-b border-[#383e41] pb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#f1f0eb]">Фильтры</h2>
            <button
              className="text-xs font-bold uppercase tracking-wider text-[#ff6428] transition hover:text-[#f1f0eb]"
              onClick={() => {
                setFilters(emptyFilters);
                setVehicleSelection(emptyVehicleFilterSelection);
                setFitmentOnly(false);
                setCategory("");
              }}
            >
              Сбросить
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div ref={vehicleAsideRef} className="sm:col-span-2 lg:col-span-1 border-b border-[#343a3d] pb-4">
              <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ff865c]">
                Подбор по автомобилю
              </p>
              <DualModeVehicleFilter value={vehicleSelection} onChange={handleVehicleChange} />
            </div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Производитель
              <select className={selectClass} value={filters.brand} onChange={(e) => setFilter("brand", e.target.value)}>
                <option value="">Любой производитель</option>
                <option>NORTHLINE</option>
                <option>PARTS LAB</option>
                <option>MECHCORE</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Состояние
              <select className={selectClass} value={filters.condition} onChange={(e) => setFilter("condition", e.target.value)}>
                <option value="">Любое состояние</option>
                <option>Новая</option>
                <option>БУ</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Страна поставщика
              <select className={selectClass} value={filters.country} onChange={(e) => setFilter("country", e.target.value)}>
                <option value="">Любая страна</option>
                <option>Россия</option>
                <option>Беларусь</option>
                <option>Польша</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Сортировка
              <select className={selectClass} value={filters.sortBy} onChange={(e) => setFilter("sortBy", e.target.value)}>
                <option value="relevance">По релевантности</option>
                <option value="price_asc">Сначала дешевле</option>
                <option value="price_desc">Сначала дороже</option>
                <option value="newest">Новые поступления</option>
              </select>
            </label>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">Цена, ₽</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="от"
                  value={filters.minPrice}
                  onChange={(e) => setFilter("minPrice", e.target.value)}
                  className="w-full border border-[#414749] bg-[#17191b] px-2.5 py-2 text-xs font-semibold text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
                <input
                  type="number"
                  placeholder="до"
                  value={filters.maxPrice}
                  onChange={(e) => setFilter("maxPrice", e.target.value)}
                  className="w-full border border-[#414749] bg-[#17191b] px-2.5 py-2 text-xs font-semibold text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>
            </div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Наличие и архив
              <select className={selectClass} value={filters.availability} onChange={(e) => setFilter("availability", e.target.value)}>
                <option value="">Все товары (включая архив)</option>
                <option value="IN_STOCK">Только в наличии</option>
                <option value="ARCHIVED_SOLD">Вечный архив (ARCHIVED_SOLD)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-2 w-full border border-[#414749] py-2 text-center text-xs font-bold uppercase tracking-wider text-[#888b8d] transition hover:border-[#ff6428] hover:text-[#f1f0eb]"
            >
              Сбросить фильтры ↺
            </button>
          </div>
        </aside>

        <div>
          {/* Compact Selected Vehicle Context Bar */}
          {vehicleSelection.make && (
            <div
              data-testid="selected-vehicle-bar"
              className="mb-5 flex flex-col gap-3 border border-[#383e41] bg-[#1e2124] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ff6428]">
                    Выбранный автомобиль
                  </span>
                  {vehicleSelection.year && vehicleSelection.yearSemantics && YEAR_SEMANTIC_SHORT[vehicleSelection.yearSemantics] && (
                    <span className="border border-[#414749] bg-[#17191b] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#aeb5b6]">
                      {YEAR_SEMANTIC_SHORT[vehicleSelection.yearSemantics]}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-black text-[#f1f0eb]">
                  {formatVehicleSummary(vehicleSelection)}
                </p>
                <p className="mt-0.5 text-[11px] text-[#888b8d]">
                  {fitmentOnly
                    ? "Включён фильтр подтверждённой применимости (CONFIRMED)."
                    : "Показан весь ассортимент · поиск открыт, авто сохранено для заявки."}
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:items-end shrink-0">
                <label
                  data-testid="fitment-only-toggle"
                  className="inline-flex cursor-pointer items-center gap-2.5 select-none border border-[#414749] bg-[#17191b] px-3 py-2 text-xs transition hover:border-[#ff6428]"
                >
                  <input
                    type="checkbox"
                    checked={fitmentOnly}
                    onChange={(e) => setFitmentOnly(e.target.checked)}
                    className="h-4 w-4 accent-[#ff6428]"
                  />
                  <span className="font-bold text-[#f1f0eb]">
                    Только запчасти, подходящие моему автомобилю
                  </span>
                </label>

                <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => {
                      vehicleAsideRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      const inp = vehicleAsideRef.current?.querySelector("input");
                      inp?.focus();
                    }}
                    className="text-[#aeb5b6] transition hover:text-[#f1f0eb]"
                  >
                    Сменить авто
                  </button>
                  <span className="text-[#414749]">·</span>
                  <button
                    type="button"
                    data-testid="clear-selected-vehicle"
                    onClick={() => {
                      setVehicleSelection(emptyVehicleFilterSelection);
                      setFitmentOnly(false);
                      setFilters((cur) => ({ ...cur, make: "", model: "", year: "" }));
                    }}
                    className="text-[#ff6428] transition hover:text-[#f1f0eb]"
                  >
                    Очистить ×
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[#383e41] pb-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ff6428]">
                Ассортимент узлов и агрегатов
              </p>
              <h2 className="mt-1 text-xl font-black uppercase text-[#f1f0eb]">
                {category || "Все категории"}
              </h2>
            </div>
            <span className="text-xs tabular-nums text-[#888b8d]">
              Показано: <b className="text-[#f1f0eb]">{filtered.length}</b> деталей
            </span>
          </div>

          {filtered.length ? (
            <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((part) => (
                <article
                  key={part.id}
                  className="group flex h-full min-w-0 flex-col border border-[#383e41] bg-[#1e2124] transition hover:border-[#888b8d]"
                >
                  <button
                    className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#17191b]"
                    onClick={() => setSelected(part)}
                    aria-label={`Подробнее: ${part.title}`}
                  >
                    <Image
                      src={part.photo}
                      alt={`Деталь: ${part.title}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 350px"
                      className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
                    />
                    <span
                      className={`absolute right-3 top-3 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        part.badge === "ARCHIVED_SOLD"
                          ? "border border-[#ff6428]/80 bg-[#17191b] text-[#ff986f]"
                          : part.badge === "USED"
                          ? "border border-[#888b8d] bg-[#17191b] text-[#aeb5b6]"
                          : part.badge === "ANALOG"
                          ? "border border-[#888b8d] bg-[#222629] text-[#f1f0eb]"
                          : "bg-[#ff6428] text-[#17191b]"
                      }`}
                    >
                      {part.badge === "ARCHIVED_SOLD"
                        ? "АРХИВ · ПРОДАНО"
                        : part.badge === "USED"
                        ? "Б/У"
                        : part.badge === "ANALOG"
                        ? "АНАЛОГ"
                        : "ОРИГИНАЛ"}
                    </span>
                  </button>

                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#ff6428]">
                      {part.category}
                    </p>
                    <button
                      onClick={() => setSelected(part)}
                      className="mt-2 min-h-10 text-left text-sm font-black leading-5 text-[#f1f0eb] transition hover:text-[#ff6428]"
                    >
                      {part.title}
                    </button>
                    <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-[#888b8d]">OEM / артикул</dt>
                      <dd className="text-right font-mono text-[#f1f0eb]">{part.oem}</dd>
                      <dt className="text-[#888b8d]">Производитель</dt>
                      <dd className="text-right text-[#f1f0eb]">{part.brand}</dd>
                      <dt className="text-[#888b8d]">Состояние</dt>
                      <dd className="text-right text-[#f1f0eb]">{part.condition}</dd>
                      <dt className="text-[#888b8d]">Страна</dt>
                      <dd className="text-right text-[#f1f0eb]">{part.country}</dd>
                    </dl>
                    <div className="mt-auto border-t border-[#383e41] pt-3 flex items-baseline justify-between">
                      <p className="text-xs font-black tabular-nums text-[#ff6428]">
                        {part.badge === "ARCHIVED_SOLD" ? (
                          <span className="text-[#ff986f]">Архивный лот (продан)</span>
                        ) : part.price === null ? (
                          "По запросу"
                        ) : (
                          <>
                            {part.offersCount && part.offersCount > 1 ? "от " : ""}
                            {part.price.toLocaleString("ru-RU")} ₽
                          </>
                        )}
                      </p>
                      {part.offersCount !== undefined && part.offersCount > 1 && (
                        <span className="text-[10px] text-[#888b8d]">
                          {part.offersCount} предлож.
                        </span>
                      )}
                    </div>
                    {part.badge === "ARCHIVED_SOLD" ? (
                      <button
                        onClick={() => findAnalog(part.oem)}
                        className="mt-3 min-h-10 w-full border border-[#ff6428] bg-[#ff6428] px-4 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
                      >
                        Найти аналог по OEM ↗
                      </button>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button
                          data-action="add-to-cart"
                          data-part-id={part.id}
                          onClick={() => handleAddToCart(part)}
                          className="flex-1 min-h-10 bg-[#ff6428] px-3 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
                        >
                          + В заявку
                        </button>
                        <button
                          onClick={() => setSelected(part)}
                          className="min-h-10 border border-[#414749] px-3 text-xs font-bold uppercase text-[#f1f0eb] transition hover:border-[#ff6428]"
                          title="Подробнее"
                        >
                          Инфо
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div data-testid="catalog-empty-state" className="border border-dashed border-[#414749] bg-[#1e2124] px-6 py-12 text-center">
              <p className="text-base font-bold text-[#f1f0eb]">
                {fitmentOnly && vehicleSelection.make
                  ? `Подтверждённых запчастей для ${vehicleSelection.make}${vehicleSelection.model ? ` ${vehicleSelection.model}` : ""} в быстром наличии пока нет`
                  : "По заданным фильтрам совпадений не найдено"}
              </p>
              <p className="mt-2 mx-auto max-w-lg text-xs text-[#888b8d]">
                {fitmentOnly && vehicleSelection.make
                  ? "Переключатель совместимости показывает только детали с подтверждённой применимостью (CONFIRMED). Вы можете показать весь ассортимент каталога или отправить заявку на индивидуальный подбор — менеджер найдёт деталь под ваш автомобиль."
                  : "Попробуйте изменить поисковый запрос, артикул или сбросить фильтры."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {fitmentOnly && (
                  <button
                    type="button"
                    data-testid="disable-fitment-only-btn"
                    onClick={() => setFitmentOnly(false)}
                    className="border border-[#ff6428]/70 bg-[#17191b] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#ff865c] transition hover:border-[#ff6428] hover:text-[#f1f0eb]"
                  >
                    Показать весь каталог
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="border border-[#414749] bg-[#17191b] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] transition hover:border-[#ff6428]"
                >
                  Сбросить фильтры ↺
                </button>
                <button
                  type="button"
                  onClick={() => openRequest(null)}
                  className="bg-[#ff6428] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050]"
                >
                  Оставить заявку на подбор →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>

      {/* Direct Intake Banner */}
      <section className="border-y border-[#383e41] bg-[#1e2124] py-10">
        <div className="container flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ff6428]">
              Индивидуальный подбор
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-[#f1f0eb]">
              Не нашли нужную деталь?
            </h2>
            <p className="mt-2 text-sm text-[#888b8d]">
              Специалисты ZAPTUT.PRO проверят наличие по складам в РФ, Беларуси и на польских разборках.
            </p>
          </div>
          <button
            onClick={() => openRequest(null)}
            className="min-h-12 shrink-0 bg-[#ff6428] px-6 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
          >
            Оставить заявку на подбор →
          </button>
        </div>
      </section>

      {/* Modals */}
      {(selected || requestOpen) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => {
            setSelected(null);
            setRequestOpen(false);
            setRequestMessage("");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="my-auto w-full max-w-xl border border-[#414749] bg-[#1e2124] p-5 sm:p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#383e41] pb-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
                      Карточка детали
                    </p>
                    <h2 className="mt-1 text-lg font-black uppercase text-[#f1f0eb]">{selected.title}</h2>
                  </div>
                  <button
                    aria-label="Закрыть"
                    onClick={() => setSelected(null)}
                    className="text-2xl font-bold text-[#888b8d] hover:text-[#f1f0eb]"
                  >
                    ×
                  </button>
                </div>
                <div className="relative mt-4 aspect-video overflow-hidden border border-[#383e41] bg-[#17191b]">
                  <Image src={selected.photo} alt={`Деталь: ${selected.title}`} fill sizes="600px" className="object-cover" />
                </div>
                {selected.badge === "ARCHIVED_SOLD" && (
                  <div className="mt-4 border border-[#ff6428]/40 bg-[#17191b] p-3 text-xs">
                    <p className="font-extrabold uppercase tracking-wider text-[#ff986f]">
                      Товар продан и перенесён в вечный архив
                    </p>
                    <p className="mt-1 text-[11px] text-[#888b8d]">
                      Карточка сохранена для сверки OEM, характеристик и геометрических параметров. Вы можете запустить поиск совместимого аналога.
                    </p>
                  </div>
                )}
                <p className="mt-4 text-xs leading-6 text-[#888b8d]">{selected.description}</p>
                <div className="mt-3 border-t border-[#383e41] pt-3 text-xs text-[#f1f0eb]">
                  OEM: <b className="font-mono text-[#ff6428]">{selected.oem}</b> · {selected.brand} · {selected.condition} · {selected.country}
                </div>
                {selected.offers && selected.offers.length > 0 && (
                  <div className="mt-4 border border-[#383e41] bg-[#17191b] p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
                      Предложения проверенных поставщиков ({selected.offers.length})
                    </p>
                    <div className="mt-2 divide-y divide-[#383e41]">
                      {selected.offers.map((offer) => (
                        <div key={offer.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 text-xs">
                          <div>
                            <span className="font-bold text-[#f1f0eb]">{offer.supplierCountry}</span>
                            <span className="text-[#888b8d]"> · {offer.condition}</span>
                            {offer.deliveryTerms && (
                              <p className="text-[11px] text-[#888b8d]">{offer.deliveryTerms}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-black text-[#ff6428]">
                              {offer.status === "ARCHIVED_SOLD"
                                ? "Лот продан"
                                : offer.publicPrice !== null
                                ? `${offer.publicPrice.toLocaleString("ru-RU")} ₽`
                                : "По запросу"}
                            </span>
                            <span className={`block text-[10px] ${offer.status === "IN_STOCK" ? "text-emerald-400 font-bold" : "text-[#888b8d]"}`}>
                              {offer.status === "IN_STOCK" ? "В наличии" : offer.status === "ARCHIVED_SOLD" ? "Архив" : "Под заказ"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selected.badge === "ARCHIVED_SOLD" ? (
                  <button
                    className="mt-5 min-h-11 w-full bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
                    onClick={() => findAnalog(selected.oem)}
                  >
                    Найти аналог по OEM ({selected.oem}) →
                  </button>
                ) : (
                  <button
                    className="mt-5 min-h-11 w-full bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
                    onClick={() => {
                      handleAddToCart(selected);
                      setSelected(null);
                    }}
                  >
                    + Добавить деталь в заявку
                  </button>
                )}
              </>
            ) : requestMessage ? (
              <>
                <p role="status" className="text-base font-bold text-[#f1f0eb]">{requestMessage}</p>
                <p className="mt-2 text-xs text-[#888b8d]">Менеджер ZAPTUT.PRO свяжется с вами для уточнения деталей.</p>
                <button
                  onClick={() => {
                    setRequestOpen(false);
                    setRequestPart(null);
                    setRequestMessage("");
                  }}
                  className="mt-5 min-h-10 border border-[#414749] px-5 py-2 text-xs font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428]"
                >
                  Закрыть
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#383e41] pb-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
                      Запрос на подбор
                    </p>
                    <h2 className="mt-1 text-lg font-black uppercase text-[#f1f0eb]">
                      {requestPart ? requestPart.title : "Индивидуальный подбор детали"}
                    </h2>
                  </div>
                  <button
                    aria-label="Закрыть"
                    onClick={() => setRequestOpen(false)}
                    className="text-2xl font-bold text-[#888b8d] hover:text-[#f1f0eb]"
                  >
                    ×
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setRequestMessage("Запрос успешно зарегистрирован.");
                  }}
                  className="mt-5 grid gap-4"
                >
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Имя *
                    <input required className={selectClass} placeholder="Как к вам обращаться" />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Телефон или email *
                    <input required className={selectClass} placeholder="Контакт для связи" />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Комментарий
                    <textarea
                      className={`${selectClass} min-h-24 resize-y`}
                      defaultValue={
                        vehicleSelection.make
                          ? `Автомобиль: ${formatVehicleSummary(vehicleSelection)}\nТребуемая деталь: `
                          : ""
                      }
                      placeholder="Автомобиль, VIN, требования по детали"
                    />
                  </label>
                  <button className="min-h-12 bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]">
                    Отправить запрос на подбор →
                  </button>
                  <p className="text-[11px] leading-relaxed text-[#888b8d]">
                    Нажимая «Отправить запрос», вы соглашаетесь с{" "}
                    <Link
                      href="/consent"
                      target="_blank"
                      className="text-[#f1f0eb] underline decoration-[#ff6428] underline-offset-2 transition hover:text-[#ff865c]"
                    >
                      условиями обработки персональных данных
                    </Link>{" "}
                    и{" "}
                    <Link
                      href="/privacy-policy"
                      target="_blank"
                      className="text-[#f1f0eb] underline decoration-[#ff6428] underline-offset-2 transition hover:text-[#ff865c]"
                    >
                      политикой конфиденциальности
                    </Link>
                    .
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-3 border border-[#ff6428] bg-[#17191b] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#f1f0eb] shadow-2xl transition hover:bg-[#222629]"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ff6428] text-xs font-black text-[#17191b]">
              {totalCartCount}
            </span>
            <span>Оформить заявку →</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CatalogCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        defaultVehicle={{
          make: vehicleSelection.make,
          model: vehicleSelection.model,
          year: vehicleSelection.year,
        }}
      />

      {/* Footer */}
      <footer className="border-t border-[#383e41] bg-[#17191b] py-7">
        <div className="container flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <Link href="/" aria-label="ZAPTUT.PRO — на главную" className="block w-[170px]">
            <BrandLogo variant="dark" className="w-full" sizes="170px" />
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#888b8d]">
            <span>© 2026 · ZAPTUT.PRO</span>
            <Link href="/privacy-policy" className="hover:text-[#f1f0eb] transition">
              Политика конфиденциальности (152-ФЗ)
            </Link>
            <Link href="/consent" className="hover:text-[#f1f0eb] transition">
              Согласие на обработку данных
            </Link>
            <Link href="/terms" className="hover:text-[#f1f0eb] transition">
              Оферта и условия
            </Link>
          </div>
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-[#ff6428] hover:text-[#f1f0eb]">
            На главную ↑
          </Link>
        </div>
      </footer>
    </main>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#17191b]">
          <BrandLoader phase="loading" label="Загрузка каталога..." />
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}
