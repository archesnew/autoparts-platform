"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SignOutButton } from "@/components/admin/sign-out-button";
import type { SupplierContext } from "@/lib/server/supplier-session";

type Tab = "dashboard" | "products" | "import" | "profile";

type DashboardData = {
  activeOffersCount: number;
  outOfStockOffersCount: number;
  archivedOffersCount: number;
  totalProductsCount: number;
  latestJobs: {
    id: string;
    fileName: string;
    fileFormat: string;
    status: string;
    totalRows: number;
    validRows: number;
    errorRows: number;
    duplicateRows: number;
    createdAt: string;
  }[];
  priceFreshness: {
    freshOffersCount: number;
    staleOffersCount: number;
    freshPercentage: number;
  };
};

type OfferItem = {
  id: string;
  productId: string;
  canonicalName: string;
  primaryOem: string;
  brand: string;
  category: string;
  photos: string[];
  originalTitle: string;
  rawArticle: string | null;
  purchasePrice: number | null;
  currency: string;
  quantity: number;
  condition: "NEW" | "USED";
  status: "IN_STOCK" | "ON_REQUEST" | "OUT_OF_STOCK" | "ARCHIVED_SOLD";
  deliveryTerms: string | null;
  deliveryDays: number | null;
  sourceUrl: string | null;
  lastSeenAt: string;
  updatedAt: string;
};

type ProfileData = {
  id: string;
  name: string;
  legalName: string | null;
  innOrVat: string | null;
  countryCode: string;
  city: string | null;
  warehouseAddress: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  specialization: string | null;
  terms: string | null;
  deliveryMethods: string[];
  pickupAvailable: boolean;
  orderProcessingDays: number;
  supportedCurrencies: string[];
  status: string;
};

type ImportJobItem = {
  id: string;
  fileName: string;
  fileFormat: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  newProductsCount: number;
  updatedOffersCount: number;
  createdAt: string;
};

type ImportRowItem = {
  id: string;
  rowIndex: number;
  externalId: string | null;
  rawOem: string | null;
  normalizedOem: string | null;
  title: string;
  brand: string | null;
  price: string | null;
  currency: string;
  quantity: number;
  condition: string;
  status: string;
  matchType: string;
  errors: string[];
};

