"use client";

import { useEffect, useMemo, useState } from "react";

export type SupplierStatus = "Активен" | "На проверке" | "Приостановлен";
export type SupplierEvent = { at: string; text: string; who: string };
export type SupplierRecord = {
  id: string;
  name: string;
  country: string;
  contact: string;
  phone: string;
  email: string;
  specialty: string;
  terms: string;
  status: SupplierStatus;
  lastContact: string;
  lastImportDate?: string | null;
  lastJobStatus?: string | null;
  totalOffers?: number;
  activeOffersCount?: number;
  archivedOffersCount?: number;
  staleOffersCount?: number;
  isPriceStale?: boolean;
  internalNote: string;
  events: SupplierEvent[];
};
export type SupplierFields = Pick<
  SupplierRecord,
  | "name"
  | "country"
  | "contact"
  | "phone"
  | "email"
  | "specialty"
  | "terms"
  | "status"
  | "internalNote"
>;

type SupplierUser = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  userActive: boolean;
  createdAt: string;
};

type SupplierInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expiresAt: string;
};

const statuses: SupplierStatus[] = ["Активен", "На проверке", "Приостановлен"];
const input =
  "mt-1 min-h-10 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]";
const emptyFields: SupplierFields = {
  name: "",
  country: "Россия",
  contact: "",
  phone: "",
  email: "",
  specialty: "",
  terms: "",
  status: "На проверке",
  internalNote: "",
};

