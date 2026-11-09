"use client";

import { useEffect, useMemo, useState } from "react";

type RequestStatus = "NEW" | "ASSIGNED" | "SEARCHING" | "WAITING_SUPPLIERS" | "OFFERS_READY" | "SENT_TO_CUSTOMER" | "WAITING_CUSTOMER" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
type RequestRow = {
  id: string; created: string; customer: string; email: string; phone: string;
  make: string; model: string; year: string; vin: string; manager: string;
  status: RequestStatus; priority: "Высокий" | "Обычный";
  items: { id: string; name: string; oem: string; qty: number }[];
};
type WorkTask = { title: string; dueAt: string };
type StatusTab = "all" | "new" | "assigned" | "searching" | "suppliers" | "offers" | "customer" | "overdue" | "completed" | "cancelled";
type SortMode = "date-newest" | "date-oldest" | "due" | "priority";

const statuses: { id: RequestStatus; label: string }[] = [
  { id: "NEW", label: "Новая" }, { id: "ASSIGNED", label: "Принята в работу" },
  { id: "SEARCHING", label: "Подбор" }, { id: "WAITING_SUPPLIERS", label: "Ожидает поставщиков" },
  { id: "OFFERS_READY", label: "Предложение сформировано" }, { id: "SENT_TO_CUSTOMER", label: "Отправлена покупателю" },
  { id: "WAITING_CUSTOMER", label: "Ждём ответ покупателя" }, { id: "CONFIRMED", label: "Подтверждена" },
  { id: "COMPLETED", label: "Завершена" }, { id: "CANCELLED", label: "Отменена" },
];
const tabs: { id: StatusTab; label: string }[] = [
  { id: "all", label: "Все заявки" }, { id: "new", label: "Новые" },
  { id: "assigned", label: "Принятые в работу" }, { id: "searching", label: "Подбор" },
  { id: "suppliers", label: "Ожидают поставщиков" }, { id: "offers", label: "Предложение сформировано" },
  { id: "customer", label: "Ожидают покупателя" }, { id: "overdue", label: "Просроченные" },
  { id: "completed", label: "Завершённые" }, { id: "cancelled", label: "Отменённые" },
];
const transitions: Record<RequestStatus, RequestStatus[]> = {
  NEW: ["ASSIGNED", "CANCELLED"], ASSIGNED: ["SEARCHING", "CANCELLED"],
  SEARCHING: ["WAITING_SUPPLIERS", "OFFERS_READY", "CANCELLED"],
  WAITING_SUPPLIERS: ["SEARCHING", "OFFERS_READY", "CANCELLED"],
  // An offer being ready is not proof that it was sent. Only a connected delivery channel may set SENT_TO_CUSTOMER.
  OFFERS_READY: ["SEARCHING", "CANCELLED"],
  SENT_TO_CUSTOMER: ["WAITING_CUSTOMER", "CONFIRMED", "CANCELLED"],
  WAITING_CUSTOMER: ["OFFERS_READY", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [],
};
const statusNames = Object.fromEntries(statuses.map((status) => [status.id, status.label])) as Record<RequestStatus, string>;
const managers = ["Анна Смирнова", "Илья Волков", "Мария Ким"];
const suppliers = ["Россия", "Беларусь", "Польша"];
const panel = "border border-[#383e41] bg-[#202325]";
const control = "min-h-9 w-full min-w-0 border border-[#414749] bg-[#17191b] px-2.5 text-[12px] text-[#f5f5f5] outline-none focus:border-[#ff6428]";

function dateParts(value: string) {
  const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}
function normalizeDateInput(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCDate() === Number(day) && date.getUTCMonth() === Number(month) - 1 && date.getUTCFullYear() === Number(year) ? `${year}-${month}-${day}` : "";
}
function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}
function dateTime(value: string) {
  const match = /(\d{2})\.(\d{2})\.(\d{4})[,]?\s+(\d{2}):(\d{2})/.exec(value);
  return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5])) : 0;
}
function overdueDuration(dueAt: string) {
  const minutesLate = Math.max(1, Math.floor((Date.now() - new Date(dueAt).getTime()) / 60_000));
  const days = Math.floor(minutesLate / 1440);
  const hours = Math.floor((minutesLate % 1440) / 60);
  const minutes = minutesLate % 60;
  return [days > 0 ? `${days} д` : "", hours > 0 ? `${hours} ч` : "", days === 0 && minutes > 0 ? `${minutes} мин` : ""].filter(Boolean).join(" ");
}
function formatDue(dueAt: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(dueAt));
}
function RequestItemsSummary({ items }: { items: RequestRow["items"] }) {
  const visibleItems = items.slice(0, 2);
  return <>
    {visibleItems.map((item) => <span key={item.id} className="mb-1.5 block break-words leading-4">{item.name} <span className="text-[#c4cacc]">×{item.qty}</span><small className="mt-0.5 block break-all font-mono text-[11px] text-[#d0d5d6]">OEM {item.oem}</small></span>)}
    {items.length > visibleItems.length && <details className="mt-1 text-[11px]" onClick={(event) => event.stopPropagation()}><summary className="w-fit cursor-pointer list-inside text-[#ff986f] hover:text-[#f1f0eb]">Ещё {items.length - visibleItems.length} · показать все</summary><div className="mt-2 border-l border-[#565e61] pl-2">{items.slice(visibleItems.length).map((item) => <span key={item.id} className="mb-2 block break-words leading-4">{item.name} <span className="text-[#c4cacc]">×{item.qty}</span><small className="mt-0.5 block break-all font-mono text-[11px] text-[#d0d5d6]">OEM {item.oem}</small></span>)}</div></details>}
  </>;
}
function dueFor(row: RequestRow, nextTaskFor: (id: string) => WorkTask | undefined) {
  return nextTaskFor(row.id)?.dueAt;
}
function exportCsv(rows: RequestRow[], nextTaskFor: (id: string) => WorkTask | undefined, countryByRequest: Record<string, string[]>) {
  const fields = ["Заявка", "Дата", "Покупатель", "Телефон", "Автомобиль", "VIN", "Запрашиваемые детали", "Страна поставщика", "Менеджер", "Статус", "Приоритет", "Следующее действие", "Срок следующего действия"];
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [fields, ...rows.map((row) => { const task = nextTaskFor(row.id); return [row.id, row.created, row.customer, row.phone, `${row.make} ${row.model} ${row.year}`, row.vin, row.items.map((item) => `${item.name} ×${item.qty} · OEM ${item.oem}`).join("; "), countryByRequest[row.id]?.join(", ") ?? "", row.manager, statusNames[row.status], row.priority, task?.title ?? "", task?.dueAt ?? ""]; })];
  const blob = new Blob(["\uFEFF", lines.map((line) => line.map(quote).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "zaptut-requests-demo.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RequestRegister({
  rows, overdueIds, countryByRequest, nextTaskFor, onOpen, onAssign, onPriority, onStatus,
  onCreate,
}: {
  rows: RequestRow[]; overdueIds: Set<string>; countryByRequest: Record<string, string[]>;
  nextTaskFor: (id: string) => WorkTask | undefined; onOpen: (id: string) => void;
  onAssign: (ids: string[], manager: string) => void; onPriority: (ids: string[], priority: "Высокий" | "Обычный") => void;
  onStatus: (ids: string[], status: RequestStatus) => void; onCreate: () => void;
}) {
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<"" | "Высокий" | "Обычный">("");
  const [managerFilter, setManagerFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState<"" | "overdue" | "on-time">("");
  const [sort, setSort] = useState<SortMode>("date-newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copiedVin, setCopiedVin] = useState("");
  const [bulkManager, setBulkManager] = useState("");
  const [bulkPriority, setBulkPriority] = useState<"" | "Высокий" | "Обычный">("");
  const [bulkStatus, setBulkStatus] = useState<RequestStatus | "">("");
  const [, setClock] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const tabMatches = (row: RequestRow) => {
    if (tab === "all") return true;
    if (tab === "overdue") return overdueIds.has(row.id);
    if (tab === "customer") return row.status === "SENT_TO_CUSTOMER" || row.status === "WAITING_CUSTOMER";
    const target: Partial<Record<StatusTab, RequestStatus>> = { new: "NEW", assigned: "ASSIGNED", searching: "SEARCHING", suppliers: "WAITING_SUPPLIERS", offers: "OFFERS_READY", completed: "COMPLETED", cancelled: "CANCELLED" };
    return row.status === target[tab];
  };
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (!tabMatches(row)) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (priorityFilter && row.priority !== priorityFilter) return false;
    if (managerFilter && row.manager !== managerFilter) return false;
    if (countryFilter && !countryByRequest[row.id]?.includes(countryFilter)) return false;
    if (overdueFilter === "overdue" && !overdueIds.has(row.id)) return false;
    if (overdueFilter === "on-time" && overdueIds.has(row.id)) return false;
    const created = dateParts(row.created);
    const from = createdFrom ? normalizeDateInput(createdFrom) : "";
    const to = createdTo ? normalizeDateInput(createdTo) : "";
    if (createdFrom && (!from || created < from)) return false;
    if (createdTo && (!to || created > to)) return false;
    const haystack = `${row.id} ${row.created} ${row.customer} ${row.email} ${row.phone} ${row.make} ${row.model} ${row.year} ${row.vin} ${row.manager} ${row.items.map((item) => `${item.name} ${item.oem} ${item.qty}`).join(" ")}`.toLocaleLowerCase("ru-RU");
    return !search || haystack.includes(search.trim().toLocaleLowerCase("ru-RU"));
  }).sort((a, b) => {
    if (sort === "priority") return (a.priority === b.priority ? 0 : a.priority === "Высокий" ? -1 : 1) || dateParts(b.created).localeCompare(dateParts(a.created));
    if (sort === "due") return new Date(dueFor(a, nextTaskFor) ?? "2999-12-31").getTime() - new Date(dueFor(b, nextTaskFor) ?? "2999-12-31").getTime();
    const order = dateTime(a.created) - dateTime(b.created);
    return sort === "date-newest" ? -order : order;
  }), [rows, tab, statusFilter, priorityFilter, managerFilter, countryFilter, overdueFilter, createdFrom, createdTo, search, sort, overdueIds, countryByRequest, nextTaskFor]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedRows = rows.filter((row) => selected.includes(row.id));
  const allowedBulkStatuses = statuses.filter(({ id }) => selectedRows.length > 0 && selectedRows.every((row) => transitions[row.status].includes(id)));
  const selectedOnPage = visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id));
  const tabCount = (id: StatusTab) => id === "all" ? rows.length : id === "overdue" ? rows.filter((row) => overdueIds.has(row.id)).length : rows.filter((row) => {
    if (id === "customer") return row.status === "SENT_TO_CUSTOMER" || row.status === "WAITING_CUSTOMER";
    const target: Partial<Record<StatusTab, RequestStatus>> = { new: "NEW", assigned: "ASSIGNED", searching: "SEARCHING", suppliers: "WAITING_SUPPLIERS", offers: "OFFERS_READY", completed: "COMPLETED", cancelled: "CANCELLED" };
    return row.status === target[id];
  }).length;
  const reset = () => { setTab("all"); setSearch(""); setCreatedFrom(""); setCreatedTo(""); setStatusFilter(""); setPriorityFilter(""); setManagerFilter(""); setCountryFilter(""); setOverdueFilter(""); setSort("date-newest"); setPage(1); setSelected([]); setBulkOpen(false); };
  const updateFilter = <T,>(setter: (value: T) => void, value: T) => { setter(value); setPage(1); setSelected([]); setBulkOpen(false); };
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    setBulkOpen(next.length > 0);
  };
  const togglePage = () => {
    const next = selectedOnPage ? selected.filter((id) => !visibleRows.some((row) => row.id === id)) : [...new Set([...selected, ...visibleRows.map((row) => row.id)])];
    setSelected(next);
    setBulkOpen(next.length > 0);
  };
  const clearSelection = () => { setSelected([]); setBulkOpen(false); setBulkManager(""); setBulkPriority(""); setBulkStatus(""); };
  const selectClass = `${control} mt-0.5 h-8 min-h-8 px-2 text-[11px]`;
  const copyVin = async (vin: string) => {
    try {
      await navigator.clipboard.writeText(vin);
    } catch {
      const input = document.createElement("textarea");
      input.value = vin;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopiedVin(vin);
    window.setTimeout(() => setCopiedVin((current) => current === vin ? "" : current), 1400);
  };

  return <section className={`${panel} min-w-0`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#383e41] p-3 sm:p-4">
      <div><h2 className="text-[13px] font-extrabold uppercase tracking-wide">Все заявки</h2><p className="mt-1 text-[11px] text-[#aeb5b6]">Найдено: <b className="tabular-nums text-[#f1f0eb]">{filteredRows.length}</b> из {rows.length} · демонстрационные данные</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={onCreate} className="min-h-9 border border-[#565e61] px-3 text-[10px] font-bold uppercase hover:border-[#ff6428]">Создать заявку +</button><button onClick={() => exportCsv(filteredRows, nextTaskFor, countryByRequest)} disabled={!filteredRows.length} className="min-h-9 bg-[#ff6428] px-3 text-[10px] font-extrabold uppercase text-[#17191b] disabled:opacity-40">Экспорт CSV ↓</button></div>
    </div>

    <nav aria-label="Фильтр по статусу" className="grid grid-cols-2 gap-1.5 border-b border-[#383e41] bg-[#1c1f21] p-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {tabs.map(({ id, label }) => <button key={id} onClick={() => { setTab(id); setPage(1); setSelected([]); setBulkOpen(false); }} aria-pressed={tab === id} className={`flex min-h-8 min-w-0 items-center justify-between gap-2 border px-2 py-1.5 text-left text-[10px] font-semibold leading-4 transition ${tab === id ? "border-[#ff6428] bg-[#30231f] text-[#ff986f]" : "border-transparent text-[#b4bbbd] hover:border-[#414749] hover:text-[#f1f0eb]"}`}><span className="min-w-0 break-words">{label}</span><span className="shrink-0 tabular-nums text-[9px] text-[#899194]">{tabCount(id)}</span></button>)}
    </nav>

    <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-1.5 border-b border-[#383e41] bg-[#202325] p-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 sm:p-3">
      <label className="col-span-2 min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6] sm:col-span-3 xl:col-span-2">Поиск по заявке, покупателю, телефону, VIN, OEM<input value={search} onChange={(e) => updateFilter(setSearch, e.target.value)} placeholder="ZP-2026-0148 или 51712-C1A00" className={`${selectClass} text-[12px]`}/></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Дата создания с<input aria-label="Дата создания с" inputMode="numeric" autoComplete="off" maxLength={10} value={createdFrom} onChange={(e) => updateFilter(setCreatedFrom, formatDateInput(e.target.value))} placeholder="ДД.ММ.ГГГГ" className={selectClass}/></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Дата создания по<input aria-label="Дата создания по" inputMode="numeric" autoComplete="off" maxLength={10} value={createdTo} onChange={(e) => updateFilter(setCreatedTo, formatDateInput(e.target.value))} placeholder="ДД.ММ.ГГГГ" className={selectClass}/></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Статус<select value={statusFilter} onChange={(e) => updateFilter(setStatusFilter, e.target.value as RequestStatus | "")} className={selectClass}><option value="">Все статусы</option>{statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Приоритет<select value={priorityFilter} onChange={(e) => updateFilter(setPriorityFilter, e.target.value as typeof priorityFilter)} className={selectClass}><option value="">Любой</option><option>Высокий</option><option>Обычный</option></select></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Ответственный<select value={managerFilter} onChange={(e) => updateFilter(setManagerFilter, e.target.value)} className={selectClass}><option value="">Все менеджеры</option>{managers.map((manager) => <option key={manager}>{manager}</option>)}</select></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Страна поставщика<select value={countryFilter} onChange={(e) => updateFilter(setCountryFilter, e.target.value)} className={selectClass}><option value="">Любая страна</option>{suppliers.map((country) => <option key={country}>{country}</option>)}</select></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Срок действия<select value={overdueFilter} onChange={(e) => updateFilter(setOverdueFilter, e.target.value as typeof overdueFilter)} className={selectClass}><option value="">Любой срок</option><option value="overdue">Есть просрочка</option><option value="on-time">Без просрочки</option></select></label>
      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Сортировка<select value={sort} onChange={(e) => { setSort(e.target.value as SortMode); setPage(1); setSelected([]); setBulkOpen(false); }} className={selectClass}><option value="date-newest">Дата: новые</option><option value="date-oldest">Дата: старые</option><option value="due">Ближайший срок</option><option value="priority">Высокий приоритет</option></select></label>
      <div className="flex items-end sm:col-span-2 xl:col-span-1"><button onClick={reset} className="min-h-9 border border-[#51595c] px-3 text-[10px] font-bold uppercase text-[#d0d5d6] hover:border-[#ff6428]">Сбросить фильтры</button></div>
    </div>

    <div className="border-b border-[#383e41] bg-[#1c1f21] p-2.5 sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase text-[#9ca5a7]">Выбрано: <b className="tabular-nums text-[#f1f0eb]">{selected.length}</b></span><button disabled={!selected.length} aria-expanded={bulkOpen} onClick={() => setBulkOpen((open) => !open)} className="min-h-8 border border-[#51595c] px-2.5 text-[10px] font-bold uppercase text-[#d0d5d6] hover:border-[#ff6428] disabled:cursor-not-allowed disabled:opacity-40">{bulkOpen ? "Скрыть действия ↑" : `Действия · ${selected.length} ↓`}</button></div>
      {selected.length > 0 && bulkOpen && <div className="mt-2 grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <div role="group" aria-label="Массовое назначение менеджера" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1"><select aria-label="Назначить выбранные заявки менеджеру" value={bulkManager} onChange={(e) => setBulkManager(e.target.value)} className="h-8 min-w-0 border border-[#414749] bg-[#17191b] px-2 text-[11px] text-[#f1f0eb]"><option value="">Менеджер…</option>{managers.map((manager) => <option key={manager}>{manager}</option>)}</select><button disabled={!bulkManager} onClick={() => { onAssign(selected, bulkManager); clearSelection(); }} className="h-8 border border-[#51595c] px-2 text-[9px] font-bold uppercase disabled:opacity-40">Назначить</button></div>
        <div role="group" aria-label="Массовое изменение приоритета" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1"><select aria-label="Изменить приоритет выбранных заявок" value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value as typeof bulkPriority)} className="h-8 min-w-0 border border-[#414749] bg-[#17191b] px-2 text-[11px] text-[#f1f0eb]"><option value="">Приоритет…</option><option>Высокий</option><option>Обычный</option></select><button disabled={!bulkPriority} onClick={() => { onPriority(selected, bulkPriority as "Высокий" | "Обычный"); clearSelection(); }} className="h-8 border border-[#51595c] px-2 text-[9px] font-bold uppercase disabled:opacity-40">Применить</button></div>
        <div role="group" aria-label="Допустимое массовое изменение статуса" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1"><select aria-label="Изменить статус выбранных заявок" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as RequestStatus | "")} className="h-8 min-w-0 border border-[#414749] bg-[#17191b] px-2 text-[11px] text-[#f1f0eb]"><option value="">Статус…</option>{allowedBulkStatuses.map((status) => <option value={status.id} key={status.id}>{status.label}</option>)}</select><button disabled={!bulkStatus} onClick={() => { onStatus(selected, bulkStatus as RequestStatus); clearSelection(); }} className="h-8 border border-[#51595c] px-2 text-[9px] font-bold uppercase disabled:opacity-40">Изменить</button></div>
        <button onClick={() => exportCsv(selectedRows, nextTaskFor, countryByRequest)} className="h-8 min-w-0 border border-[#51595c] px-2 text-[9px] font-bold uppercase hover:border-[#ff6428]">Экспорт выбранных ↓</button>
      </div>}
    </div>

    <div className="hidden overflow-hidden xl:block">
      <table className="w-full table-fixed text-left text-[12px]"><colgroup><col className="w-[3%]"/><col className="w-[12%]"/><col className="w-[13%]"/><col className="w-[12%]"/><col className="w-[22%]"/><col className="w-[10%]"/><col className="w-[13%]"/><col className="w-[15%]"/></colgroup>
        <thead className="bg-[#292e30] text-[10px] uppercase tracking-wide text-[#c2c8c9]"><tr><th className="p-2"><input aria-label="Выбрать заявки на странице" type="checkbox" checked={selectedOnPage} onChange={togglePage} className="accent-[#ff6428]"/></th>{["Заявка / дата","Покупатель / телефон","Автомобиль / VIN","Детали / количество / OEM","Ответственный","Статус / приоритет","Следующее действие / срок"].map((title) => <th key={title} className="p-2">{title}</th>)}</tr></thead>
        <tbody>{visibleRows.map((row) => { const task = nextTaskFor(row.id); const late = overdueIds.has(row.id); return <tr key={row.id} tabIndex={0} role="button" onClick={() => onOpen(row.id)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(row.id); } }} className="cursor-pointer border-t border-[#383e41] align-top hover:bg-[#252a2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6428]">
          <td className="p-2" onClick={(event) => event.stopPropagation()}><input aria-label={`Выбрать ${row.id}`} type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} className="accent-[#ff6428]"/></td>
          <td className="break-words p-2"><b className="tabular-nums text-[#ff865c]">{row.id}</b><small className="mt-1 block text-[11px] text-[#b0b8ba]">{row.created}</small></td>
          <td className="break-words p-2">{row.customer}<small className="mt-1 block tabular-nums text-[11px] text-[#c2c8c9]">{row.phone}</small></td>
          <td className="break-words p-2"><span className="block">{row.make} {row.model}</span><small className="mt-1 block text-[11px] text-[#c2c8c9]">Год · {row.year}</small><small className="mt-1 block break-all font-mono text-[10px] text-[#c2c8c9]">{row.vin}</small><button onClick={(event) => { event.stopPropagation(); void copyVin(row.vin); }} className="mt-1 text-[9px] font-bold uppercase text-[#ff986f] hover:text-[#f1f0eb]">{copiedVin === row.vin ? "Скопировано" : "Копировать VIN"}</button></td>
          <td className="break-words p-2"><RequestItemsSummary items={row.items}/></td>
          <td className="break-words p-2">{row.manager}</td>
          <td className="p-2"><span className="block">{statusNames[row.status]}</span><small className={`mt-1 block ${row.priority === "Высокий" ? "text-[#ff986f]" : "text-[#b0b8ba]"}`}>{row.priority}</small></td>
          <td className="break-words p-2">{task ? <><span className="block">{task.title}</span><small className={`mt-1 block tabular-nums ${late ? "font-bold text-[#ff986f]" : "text-[#c2c8c9]"}`}>{formatDue(task.dueAt)}{late && ` · просрочено на ${overdueDuration(task.dueAt)}`}</small></> : <span className="text-[#aeb5b6]">Нет активного действия</span>}</td>
        </tr>; })}</tbody>
      </table>
    </div>

    <div className="grid gap-2 p-3 xl:hidden sm:grid-cols-2">
      {visibleRows.map((row) => { const task = nextTaskFor(row.id); const late = overdueIds.has(row.id); return <article key={row.id} onClick={() => onOpen(row.id)} className="min-w-0 cursor-pointer border border-[#383e41] bg-[#1a1d1f] p-3 hover:border-[#ff6428]">
        <div className="flex items-start gap-2"><input aria-label={`Выбрать ${row.id}`} type="checkbox" checked={selected.includes(row.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggle(row.id)} className="mt-1 shrink-0 accent-[#ff6428]"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-2"><b className="break-all text-[13px] tabular-nums text-[#ff865c]">{row.id}</b><span className="text-[11px] text-[#b0b8ba]">{row.created}</span></div><p className="mt-2 break-words text-[13px] font-semibold">{row.customer}</p><p className="mt-0.5 break-all text-[11px] tabular-nums text-[#c2c8c9]">{row.phone}</p></div></div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#383e41] pt-2 text-[11px]"><div className="min-w-0"><span className="text-[#899194]">Автомобиль</span><p className="break-words text-[#e0e3e4]">{row.make} {row.model}</p><p className="mt-0.5 text-[#b0b8ba]">Год · {row.year}</p></div><div className="min-w-0"><span className="text-[#899194]">VIN</span><p className="mt-0.5 break-all font-mono text-[10px] text-[#c2c8c9]">{row.vin}</p><button onClick={(event) => { event.stopPropagation(); void copyVin(row.vin); }} className="mt-1 text-[9px] font-bold uppercase text-[#ff986f]">{copiedVin === row.vin ? "Скопировано" : "Копировать VIN"}</button></div></div>
        <div className="mt-2 border-t border-[#383e41] pt-2 text-[12px]"><RequestItemsSummary items={row.items}/></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#383e41] pt-2 text-[11px]"><span>{row.manager}</span><span className={row.priority === "Высокий" ? "font-bold text-[#ff986f]" : "text-[#b0b8ba]"}>{row.priority}</span><span className="text-[#d4d8d9]">{statusNames[row.status]}</span></div>
        <div className={`mt-2 border-t border-[#383e41] pt-2 text-[11px] ${late ? "text-[#ff986f]" : "text-[#c2c8c9]"}`}>{task ? <>{task.title} · {formatDue(task.dueAt)}{late && ` · просрочено на ${overdueDuration(task.dueAt)}`}</> : "Нет активного действия"}</div>
      </article>; })}
    </div>

    {!filteredRows.length && <div className="border-t border-[#383e41] px-4 py-12 text-center"><p className="text-sm font-bold text-[#d0d5d6]">Заявки не найдены</p><p className="mt-1 text-xs text-[#929a9c]">Измените условия поиска или сбросьте фильтры.</p><button onClick={reset} className="mt-3 border border-[#51595c] px-3 py-2 text-[10px] font-bold uppercase text-[#ff986f]">Сбросить фильтры</button></div>}

    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#383e41] px-3 py-3 text-[11px] text-[#aeb5b6] sm:px-4"><span>Показано {filteredRows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredRows.length)} из {filteredRows.length}</span><div className="flex items-center gap-2"><label className="flex items-center gap-1">Строк<select aria-label="Записей на странице" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="border border-[#414749] bg-[#17191b] px-1.5 py-1"><option value={2}>2 · демо</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="border border-[#51595c] px-2 py-1 disabled:opacity-35" aria-label="Предыдущая страница">←</button><span className="tabular-nums">{page} / {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="border border-[#51595c] px-2 py-1 disabled:opacity-35" aria-label="Следующая страница">→</button></div></footer>
  </section>;
}