export function SupplierClientPage({
  initialContext,
}: {
  initialContext: SupplierContext;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [toast, setToast] = useState<string | null>(null);

  // Dashboard state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Products state
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [totalOffers, setTotalOffers] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [productStatus, setProductStatus] = useState<string>("");
  const [productCondition, setProductCondition] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [editingOffer, setEditingOffer] = useState<OfferItem | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editDays, setEditDays] = useState("");
  const [editStatus, setEditStatus] = useState<OfferItem["status"]>("IN_STOCK");

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSource, setImportSource] = useState("RU_DISMANTLE");
  const [importFormat, setImportFormat] = useState("");
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [isFullFeed, setIsFullFeed] = useState(false);
  const [archiveMissing, setArchiveMissing] = useState(false);
  const [activeJob, setActiveJob] = useState<ImportJobItem | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportRowItem[]>([]);
  const [importHistory, setImportHistory] = useState<ImportJobItem[]>([]);

  // Profile state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load Dashboard
  function loadDashboard() {
    setLoadingDashboard(true);
    fetch("/api/supplier/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.metrics) {
          setDashboard(data.metrics);
        }
      })
      .catch((e) => console.error("Error loading dashboard:", e))
      .finally(() => setLoadingDashboard(false));
  }

  // Load Offers
  function loadOffers() {
    setLoadingOffers(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
    });
    if (productSearch) params.set("q", productSearch);
    if (productStatus) params.set("status", productStatus);
    if (productCondition) params.set("condition", productCondition);

    fetch(`/api/supplier/offers?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.items)) {
          setOffers(data.items);
          setTotalOffers(data.total);
        }
      })
      .catch((e) => console.error("Error loading offers:", e))
      .finally(() => setLoadingOffers(false));
  }

  // Load Import History
  function loadImportHistory() {
    fetch("/api/supplier/import/jobs")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.jobs)) {
          setImportHistory(data.jobs);
        }
      })
      .catch((e) => console.error("Error loading import history:", e));
  }

  // Load Profile
  function loadProfile() {
    fetch("/api/supplier/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.profile) {
          setProfile(data.profile);
        }
      })
      .catch((e) => console.error("Error loading profile:", e));
  }

  useEffect(() => {
    loadDashboard();
    loadOffers();
    loadImportHistory();
    loadProfile();
  }, []);

  useEffect(() => {
    if (tab === "products") {
      loadOffers();
    }
  }, [tab, page, productStatus, productCondition]);

  // Handle Offer Edit
  function openEditModal(offer: OfferItem) {
    setEditingOffer(offer);
    setEditPrice(String(offer.purchasePrice || ""));
    setEditQty(String(offer.quantity));
    setEditDays(String(offer.deliveryDays || "1"));
    setEditStatus(offer.status);
  }

  async function handleSaveOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOffer) return;

    try {
      const res = await fetch(`/api/supplier/offers/${editingOffer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchasePrice: parseFloat(editPrice) || 0,
          quantity: parseInt(editQty, 10) || 0,
          deliveryDays: parseInt(editDays, 10) || 1,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить предложение");

      setToast("Предложение успешно обновлено");
      setEditingOffer(null);
      loadOffers();
      loadDashboard();
    } catch (err: any) {
      alert(err.message || "Ошибка обновления");
    }
  }

  // Handle Feed Upload
  async function handleUploadFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) {
      alert("Выберите файл прайс-листа");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("source", importSource);
    if (importFormat) formData.append("forcedFormat", importFormat);

    try {
      const res = await fetch("/api/supplier/import/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки фида");

      setActiveJob(data.job);
      setPreviewRows(data.previewRows || []);
      setToast("Фид успешно проанализирован");
      loadImportHistory();
    } catch (err: any) {
      alert(err.message || "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  // Handle Commit Import
  async function handleCommitImport() {
    if (!activeJob) return;
    setCommitting(true);

    try {
      const res = await fetch(`/api/supplier/import/jobs/${activeJob.id}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFullFeed, archiveMissing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения каталога");

      const archivedText = data.result.archivedOffers
        ? `, архивировано проданных: ${data.result.archivedOffers}`
        : "";
      setToast(
        `Импорт завершён: новых товаров +${data.result.createdProducts}, обновлено предложений +${
          data.result.createdOffers + data.result.updatedOffers
        }${archivedText}`
      );
      setActiveJob(null);
      setPreviewRows([]);
      setImportFile(null);
      loadDashboard();
      loadOffers();
      loadImportHistory();
    } catch (err: any) {
      alert(err.message || "Ошибка применения импорта");
    } finally {
      setCommitting(false);
    }
  }

  // Handle Profile Save
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);

    try {
      const res = await fetch("/api/supplier/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения профиля");

      setProfile(data.profile);
      setToast("Профиль компании успешно сохранён");
    } catch (err: any) {
      alert(err.message || "Ошибка сохранения");
    } finally {
      setSavingProfile(false);
    }
  }

  const inputClass =
    "mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]";
  const selectClass =
    "mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]";

  return (
    <div className="min-h-screen bg-[#17191b] text-[#f1f0eb]">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 border border-[#ff6428] bg-[#202325] px-4 py-3 text-xs font-bold text-[#f1f0eb] shadow-xl">
          {toast}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#343a3d] bg-[#1c1f21] p-5 lg:flex">
          <div className="mb-6">
            <BrandLogo variant="dark" className="w-36" sizes="144px" />
            <div className="mt-3 flex items-center gap-2">
              <span className="border border-[#ff6428]/50 bg-[#ff6428]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ff865c]">
                Кабинет поставщика
              </span>
              <span className="text-[10px] uppercase text-[#888b8d]">
                {initialContext.supplierCountryCode}
              </span>
            </div>
            <p className="mt-2 truncate text-xs font-bold text-[#f1f0eb]">
              {initialContext.supplierName}
            </p>
          </div>

          <nav className="grid gap-1">
            {[
              ["dashboard", "Сводка", "📊"],
              ["products", "Мои товары", "📦"],
              ["import", "Импорт прайсов", "📥"],
              ["profile", "Профиль компании", "🏢"],
            ].map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-left text-xs font-bold transition ${
                  tab === id
                    ? "border-[#ff6428] bg-[#2a2e31] text-[#f1f0eb]"
                    : "border-transparent text-[#aeb5b6] hover:bg-[#24282b] hover:text-[#f1f0eb]"
                }`}
              >
                <span>{icon}</span>
                {label}
                {id === "products" && totalOffers > 0 && (
                  <span className="ml-auto text-[10px] text-[#888b8d]">{totalOffers}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-[#383e41] pt-4">
            <Link
              href="/catalog"
              className="block text-[11px] text-[#aeb5b6] hover:text-[#ff865c]"
            >
              ← Витрина каталога
            </Link>
            <p className="mt-2 text-[10px] text-[#747d80]">
              ZAPTUT.PRO · Supplier Portal
              <br />
              Изолированный доступ к прайсу
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between border-b border-[#343a3d] bg-[#17191b]/95 px-4 backdrop-blur sm:px-8">
            <div className="flex items-center gap-3">
              <span className="text-sm font-extrabold uppercase tracking-wide">
                {tab === "dashboard" && "Сводка поставщика"}
                {tab === "products" && "Мои предложения в каталоге"}
                {tab === "import" && "Импорт прайс-листа"}
                {tab === "profile" && "Профиль и условия работы"}
              </span>
              <span className="border border-emerald-500/40 bg-emerald-950/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                {initialContext.supplierStatus === "ACTIVE" ? "Активен" : initialContext.supplierStatus}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-xs font-bold text-[#f1f0eb]">
                  {initialContext.name}
                </span>
                <span className="block text-[10px] text-[#888b8d]">
                  {initialContext.role === "OWNER" ? "Владелец" : "Менеджер"} ·{" "}
                  {initialContext.email}
                </span>
              </div>
              <SignOutButton />
            </div>
          </header>

          {/* Tab Content */}
          <main className="mx-auto max-w-7xl p-4 sm:p-8">
            {/* 1. DASHBOARD */}
            {tab === "dashboard" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff6428]">
                    Статистика поставщика
                  </p>
                  <h1 className="mt-1 text-2xl font-black uppercase sm:text-3xl">
                    {initialContext.supplierName}
                  </h1>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="border border-[#383e41] bg-[#1e2124] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Активных предложений
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#f1f0eb]">
                      {dashboard?.activeOffersCount ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-[#888b8d]">доступно в поиске агрегатора</p>
                  </div>

                  <div className="border border-[#383e41] bg-[#1e2124] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Уникальных товаров
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#f1f0eb]">
                      {dashboard?.totalProductsCount ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-[#888b8d]">карточек деталей с вашим наличием</p>
                  </div>

                  <div className="border border-[#383e41] bg-[#1e2124] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Актуальность прайса
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#ff865c]">
                      {dashboard?.priceFreshness.freshPercentage ?? 100}%
                    </p>
                    <p className="mt-1 text-xs text-[#888b8d]">обновлено за последние 7 дней</p>
                  </div>

                  <div className="border border-[#383e41] bg-[#1e2124] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Архив и под заказ
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#888b8d]">
                      {(dashboard?.outOfStockOffersCount ?? 0) +
                        (dashboard?.archivedOffersCount ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-[#888b8d]">позиций снято с продажи</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setTab("import")}
                    className="bg-[#ff6428] px-5 py-2.5 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45]"
                  >
                    Загрузить новый прайс-лист →
                  </button>
                  <button
                    onClick={() => setTab("products")}
                    className="border border-[#4c5457] px-5 py-2.5 text-xs font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428]"
                  >
                    Управление товарами
                  </button>
                </div>

                {/* Latest Jobs Table */}
                <section className="border border-[#383e41] bg-[#1e2124]">
                  <div className="border-b border-[#383e41] p-4">
                    <h2 className="text-xs font-black uppercase tracking-wider">
                      История последних загрузок
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#292e30] text-[10px] uppercase text-[#888b8d]">
                        <tr>
                          <th className="p-3">Файл</th>
                          <th className="p-3">Формат</th>
                          <th className="p-3">Строк</th>
                          <th className="p-3">Валидных</th>
                          <th className="p-3">Ошибок</th>
                          <th className="p-3">Статус</th>
                          <th className="p-3">Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard?.latestJobs.map((j) => (
                          <tr key={j.id} className="border-t border-[#383e41]">
                            <td className="p-3 font-semibold">{j.fileName}</td>
                            <td className="p-3 uppercase">{j.fileFormat}</td>
                            <td className="p-3 tabular-nums">{j.totalRows}</td>
                            <td className="p-3 tabular-nums text-emerald-400">{j.validRows}</td>
                            <td className="p-3 tabular-nums text-red-400">{j.errorRows}</td>
                            <td className="p-3">
                              <span className="border border-[#4c5457] px-1.5 py-0.5 text-[9px] font-bold">
                                {j.status}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-[#888b8d]">
                              {new Intl.DateTimeFormat("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(j.createdAt))}
                            </td>
                          </tr>
                        ))}
                        {(!dashboard?.latestJobs || dashboard.latestJobs.length === 0) && (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-xs text-[#888b8d]">
                              Пока нет загруженных прайс-листов.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* 2. MY GOODS */}
            {tab === "products" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff6428]">
                      Каталог наличия
                    </p>
                    <h1 className="mt-1 text-2xl font-black uppercase">Мои товары</h1>
                  </div>
                  <span className="text-xs text-[#888b8d]">
                    Всего предложений: <b className="text-[#f1f0eb]">{totalOffers}</b>
                  </span>
                </div>

                {/* Filters */}
                <div className="grid gap-3 border border-[#383e41] bg-[#1e2124] p-4 sm:grid-cols-3">
                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Поиск по OEM, артикулу или названию
                    <input
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setPage(1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") loadOffers();
                      }}
                      placeholder="Например: 51712-C1A00..."
                      className={inputClass}
                    />
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Статус наличия
                    <select
                      value={productStatus}
                      onChange={(e) => {
                        setProductStatus(e.target.value);
                        setPage(1);
                      }}
                      className={selectClass}
                    >
                      <option value="">Все статусы</option>
                      <option value="IN_STOCK">В наличии (IN_STOCK)</option>
                      <option value="ON_REQUEST">Под заказ (ON_REQUEST)</option>
                      <option value="OUT_OF_STOCK">Нет в наличии (OUT_OF_STOCK)</option>
                      <option value="ARCHIVED_SOLD">Продано / Архив (ARCHIVED_SOLD)</option>
                    </select>
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Состояние детали
                    <select
                      value={productCondition}
                      onChange={(e) => {
                        setProductCondition(e.target.value);
                        setPage(1);
                      }}
                      className={selectClass}
                    >
                      <option value="">Любое состояние</option>
                      <option value="NEW">Новая (NEW)</option>
                      <option value="USED">БУ (USED)</option>
                    </select>
                  </label>
                </div>

                {/* Offers Table */}
                <div className="border border-[#383e41] bg-[#1e2124] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#292e30] text-[10px] uppercase text-[#888b8d]">
                      <tr>
                        <th className="p-3">OEM / Карточка детали</th>
                        <th className="p-3">Ваш артикул</th>
                        <th className="p-3">Состояние</th>
                        <th className="p-3">Ваша цена</th>
                        <th className="p-3">Остаток</th>
                        <th className="p-3">Срок</th>
                        <th className="p-3">Статус</th>
                        <th className="p-3 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map((o) => (
                        <tr key={o.id} className="border-t border-[#383e41] hover:bg-[#25282b]">
                          <td className="p-3">
                            <span className="font-bold text-[#f1f0eb]">{o.canonicalName}</span>
                            <small className="block text-[11px] text-[#ff865c]">
                              OEM: {o.primaryOem} · {o.brand}
                            </small>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-[#888b8d]">
                            {o.rawArticle || "—"}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                o.condition === "NEW"
                                  ? "bg-emerald-950/40 text-emerald-400"
                                  : "bg-amber-950/40 text-amber-400"
                              }`}
                            >
                              {o.condition === "NEW" ? "Новая" : "БУ"}
                            </span>
                          </td>
                          <td className="p-3 font-bold tabular-nums text-[#f1f0eb]">
                            {o.purchasePrice ? `${o.purchasePrice} ${o.currency}` : "—"}
                          </td>
                          <td className="p-3 tabular-nums">{o.quantity} шт.</td>
                          <td className="p-3">{o.deliveryDays ? `${o.deliveryDays} дн.` : "1 дн."}</td>
                          <td className="p-3">
                            <span
                              className={`border px-1.5 py-0.5 text-[9px] font-bold ${
                                o.status === "IN_STOCK"
                                  ? "border-emerald-600/50 text-emerald-400"
                                  : o.status === "ON_REQUEST"
                                  ? "border-sky-600/50 text-sky-400"
                                  : "border-neutral-600 text-neutral-400"
                              }`}
                            >
                              {o.status === "IN_STOCK"
                                ? "В наличии"
                                : o.status === "ON_REQUEST"
                                ? "Под заказ"
                                : o.status === "ARCHIVED_SOLD"
                                ? "Архив / Продано"
                                : "Нет на складе"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => openEditModal(o)}
                              className="border border-[#4c5457] px-2 py-1 text-[10px] font-bold uppercase hover:border-[#ff6428] hover:text-[#ff865c]"
                            >
                              Изменить
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!loadingOffers && offers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-xs text-[#888b8d]">
                            Предложения не найдены. Загрузите фид прайс-листа или измените фильтры.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Edit Modal */}
                {editingOffer && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
                    <form
                      onSubmit={handleSaveOffer}
                      className="w-full max-w-md border border-[#4c5457] bg-[#202325] p-6"
                    >
                      <h3 className="text-sm font-black uppercase text-[#f1f0eb]">
                        Редактирование предложения
                      </h3>
                      <p className="mt-1 text-xs text-[#888b8d]">
                        {editingOffer.canonicalName} (OEM {editingOffer.primaryOem})
                      </p>

                      <div className="mt-4 space-y-3">
                        <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
                          Цена ({editingOffer.currency}) *
                          <input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            required
                            className={inputClass}
                          />
                        </label>

                        <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
                          Количество в наличии (шт.) *
                          <input
                            type="number"
                            min="0"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            required
                            className={inputClass}
                          />
                        </label>

                        <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
                          Срок отгрузки (дней) *
                          <input
                            type="number"
                            min="0"
                            value={editDays}
                            onChange={(e) => setEditDays(e.target.value)}
                            required
                            className={inputClass}
                          />
                        </label>

                        <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
                          Статус позиции
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                            className={selectClass}
                          >
                            <option value="IN_STOCK">В наличии (IN_STOCK)</option>
                            <option value="ON_REQUEST">Под заказ (ON_REQUEST)</option>
                            <option value="OUT_OF_STOCK">Нет на складе (OUT_OF_STOCK)</option>
                            <option value="ARCHIVED_SOLD">Продано / Снято (ARCHIVED_SOLD)</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-6 flex justify-end gap-2 border-t border-[#383e41] pt-4">
                        <button
                          type="button"
                          onClick={() => setEditingOffer(null)}
                          className="border border-[#4c5457] px-4 py-2 text-xs font-bold uppercase text-[#888b8d] hover:text-[#f1f0eb]"
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          className="bg-[#ff6428] px-4 py-2 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45]"
                        >
                          Сохранить
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* 3. FEED IMPORT */}
            {tab === "import" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff6428]">
                    Автоматизация прайса
                  </p>
                  <h1 className="mt-1 text-2xl font-black uppercase">Импорт прайс-листов</h1>
                  <p className="mt-1 text-xs text-[#888b8d]">
                    Загрузка предложений поставщика {initialContext.supplierName}. Привязка
                    осуществляется автоматически к вашему аккаунту.
                  </p>
                </div>

                {/* Upload Section */}
                <section className="border border-[#383e41] bg-[#1e2124] p-5">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#f1f0eb]">
                    Загрузка файла прайс-листа
                  </h2>
                  <form
                    onSubmit={handleUploadFeed}
                    className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Источник наличия *
                      <select
                        value={importSource}
                        onChange={(e) => setImportSource(e.target.value)}
                        className={selectClass}
                      >
                        <option value="RU_DISMANTLE">Разборка РФ (RU_DISMANTLE)</option>
                        <option value="BY_DISMANTLE">Разборка РБ (BY_DISMANTLE)</option>
                        <option value="LOCAL_STOCK">Собственный склад (LOCAL_STOCK)</option>
                        <option value="MANUAL">Ручной прайс (MANUAL)</option>
                      </select>
                    </label>

                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Формат фида
                      <select
                        value={importFormat}
                        onChange={(e) => setImportFormat(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Автоопределение формата</option>
                        <option value="YML">YML (Яндекс.Маркет / Дром)</option>
                        <option value="XML">XML (Авито / Универсальный)</option>
                        <option value="CSV">CSV (разделители , / ; / tab)</option>
                        <option value="XLSX">XLSX (Книга Excel)</option>
                      </select>
                    </label>

                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Файл для импорта *
                      <input
                        type="file"
                        accept=".yml,.xml,.csv,.xlsx,.xls"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        required
                        className="mt-1 block w-full text-xs text-[#888b8d] file:mr-3 file:border-0 file:bg-[#ff6428] file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:text-[#17191b] hover:file:bg-[#ff7a45]"
                      />
                    </label>

                    <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={uploading}
                        className="min-h-10 bg-[#ff6428] px-6 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45] disabled:opacity-50"
                      >
                        {uploading ? "Анализируем фид..." : "Загрузить и проверить →"}
                      </button>
                    </div>
                  </form>
                </section>

                {/* Staged Preview Section */}
                {activeJob && (
                  <section className="border border-[#ff6428] bg-[#1e2124] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#383e41] pb-4">
                      <div>
                        <span className="border border-[#ff6428] bg-[#ff6428]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ff865c]">
                          Предварительный просмотр
                        </span>
                        <h2 className="mt-1 text-sm font-black uppercase text-[#f1f0eb]">
                          {activeJob.fileName} ({activeJob.fileFormat})
                        </h2>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-[#cbd0d1] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isFullFeed}
                            onChange={(e) => {
                              setIsFullFeed(e.target.checked);
                              if (!e.target.checked) setArchiveMissing(false);
                            }}
                            className="h-4 w-4 accent-[#ff6428]"
                          />
                          <span>Полная выгрузка склада</span>
                        </label>
                        {isFullFeed && (
                          <label className="flex items-center gap-2 text-xs text-amber-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={archiveMissing}
                              onChange={(e) => setArchiveMissing(e.target.checked)}
                              className="h-4 w-4 accent-amber-500"
                            />
                            <span>Архивировать (проданные) отсутствующие позиции</span>
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActiveJob(null);
                              setPreviewRows([]);
                            }}
                            className="border border-[#4c5457] px-4 py-2 text-xs font-bold uppercase text-[#888b8d] hover:text-[#f1f0eb]"
                          >
                            Сбросить
                          </button>
                          <button
                            id="supplier-commit-btn"
                            onClick={handleCommitImport}
                            disabled={committing}
                            className="bg-[#ff6428] px-6 py-2 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45] disabled:opacity-50"
                          >
                            {committing ? "Сохраняем в каталог..." : "Подтвердить импорт в базу →"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Staged KPI */}
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-[#888b8d]">Всего строк</p>
                        <p className="text-xl font-black">{activeJob.totalRows}</p>
                      </div>
                      <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-emerald-400">Готовы</p>
                        <p className="text-xl font-black text-emerald-400">{activeJob.validRows}</p>
                      </div>
                      <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-red-400">Ошибки</p>
                        <p className="text-xl font-black text-red-400">{activeJob.errorRows}</p>
                      </div>
                      <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-amber-400">Дубликаты</p>
                        <p className="text-xl font-black text-amber-400">{activeJob.duplicateRows}</p>
                      </div>
                      <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-sky-400">Новые товары</p>
                        <p className="text-xl font-black text-sky-400">{activeJob.newProductsCount}</p>
                      </div>
                      <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-purple-400">Обновление</p>
                        <p className="text-xl font-black text-purple-400">{activeJob.updatedOffersCount}</p>
                      </div>
                    </div>

                    {/* Preview Table */}
                    <div className="mt-4 max-h-80 overflow-y-auto border border-[#383e41]">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-[#292e30] text-[9px] uppercase text-[#888b8d]">
                          <tr>
                            <th className="p-2">#</th>
                            <th className="p-2">OEM</th>
                            <th className="p-2">Наименование</th>
                            <th className="p-2">Бренд</th>
                            <th className="p-2">Цена</th>
                            <th className="p-2">Остаток</th>
                            <th className="p-2">Состояние</th>
                            <th className="p-2">Статус проверки</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((r) => (
                            <tr key={r.id} className="border-t border-[#383e41] hover:bg-[#25282b]">
                              <td className="p-2 tabular-nums text-[#888b8d]">{r.rowIndex}</td>
                              <td className="p-2 font-mono font-bold text-[#ff865c]">
                                {r.normalizedOem || r.rawOem || "—"}
                              </td>
                              <td className="p-2 font-medium">{r.title}</td>
                              <td className="p-2 text-[#888b8d]">{r.brand || "—"}</td>
                              <td className="p-2 tabular-nums font-bold">
                                {r.price ? `${r.price} ${r.currency}` : "—"}
                              </td>
                              <td className="p-2 tabular-nums">{r.quantity} шт.</td>
                              <td className="p-2 uppercase text-[10px]">{r.condition}</td>
                              <td className="p-2">
                                <span
                                  className={`px-1.5 py-0.5 text-[9px] font-bold ${
                                    r.status === "VALID"
                                      ? "bg-emerald-950/40 text-emerald-400"
                                      : "bg-red-950/40 text-red-400"
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Import History */}
                <section className="border border-[#383e41] bg-[#1e2124]">
                  <div className="border-b border-[#383e41] p-4">
                    <h2 className="text-xs font-black uppercase tracking-wider">
                      История всех загрузок поставщика
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#292e30] text-[10px] uppercase text-[#888b8d]">
                        <tr>
                          <th className="p-3">Файл</th>
                          <th className="p-3">Формат</th>
                          <th className="p-3">Всего строк</th>
                          <th className="p-3">Новых</th>
                          <th className="p-3">Обновлено</th>
                          <th className="p-3">Ошибок</th>
                          <th className="p-3">Статус</th>
                          <th className="p-3">Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importHistory.map((j) => (
                          <tr key={j.id} className="border-t border-[#383e41]">
                            <td className="p-3 font-semibold">{j.fileName}</td>
                            <td className="p-3 uppercase text-[10px]">{j.fileFormat}</td>
                            <td className="p-3 tabular-nums">{j.totalRows}</td>
                            <td className="p-3 tabular-nums text-sky-400">+{j.newProductsCount}</td>
                            <td className="p-3 tabular-nums text-purple-400">+{j.updatedOffersCount}</td>
                            <td className="p-3 tabular-nums text-red-400">{j.errorRows}</td>
                            <td className="p-3">
                              <span
                                className={`border px-1.5 py-0.5 text-[9px] font-bold ${
                                  j.status === "COMPLETED"
                                    ? "border-emerald-600/50 text-emerald-400"
                                    : "border-sky-600/50 text-sky-400"
                                }`}
                              >
                                {j.status}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-[#888b8d]">
                              {new Intl.DateTimeFormat("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(j.createdAt))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* 4. PROFILE */}
            {tab === "profile" && profile && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff6428]">
                    Настройки и реквизиты
                  </p>
                  <h1 className="mt-1 text-2xl font-black uppercase">Профиль компании</h1>
                </div>

                <div className="grid gap-4 border border-[#383e41] bg-[#1e2124] p-5 sm:grid-cols-2">
                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Торговое название компании *
                    <input
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                      className={inputClass}
                    />
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Юридическое наименование
                    <input
                      value={profile.legalName || ""}
                      onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                      placeholder='Например: ООО "Авто Разбор"'
                      className={inputClass}
                    />
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    ИНН / УНП
                    <input
                      value={profile.innOrVat || ""}
                      onChange={(e) => setProfile({ ...profile, innOrVat: e.target.value })}
                      className={inputClass}
                    />
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Город расположения склада
                    <input
                      value={profile.city || ""}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      className={inputClass}
                    />
                  </label>

                  <label className="sm:col-span-2 text-[10px] font-bold uppercase text-[#888b8d]">
                    Фактический адрес склада
                    <input
                      value={profile.warehouseAddress || ""}
                      onChange={(e) => setProfile({ ...profile, warehouseAddress: e.target.value })}
                      className={inputClass}
                    />
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Контактное лицо
                    <input
                      value={profile.contactName || ""}
                      onChange={(e) => setProfile({ ...profile, contactName: e.target.value })}
                      className={inputClass}
                    />
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Контактный телефон
                    <input
                      value={profile.phone || ""}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className={inputClass}
                    />
                  </label>

                  <label className="sm:col-span-2 text-[10px] font-bold uppercase text-[#888b8d]">
                    Специализация и бренды
                    <input
                      value={profile.specialization || ""}
                      onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
                      placeholder="Например: Разборка корейских и немецких авто..."
                      className={inputClass}
                    />
                  </label>

                  <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                    Срок обработки и подготовки заказа (дней)
                    <input
                      type="number"
                      min="1"
                      value={profile.orderProcessingDays}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          orderProcessingDays: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className={inputClass}
                    />
                  </label>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="pickupCheck"
                      checked={profile.pickupAvailable}
                      onChange={(e) =>
                        setProfile({ ...profile, pickupAvailable: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#ff6428]"
                    />
                    <label
                      htmlFor="pickupCheck"
                      className="text-xs font-bold uppercase text-[#f1f0eb]"
                    >
                      Возможен самовывоз со склада
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-[#ff6428] px-8 py-3 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45] disabled:opacity-50"
                  >
                    {savingProfile ? "Сохраняем..." : "Сохранить изменения профиля"}
                  </button>
                </div>
              </form>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
