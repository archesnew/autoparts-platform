"use client";

import { useEffect, useState } from "react";

type SupplierSimple = {
  id: string;
  name: string;
  country: string;
};

type ImportJobItem = {
  id: string;
  supplierId: string;
  supplierName: string;
  fileName: string;
  fileFormat: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  newProductsCount: number;
  updatedOffersCount: number;
  status: string;
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

export function FeedImportWorkspace({
  suppliers,
}: {
  suppliers: SupplierSimple[];
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    suppliers[0]?.id || "sup-ru-01"
  );
  const [source, setSource] = useState("RU_DISMANTLE");
  const [format, setFormat] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [isFullFeed, setIsFullFeed] = useState(false);
  const [archiveMissing, setArchiveMissing] = useState(false);
  const [activeJob, setActiveJob] = useState<ImportJobItem | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportRowItem[]>([]);
  const [history, setHistory] = useState<ImportJobItem[]>([]);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Load history
  useEffect(() => {
    fetch("/api/admin/import/jobs")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.jobs)) {
          setHistory(data.jobs);
        }
      })
      .catch((err) => console.error("Error loading import jobs history:", err));
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage({ text: "Выберите файл прайс-листа или фида", type: "error" });
      return;
    }
    if (!selectedSupplierId) {
      setMessage({ text: "Выберите поставщика", type: "error" });
      return;
    }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("supplierId", selectedSupplierId);
    formData.append("source", source);
    if (format) formData.append("forcedFormat", format);

    try {
      const res = await fetch("/api/admin/import/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Ошибка при обработке фида");
      }

      setActiveJob(data.job);
      // Load first page of rows
      const detailsRes = await fetch(`/api/admin/import/jobs/${data.job.id}`);
      const detailsData = await detailsRes.json();
      if (detailsData.ok) {
        setPreviewRows(detailsData.rows);
      }

      setHistory((prev) => [data.job, ...prev]);
      setMessage({
        text: `Файл '${file.name}' успешно проанализирован: ${data.job.totalRows} строк, готово к импорту: ${data.job.validRows}`,
        type: "success",
      });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Ошибка загрузки", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleCommit() {
    if (!activeJob) return;
    setCommitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/import/jobs/${activeJob.id}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFullFeed, archiveMissing }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Ошибка применения импорта");
      }

      setActiveJob((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
      const archivedText = data.archivedOffers ? `, архивировано отсутствующих: ${data.archivedOffers}` : "";
      setMessage({
        text: `Импорт успешно завершён! Новых товаров в каталоге: ${data.createdProducts}, обновлено предложений: ${data.createdOffers + data.updatedOffers}${archivedText}`,
        type: "success",
      });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Ошибка фиксации", type: "error" });
    } finally {
      setCommitting(false);
    }
  }

  async function loadJobDetails(jobId: string) {
    try {
      const res = await fetch(`/api/admin/import/jobs/${jobId}`);
      const data = await res.json();
      if (data.ok) {
        setActiveJob(data.job);
        setPreviewRows(data.rows);
        window.scrollTo({ top: 400, behavior: "smooth" });
      }
    } catch (err) {
      console.error(err);
    }
  }

  const selectClass =
    "mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-xs font-semibold text-[#f1f0eb] outline-none focus:border-[#ff6428]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#383e41] pb-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ff6428]">
            B2B Feed Automation · CRM
          </p>
          <h1 className="mt-1 text-2xl font-black uppercase text-[#f1f0eb] sm:text-3xl">
            Импорт прайс-листов и фидов
          </h1>
          <p className="mt-1 text-xs text-[#888b8d]">
            Автоматическая загрузка, сопоставление и обновление предложений от разборок РФ и Беларуси (YML, XML, CSV, XLSX).
          </p>
        </div>
      </div>

      {message && (
        <div
          role="alert"
          className={`border p-4 text-xs font-bold uppercase tracking-wider ${
            message.type === "success"
              ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-400"
              : "border-red-500/50 bg-red-950/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Upload Form */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#f1f0eb]">
          Загрузка прайс-листа или фида
        </h2>
        <form onSubmit={handleUpload} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
            Поставщик *
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className={selectClass}
              required
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country})
                </option>
              ))}
            </select>
          </label>

          <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
            Источник / Хаб *
            <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
              <option value="RU_DISMANTLE">Разборки России (RU_DISMANTLE)</option>
              <option value="BY_DISMANTLE">Разборки Беларуси (BY_DISMANTLE)</option>
              <option value="LOCAL_STOCK">Локальный склад (LOCAL_STOCK)</option>
              <option value="MANUAL">Ручной прайс (MANUAL)</option>
            </select>
          </label>

          <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
            Формат файла
            <select value={format} onChange={(e) => setFormat(e.target.value)} className={selectClass}>
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
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="mt-1 block w-full text-xs text-[#888b8d] file:mr-3 file:border-0 file:bg-[#ff6428] file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:text-[#17191b] hover:file:bg-[#ff7a45]"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={uploading}
              className="min-h-10 bg-[#ff6428] px-6 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45] disabled:opacity-50"
            >
              {uploading ? "Анализируем фид..." : "Загрузить и проанализировать →"}
            </button>
          </div>
        </form>
      </section>

      {/* Preview Section */}
      {activeJob && (
        <section className="border border-[#ff6428]/40 bg-[#1e2124] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#383e41] pb-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
                Предварительный просмотр импорта
              </p>
              <h2 className="mt-1 text-lg font-black uppercase text-[#f1f0eb]">
                {activeJob.fileName} · {activeJob.supplierName}
              </h2>
            </div>
            {activeJob.status === "PREVIEW_READY" ? (
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
                <button
                  id="admin-commit-import-btn"
                  onClick={handleCommit}
                  disabled={committing || activeJob.validRows === 0}
                  className="min-h-11 bg-emerald-500 px-6 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {committing ? "Сохраняем в каталог..." : "Подтвердить импорт в каталог →"}
                </button>
              </div>
            ) : (
              <span className="border border-emerald-500/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-black uppercase text-emerald-400">
                Импорт успешно завершён
              </span>
            )}
          </div>

          {/* KPI Summary */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-[#888b8d]">Всего строк</span>
              <p className="mt-1 text-xl font-black text-[#f1f0eb]">{activeJob.totalRows}</p>
            </div>
            <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-emerald-400">Корректных</span>
              <p className="mt-1 text-xl font-black text-emerald-400">{activeJob.validRows}</p>
            </div>
            <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-[#ff6428]">Новых деталей</span>
              <p className="mt-1 text-xl font-black text-[#ff6428]">{activeJob.newProductsCount}</p>
            </div>
            <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-blue-400">Обновляемых</span>
              <p className="mt-1 text-xl font-black text-blue-400">{activeJob.updatedOffersCount}</p>
            </div>
            <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-amber-400">Дубликатов</span>
              <p className="mt-1 text-xl font-black text-amber-400">{activeJob.duplicateRows}</p>
            </div>
            <div className="border border-[#383e41] bg-[#17191b] p-3 text-center">
              <span className="text-[10px] font-bold uppercase text-red-400">Ошибок</span>
              <p className="mt-1 text-xl font-black text-red-400">{activeJob.errorRows}</p>
            </div>
          </div>

          {/* Rows Table */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#383e41] bg-[#17191b] text-[10px] font-black uppercase tracking-wider text-[#888b8d]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Статус</th>
                  <th className="p-2.5">Тип сопоставления</th>
                  <th className="p-2.5">OEM / Артикул</th>
                  <th className="p-2.5">Наименование</th>
                  <th className="p-2.5">Бренд</th>
                  <th className="p-2.5 text-right">Закупка</th>
                  <th className="p-2.5 text-center">Кол-во</th>
                  <th className="p-2.5">Ошибки / Примечания</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#383e41]">
                {previewRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#222629]">
                    <td className="p-2.5 font-mono text-[#888b8d]">{row.rowIndex}</td>
                    <td className="p-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase ${
                          row.status === "VALID"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/40"
                            : "bg-red-950/60 text-red-400 border border-red-500/40"
                        }`}
                      >
                        {row.status === "VALID" ? "Корректно" : "Ошибка"}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="text-[10px] font-bold text-[#f1f0eb]">
                        {row.matchType === "NEW_PRODUCT"
                          ? "Новый товар"
                          : row.matchType === "MATCHED_EXISTING"
                          ? "Существующий узел"
                          : row.matchType === "AMBIGUOUS"
                          ? "Неоднозначно"
                          : row.matchType === "DUPLICATE_IN_FEED"
                          ? "Дубль в фиде"
                          : "Ошибка"}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-[#ff6428]">
                      {row.rawOem || row.normalizedOem || "—"}
                    </td>
                    <td className="p-2.5 font-semibold text-[#f1f0eb] max-w-xs truncate" title={row.title}>
                      {row.title}
                    </td>
                    <td className="p-2.5 text-[#888b8d]">{row.brand || "—"}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-[#f1f0eb]">
                      {row.price ? `${parseFloat(row.price).toLocaleString("ru-RU")} ${row.currency}` : "—"}
                    </td>
                    <td className="p-2.5 text-center text-[#f1f0eb]">{row.quantity}</td>
                    <td className="p-2.5 text-[11px] text-red-400">
                      {row.errors.length ? row.errors.join("; ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* History */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#f1f0eb]">
          История загрузок и фидов
        </h2>
        {history.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#383e41] bg-[#17191b] text-[10px] font-black uppercase tracking-wider text-[#888b8d]">
                <tr>
                  <th className="p-2.5">Файл</th>
                  <th className="p-2.5">Поставщик</th>
                  <th className="p-2.5">Формат</th>
                  <th className="p-2.5 text-center">Всего строк</th>
                  <th className="p-2.5 text-center">Новых</th>
                  <th className="p-2.5 text-center">Обновлено</th>
                  <th className="p-2.5">Статус</th>
                  <th className="p-2.5">Дата</th>
                  <th className="p-2.5 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#383e41]">
                {history.map((j) => (
                  <tr key={j.id} className="hover:bg-[#222629]">
                    <td className="p-2.5 font-semibold text-[#f1f0eb]">{j.fileName}</td>
                    <td className="p-2.5 text-[#888b8d]">{j.supplierName}</td>
                    <td className="p-2.5">
                      <span className="border border-[#383e41] bg-[#17191b] px-2 py-0.5 text-[9px] font-mono text-[#ff986f]">
                        {j.fileFormat}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono text-[#f1f0eb]">{j.totalRows}</td>
                    <td className="p-2.5 text-center font-mono text-emerald-400">{j.newProductsCount}</td>
                    <td className="p-2.5 text-center font-mono text-blue-400">{j.updatedOffersCount}</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-black uppercase ${
                          j.status === "COMPLETED"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/40"
                            : j.status === "PREVIEW_READY"
                            ? "bg-blue-950/60 text-blue-400 border border-blue-500/40"
                            : "bg-amber-950/60 text-amber-400 border border-amber-500/40"
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-[11px] text-[#888b8d]">
                      {new Date(j.createdAt).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => loadJobDetails(j.id)}
                        className="border border-[#414749] px-2.5 py-1 text-[10px] font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428] hover:text-[#ff6428]"
                      >
                        Открыть →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[#888b8d]">История импортов пуста.</p>
        )}
      </section>
    </div>
  );
}