export function SupplierRegistry({
  suppliers,
  onSave,
  onStatusChange,
}: {
  suppliers: SupplierRecord[];
  onSave: (id: string | null, fields: SupplierFields) => void;
  onStatusChange: (id: string, status: SupplierStatus) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SupplierStatus>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [emailError, setEmailError] = useState("");

  // Account Management Modal
  const [managingSupplier, setManagingSupplier] = useState<SupplierRecord | null>(null);
  const [supplierUsers, setSupplierUsers] = useState<SupplierUser[]>([]);
  const [supplierInvitations, setSupplierInvitations] = useState<SupplierInvitation[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [accountAction, setAccountAction] = useState<"invite" | "create_direct">("invite");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MANAGER");
  const [directName, setDirectName] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!formOpen && !managingSupplier) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen, managingSupplier]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return suppliers.filter(
      (supplier) =>
        (!statusFilter || supplier.status === statusFilter) &&
        (!query ||
          [supplier.name, supplier.country, supplier.contact, supplier.email].some((value) =>
            value.toLocaleLowerCase("ru-RU").includes(query)
          ))
    );
  }, [suppliers, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setEmailError("");
    setFormOpen(true);
  };

  const openEdit = (supplier: SupplierRecord) => {
    setEditing(supplier);
    setEmailError("");
    setFormOpen(true);
  };

  // Open Account Manager Modal for a supplier
  const openAccountManager = (supplier: SupplierRecord) => {
    setManagingSupplier(supplier);
    setAccountMessage(null);
    setCreatedInviteUrl(null);
    setInviteEmail(supplier.email || "");
    setDirectEmail(supplier.email || "");
    setDirectName(supplier.contact || "");
    setDirectPassword("");
    loadSupplierUsers(supplier.id);
  };

  const loadSupplierUsers = async (supplierId: string) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/users`);
      const data = await res.json();
      if (data.ok) {
        setSupplierUsers(data.users || []);
        setSupplierInvitations(data.invitations || []);
      }
    } catch (e) {
      console.error("Error loading supplier users:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingSupplier) return;
    setAccountMessage(null);
    setCreatedInviteUrl(null);

    try {
      const payload =
        accountAction === "invite"
          ? { action: "invite", email: inviteEmail, role: inviteRole }
          : {
              action: "create_direct",
              name: directName,
              email: directEmail,
              password: directPassword,
              role: inviteRole,
            };

      const res = await fetch(`/api/admin/suppliers/${managingSupplier.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания");

      if (data.invitation) {
        const url = `${window.location.origin}/supplier/invite/${data.invitation.token}`;
        setCreatedInviteUrl(url);
        setAccountMessage({ text: "Приглашение создано! Ссылка готова для отправки." });
      } else {
        setAccountMessage({ text: "Аккаунт успешно создан и активирован." });
        setDirectPassword("");
      }

      loadSupplierUsers(managingSupplier.id);
    } catch (err: any) {
      setAccountMessage({ text: err.message || "Ошибка операции", error: true });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    if (!managingSupplier) return;
    const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    try {
      const res = await fetch(
        `/api/admin/suppliers/${managingSupplier.id}/users/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (res.ok) {
        loadSupplierUsers(managingSupplier.id);
      }
    } catch (e) {
      console.error("Error toggling user status:", e);
    }
  };

  const handleSuspendAllOffers = async () => {
    if (!managingSupplier) return;
    if (
      !confirm(
        `Приостановить все активные товарные предложения поставщика ${managingSupplier.name}?`
      )
    )
      return;

    try {
      const res = await fetch(
        `/api/admin/suppliers/${managingSupplier.id}/suspend-offers`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        setAccountMessage({ text: data.message || "Все предложения приостановлены" });
      } else {
        throw new Error(data.error || "Ошибка");
      }
    } catch (err: any) {
      setAccountMessage({ text: err.message || "Ошибка приостановки", error: true });
    }
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Проверьте формат email.");
      return;
    }
    setEmailError("");
    onSave(editing?.id ?? null, {
      name: String(data.get("name") ?? "").trim(),
      country: String(data.get("country") ?? ""),
      contact: String(data.get("contact") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      email,
      specialty: String(data.get("specialty") ?? "").trim(),
      terms: String(data.get("terms") ?? "").trim(),
      status: String(data.get("status") ?? "На проверке") as SupplierStatus,
      internalNote: String(data.get("internalNote") ?? "").trim(),
    });
    setFormOpen(false);
  };

  const dateLabel = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(date);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff6428]">
            Сеть партнёров · CRM
          </p>
          <h1 className="mt-2 text-3xl font-extrabold uppercase">Поставщики</h1>
          <p className="mt-2 text-sm text-[#aeb5b6]">
            Управление компаниями, контактами и личными кабинетами представителей.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="min-h-10 bg-[#ff6428] px-4 text-xs font-extrabold uppercase text-[#17191b] hover:bg-[#ff8050]"
        >
          Добавить поставщика +
        </button>
      </div>

      <section className="mb-4 border border-[#383e41] bg-[#202325] p-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">
            Поиск поставщика
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Название, страна, контакт, email"
              className={input}
            />
          </label>
          <label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-[#aeb5b6]">
            Статус
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "" | SupplierStatus)}
              className={input}
            >
              <option value="">Все статусы</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <p className="pb-2 text-xs tabular-nums text-[#aeb5b6]">
            Показано <b className="text-[#f1f0eb]">{filtered.length}</b> из {suppliers.length}
          </p>
        </div>
      </section>

      {filtered.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((supplier) => (
            <article key={supplier.id} className="min-w-0 border border-[#383e41] bg-[#202325] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#383e41] pb-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff865c]">
                    {supplier.country}
                  </p>
                  <h2 className="mt-1 break-words text-lg font-extrabold">{supplier.name}</h2>
                  <p className="mt-1 text-[10px] text-[#929a9c]">ID · {supplier.id}</p>
                </div>
                <span
                  className={`shrink-0 border px-2 py-1 text-[10px] font-bold uppercase ${
                    supplier.status === "Активен"
                      ? "border-emerald-700/60 text-emerald-300"
                      : supplier.status === "Приостановлен"
                      ? "border-red-700/60 text-red-300"
                      : "border-[#78543e] text-[#ffb08c]"
                  }`}
                >
                  {supplier.status}
                </span>
              </div>

              <div className="grid gap-3 py-3 sm:grid-cols-2">
                <div className="min-w-0 text-xs leading-5 text-[#c2c8c9]">
                  <p className="font-bold text-[#f1f0eb]">
                    {supplier.contact || "Контактное лицо не указано"}
                  </p>
                  {supplier.phone && <p>{supplier.phone}</p>}
                  {supplier.email && <p className="break-all">{supplier.email}</p>}
                </div>
                <div className="min-w-0 text-xs leading-5 text-[#c2c8c9]">
                  <p>
                    <span className="text-[#929a9c]">Специализация:</span> {supplier.specialty || "—"}
                  </p>
                  <p>
                    <span className="text-[#929a9c]">Условия:</span> {supplier.terms || "—"}
                  </p>
                  <p>
                    <span className="text-[#929a9c]">Прайс-лист:</span>{" "}
                    {supplier.lastContact && supplier.lastContact !== "—" ? (
                      <span className="font-semibold text-[#f1f0eb]">
                        загружен {supplier.lastContact}
                      </span>
                    ) : (
                      <span className="text-[#888b8d]">нет загрузок</span>
                    )}
                  </p>
                  <p>
                    <span className="text-[#929a9c]">Предложений:</span>{" "}
                    <span className="font-bold text-[#ff865c]">
                      {supplier.activeOffersCount ?? 0} активных
                    </span>{" "}
                    {supplier.archivedOffersCount ? (
                      <span className="text-[10px] text-[#888b8d]">
                        ({supplier.archivedOffersCount} архив)
                      </span>
                    ) : null}
                  </p>
                  {supplier.isPriceStale && (
                    <p className="mt-1 inline-block border border-amber-600/60 bg-amber-950/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      ⚠️ Прайс не обновлялся &gt;7 дней
                    </p>
                  )}
                </div>
              </div>

              {supplier.internalNote && (
                <p className="mb-3 border-l-2 border-[#ff6428] bg-[#1a1d1f] px-3 py-2 text-xs text-[#c2c8c9]">
                  <b className="text-[#ff986f]">Заметка CRM:</b> {supplier.internalNote}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-[#383e41] pt-3">
                <button
                  onClick={() => openEdit(supplier)}
                  className="min-h-9 border border-[#51595c] px-3 text-[10px] font-bold uppercase hover:border-[#ff6428]"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => openAccountManager(supplier)}
                  className="min-h-9 bg-[#2e3437] border border-[#ff6428]/50 px-3 text-[10px] font-bold uppercase text-[#ff865c] hover:bg-[#ff6428] hover:text-[#17191b]"
                >
                  Кабинет и пользователи 👤
                </button>
                <label className="flex min-h-9 items-center gap-2 border border-[#414749] px-2 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">
                  Изменить статус
                  <select
                    aria-label={`Изменить статус поставщика ${supplier.name}`}
                    value={supplier.status}
                    onChange={(event) =>
                      onStatusChange(supplier.id, event.target.value as SupplierStatus)
                    }
                    className="max-w-[155px] bg-[#17191b] px-2 py-2 text-[10px] normal-case text-[#f1f0eb] outline-none focus:ring-1 focus:ring-[#ff6428]"
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>

              <details className="mt-3 border-t border-[#383e41] pt-3 text-xs">
                <summary className="cursor-pointer text-[#ff865c]">
                  История взаимодействия · {supplier.events.length + 1}
                </summary>
                <p className="mt-2 text-[#929a9c]">
                  Демо: запрос условий и ответа по артикулам из заявок ZP-2026-0148 / 0147.
                </p>
                {[...supplier.events].reverse().map((entry, index) => (
                  <p
                    key={`${entry.at}-${index}`}
                    className="mt-2 border-t border-[#343d] pt-2 text-[#c2c8c9]"
                  >
                    {entry.text}
                    <small className="mt-1 block text-[10px] text-[#929a9c]">
                      {dateLabel(entry.at)} · {entry.who}
                    </small>
                  </p>
                ))}
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-[#464d50] px-5 py-12 text-center">
          <p className="text-sm font-bold">Поставщики не найдены</p>
          <p className="mt-1 text-xs text-[#929a9c]">Измените поисковый запрос или статусный фильтр.</p>
        </div>
      )}

      {/* Supplier Create/Edit Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/75 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFormOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-form-title"
            className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto border border-[#4b5255] bg-[#202325] p-4 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#383e41] pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ff6428]">
                  Сеть партнёров · CRM
                </p>
                <h2 id="supplier-form-title" className="mt-1 text-xl font-extrabold uppercase">
                  {editing ? "Редактировать поставщика" : "Новый поставщик"}
                </h2>
                <p className="mt-1 text-xs text-[#aeb5b6]">
                  Записи с предложениями нельзя удалить, чтобы сохранить связи.
                </p>
              </div>
              <button
                type="button"
                aria-label="Закрыть форму поставщика"
                onClick={() => setFormOpen(false)}
                className="border border-[#51595c] px-3 py-2 text-sm hover:border-[#ff6428]"
              >
                Закрыть ×
              </button>
            </div>
            <form onSubmit={save} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">
                Название компании *
                <input
                  required
                  name="name"
                  defaultValue={editing?.name ?? emptyFields.name}
                  maxLength={120}
                  className={input}
                />
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">
                Страна *
                <select
                  required
                  name="country"
                  defaultValue={editing?.country ?? emptyFields.country}
                  className={input}
                >
                  <option value="Россия">Россия</option>
                  <option value="Беларусь">Беларусь</option>
                  <option value="Польша">Польша</option>
                </select>
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">
                Статус
                <select
                  name="status"
                  defaultValue={editing?.status ?? emptyFields.status}
                  className={input}
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">
                Контактное лицо
                <input
                  name="contact"
                  defaultValue={editing?.contact ?? ""}
                  maxLength={120}
                  className={input}
                />
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6]">
                Телефон
                <input
                  name="phone"
                  type="tel"
                  defaultValue={editing?.phone ?? ""}
                  maxLength={40}
                  className={input}
                />
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={editing?.email ?? ""}
                  maxLength={254}
                  className={input}
                />
                {emailError && (
                  <span role="alert" className="mt-1 block normal-case text-[#ff986f]">
                    {emailError}
                  </span>
                )}
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">
                Специализация
                <input
                  name="specialty"
                  defaultValue={editing?.specialty ?? ""}
                  maxLength={240}
                  className={input}
                />
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">
                Условия сотрудничества
                <textarea
                  name="terms"
                  rows={2}
                  defaultValue={editing?.terms ?? ""}
                  maxLength={1000}
                  className={input}
                />
              </label>
              <label className="min-w-0 text-[10px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">
                Внутренняя заметка CRM
                <textarea
                  name="internalNote"
                  rows={2}
                  defaultValue={editing?.internalNote ?? ""}
                  maxLength={1000}
                  className={input}
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2 border-t border-[#383e41] pt-4 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-10 border border-[#51595c] px-4 text-xs font-bold uppercase text-[#d0d5d6]"
                >
                  Отмена
                </button>
                <button className="min-h-10 bg-[#ff6428] px-4 text-xs font-extrabold uppercase text-[#17191b]">
                  {editing ? "Сохранить изменения" : "Создать поставщика"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Supplier User Accounts Modal */}
      {managingSupplier && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setManagingSupplier(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="my-auto max-h-[94vh] w-full max-w-4xl overflow-y-auto border border-[#ff6428]/40 bg-[#1e2124] p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#383e41] pb-4">
              <div>
                <span className="border border-[#ff6428] bg-[#ff6428]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ff865c]">
                  Личные кабинеты поставщика
                </span>
                <h2 className="mt-1 text-xl font-black uppercase text-[#f1f0eb]">
                  {managingSupplier.name}
                </h2>
                <p className="mt-1 text-xs text-[#888b8d]">
                  Управление учетными записями представителей, доступом и рассылкой приглашений.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagingSupplier(null)}
                className="border border-[#51595c] px-3 py-1.5 text-xs font-bold uppercase hover:border-[#ff6428]"
              >
                Закрыть ×
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#383e41] bg-[#17191b] p-3">
              <div className="text-xs text-[#888b8d]">
                Быстрые действия с прайсом поставщика:
              </div>
              <button
                type="button"
                onClick={handleSuspendAllOffers}
                className="border border-red-700/60 bg-red-950/20 px-3 py-1.5 text-xs font-bold uppercase text-red-400 hover:bg-red-950/40"
              >
                Приостановить все предложения поставщика ⏸
              </button>
            </div>

            {accountMessage && (
              <div
                className={`mt-4 border p-3 text-xs font-bold ${
                  accountMessage.error
                    ? "border-red-700 bg-red-950/30 text-red-400"
                    : "border-emerald-700 bg-emerald-950/30 text-emerald-300"
                }`}
              >
                {accountMessage.text}
              </div>
            )}

            {createdInviteUrl && (
              <div className="mt-3 border border-[#ff6428] bg-[#29221d] p-3">
                <p className="text-[10px] font-bold uppercase text-[#ff865c]">
                  Ссылка для активации кабинета:
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    readOnly
                    value={createdInviteUrl}
                    className="flex-1 bg-[#17191b] p-2 font-mono text-xs text-[#f1f0eb] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdInviteUrl);
                      alert("Ссылка скопирована в буфер обмена!");
                    }}
                    className="bg-[#ff6428] px-3 py-2 text-xs font-black uppercase text-[#17191b]"
                  >
                    Копировать
                  </button>
                </div>
              </div>
            )}

            {/* Users List */}
            <div className="mt-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#f1f0eb]">
                Представители с доступом ({supplierUsers.length})
              </h3>

              <div className="mt-3 overflow-x-auto border border-[#383e41]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#292e30] text-[10px] uppercase text-[#888b8d]">
                    <tr>
                      <th className="p-3">Имя представителя</th>
                      <th className="p-3">Email для входа</th>
                      <th className="p-3">Роль</th>
                      <th className="p-3">Статус доступа</th>
                      <th className="p-3 text-right">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierUsers.map((u) => (
                      <tr key={u.id} className="border-t border-[#383e41]">
                        <td className="p-3 font-bold text-[#f1f0eb]">{u.name}</td>
                        <td className="p-3 font-mono text-xs text-[#ff865c]">{u.email}</td>
                        <td className="p-3">
                          <span className="border border-[#4c5457] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            {u.role === "OWNER" ? "Владелец" : "Менеджер"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-950/40 text-emerald-400"
                                : "bg-red-950/40 text-red-400"
                            }`}
                          >
                            {u.status === "ACTIVE" ? "Активен" : "Заблокирован"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleUserStatus(u.id, u.status)}
                            className="border border-[#4c5457] px-2 py-1 text-[10px] font-bold uppercase hover:border-[#ff6428]"
                          >
                            {u.status === "ACTIVE" ? "Заблокировать" : "Разблокировать"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loadingUsers && supplierUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-xs text-[#888b8d]">
                          Пока нет созданных пользователей для этого поставщика.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invitations List */}
            {supplierInvitations.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#f1f0eb]">
                  Активные приглашения ({supplierInvitations.length})
                </h3>
                <div className="mt-2 overflow-x-auto border border-[#383e41]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#292e30] text-[10px] uppercase text-[#888b8d]">
                      <tr>
                        <th className="p-2">Email</th>
                        <th className="p-2">Роль</th>
                        <th className="p-2">Статус</th>
                        <th className="p-2">Истекает</th>
                        <th className="p-2 text-right">Ссылка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierInvitations.map((inv) => (
                        <tr key={inv.id} className="border-t border-[#383e41]">
                          <td className="p-2 font-mono text-[#f1f0eb]">{inv.email}</td>
                          <td className="p-2 uppercase text-[10px]">{inv.role}</td>
                          <td className="p-2 text-[10px]">{inv.status}</td>
                          <td className="p-2 text-[10px] text-[#888b8d]">
                            {new Intl.DateTimeFormat("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(inv.expiresAt))}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const url = `${window.location.origin}/supplier/invite/${inv.token}`;
                                navigator.clipboard.writeText(url);
                                alert("Ссылка скопирована!");
                              }}
                              className="text-[10px] font-bold uppercase text-[#ff865c] hover:underline"
                            >
                              Копировать ссылку
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Create / Invite Form */}
            <div className="mt-6 border-t border-[#383e41] pt-5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setAccountAction("invite")}
                  className={`text-xs font-black uppercase ${
                    accountAction === "invite" ? "text-[#ff6428] underline" : "text-[#888b8d]"
                  }`}
                >
                  Отправить приглашение
                </button>
                <span className="text-[#383e41]">|</span>
                <button
                  type="button"
                  onClick={() => setAccountAction("create_direct")}
                  className={`text-xs font-black uppercase ${
                    accountAction === "create_direct" ? "text-[#ff6428] underline" : "text-[#888b8d]"
                  }`}
                >
                  Создать логин и пароль напрямую
                </button>
              </div>

              <form onSubmit={handleAccountSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
                {accountAction === "invite" ? (
                  <>
                    <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                      Email для приглашения *
                      <input
                        required
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="rep@supplier.com"
                        className={input}
                      />
                    </label>

                    <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                      Роль в кабинете
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className={input}
                      >
                        <option value="MANAGER">Менеджер прайса (MANAGER)</option>
                        <option value="OWNER">Владелец компании (OWNER)</option>
                      </select>
                    </label>

                    <div className="sm:col-span-2 flex justify-end pt-2">
                      <button
                        type="submit"
                        className="bg-[#ff6428] px-5 py-2.5 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45]"
                      >
                        Сгенерировать приглашение →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                      Имя представителя *
                      <input
                        required
                        value={directName}
                        onChange={(e) => setDirectName(e.target.value)}
                        placeholder="Алексей Смирнов"
                        className={input}
                      />
                    </label>

                    <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                      Email для входа *
                      <input
                        required
                        type="email"
                        value={directEmail}
                        onChange={(e) => setDirectEmail(e.target.value)}
                        placeholder="login@supplier.com"
                        className={input}
                      />
                    </label>

                    <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                      Пароль для входа (мин. 12 символов) *
                      <input
                        required
                        type="password"
                        minLength={12}
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        className={input}
                      />
                    </label>

                    <label className="text-[10px] font-bold uppercase text-[#888b8d]">
                      Роль в кабинете
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className={input}
                      >
                        <option value="MANAGER">Менеджер прайса (MANAGER)</option>
                        <option value="OWNER">Владелец компании (OWNER)</option>
                      </select>
                    </label>

                    <div className="sm:col-span-2 flex justify-end pt-2">
                      <button
                        type="submit"
                        className="bg-[#ff6428] px-5 py-2.5 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45]"
                      >
                        Создать аккаунт →
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
