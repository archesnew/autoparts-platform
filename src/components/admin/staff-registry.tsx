"use client";

import { useEffect, useMemo, useState } from "react";
import type { StaffMemberDto, StaffInvitationDto, StaffAuditEntryDto } from "@/lib/server/staff-management-service.ts";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Главный администратор",
  ADMIN: "Администратор",
  MANAGER: "Менеджер по закупкам",
  LOGISTICS: "Логист",
};

const ROLE_BADGES: Record<string, string> = {
  SUPER_ADMIN: "border-[#ff6428] bg-[#ff6428]/20 text-[#ff865c] font-black",
  ADMIN: "border-purple-500/50 bg-purple-950/20 text-purple-300 font-bold",
  MANAGER: "border-blue-500/50 bg-blue-950/20 text-blue-300 font-bold",
  LOGISTICS: "border-amber-500/50 bg-amber-950/20 text-amber-300 font-bold",
};

const INVITATION_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Ожидает активации", tone: "border-[#ff986f]/60 bg-[#ff986f]/15 text-[#ff986f]" },
  ACCEPTED: { label: "Принято", tone: "border-emerald-500/50 bg-emerald-950/20 text-emerald-300" },
  EXPIRED: { label: "Истекло", tone: "border-[#888b8d]/40 bg-[#888b8d]/10 text-[#888b8d]" },
  REVOKED: { label: "Отозвано", tone: "border-red-900/50 bg-red-950/20 text-red-400" },
};

const panelClass = "border border-[#383e41] bg-[#1e2124]";
const inputClass = "w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]";

export function StaffRegistry({
  currentStaffId,
  currentStaffRole,
}: {
  currentStaffId?: string;
  currentStaffRole?: string;
}) {
  const isSuperAdmin = currentStaffRole === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState<"staff" | "invitations">("staff");
  const [staffList, setStaffList] = useState<StaffMemberDto[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitationDto[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<{ code: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMemberDto | null>(null);
  const [auditTarget, setAuditTarget] = useState<StaffMemberDto | null>(null);
  const [auditLogs, setAuditLogs] = useState<StaffAuditEntryDto[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Create form draft
  const [createDraft, setCreateDraft] = useState({
    name: "",
    email: "",
    jobTitle: "",
    role: "MANAGER" as "ADMIN" | "MANAGER" | "LOGISTICS",
    permissions: [] as { permissionCode: string; effect: "GRANT" | "DENY" }[],
  });
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit form draft
  const [editDraft, setEditDraft] = useState({
    name: "",
    jobTitle: "",
    role: "MANAGER" as "ADMIN" | "MANAGER" | "LOGISTICS",
    permissions: [] as { permissionCode: string; effect: "GRANT" | "DENY" }[],
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [staffRes, invRes, permRes] = await Promise.all([
        fetch("/api/admin/staff"),
        fetch("/api/admin/staff/invitations"),
        fetch("/api/admin/staff/permissions"),
      ]);

      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(data.staff || []);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setInvitations(data.invitations || []);
      }
      if (permRes.ok) {
        const data = await permRes.json();
        setAvailablePermissions(data.permissions || []);
      }
    } catch {
      showToast("Ошибка загрузки данных сотрудников");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.jobTitle.toLowerCase().includes(search.toLowerCase());

      const matchRole = !roleFilter || s.role === roleFilter;
      const matchStatus =
        !statusFilter ||
        (statusFilter === "active" ? s.active : !s.active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [staffList, search, roleFilter, statusFilter]);

  // Handle invitation creation
  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/admin/staff/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createDraft),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания приглашения");

      setCreatedInviteUrl(data.invitation.inviteUrl);
      showToast(`Приглашение создано для ${data.invitation.email}`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Не удалось создать приглашение");
    } finally {
      setCreateSubmitting(false);
    }
  }

  // Handle revoke invitation
  async function handleRevokeInvitation(id: string) {
    if (!confirm("Отозвать это приглашение? Ссылка станет недействительной.")) return;
    try {
      const res = await fetch(`/api/admin/staff/invitations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отзыва");
      showToast("Приглашение отозвано");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Не удалось отозвать приглашение");
    }
  }

  // Handle edit staff submit
  async function handleEditStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStaff) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/staff/${editingStaff.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editDraft),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");

      showToast("Данные сотрудника обновлены");
      setEditingStaff(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Не удалось сохранить изменения");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Toggle active status (block / unblock)
  async function handleToggleActive(staff: StaffMemberDto) {
    const actionName = staff.active ? "заблокировать" : "разблокировать";
    if (
      !confirm(
        `Вы уверены, что хотите ${actionName} сотрудника ${staff.name}? ${
          staff.active ? "Все активные сессии будут немедленно завершены." : ""
        }`,
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/staff/${staff.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !staff.active }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка изменения статуса");

      showToast(`Сотрудник ${staff.active ? "заблокирован" : "разблокирован"}`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Ошибка изменения статуса");
    }
  }

  // Terminate all sessions
  async function handleTerminateSessions(staff: StaffMemberDto) {
    if (!confirm(`Завершить все активные сессии для ${staff.name}? Пользователь будет принудительно разлогинен.`))
      return;

    try {
      const res = await fetch(`/api/admin/staff/${staff.id}/sessions`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка завершения сессий");

      showToast(`Сессии завершены (закрыто: ${data.terminatedCount})`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Не удалось завершить сессии");
    }
  }

  // View audit history
  async function handleOpenAudit(staff: StaffMemberDto) {
    setAuditTarget(staff);
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/staff/audit?userId=${staff.id}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {
      showToast("Ошибка загрузки истории действий");
    } finally {
      setAuditLoading(false);
    }
  }

  function startEdit(staff: StaffMemberDto) {
    setEditingStaff(staff);
    setEditDraft({
      name: staff.name,
      jobTitle: staff.jobTitle,
      role: (staff.role as any) || "MANAGER",
      permissions: staff.permissionOverrides || [],
    });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Ссылка скопирована в буфер обмена");
    } catch {
      showToast("Скопируйте ссылку вручную");
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Action */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
            Управление командой · RBAC
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase sm:text-3xl">
            Сотрудники
          </h1>
          <p className="mt-1 text-xs text-[#888b8d]">
            Внутренние пользователи CRM, права доступа, безопасные приглашения и контроль сессий.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => {
              setCreatedInviteUrl(null);
              setCreateDraft({
                name: "",
                email: "",
                jobTitle: "",
                role: "MANAGER",
                permissions: [],
              });
              setCreateModalOpen(true);
            }}
            className="min-h-10 border border-[#ff6428] bg-[#ff6428] px-5 text-xs font-extrabold uppercase tracking-wider text-[#17191b] shadow-lg transition hover:bg-[#ff8050]"
          >
            + Создать сотрудника
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#383e41]">
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "staff"
              ? "border-[#ff6428] text-[#f1f0eb]"
              : "border-transparent text-[#888b8d] hover:text-[#f1f0eb]"
          }`}
        >
          Активные сотрудники ({staffList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invitations")}
          className={`border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "invitations"
              ? "border-[#ff6428] text-[#f1f0eb]"
              : "border-transparent text-[#888b8d] hover:text-[#f1f0eb]"
          }`}
        >
          Приглашения ({invitations.filter((i) => i.status === "PENDING").length} активных)
        </button>
      </div>

      {/* TAB 1: STAFF LIST */}
      {activeTab === "staff" && (
        <div className="space-y-3">
          {/* Filters Bar */}
          <div className={`${panelClass} grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]`}>
            <input
              type="text"
              placeholder="Поиск по ФИО, email или должности..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">Все роли</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="LOGISTICS">LOGISTICS</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">Все статусы</option>
              <option value="active">Активен</option>
              <option value="blocked">Заблокирован</option>
            </select>
          </div>

          {/* Table */}
          <div className={`${panelClass} overflow-x-auto`}>
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[#292e30] text-[10px] uppercase text-[#aeb5b6]">
                <tr>
                  <th className="p-3">Сотрудник / Должность</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Роль в системе</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Сессии</th>
                  <th className="p-3">Создан</th>
                  <th className="p-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#888b8d]">
                      Загрузка сотрудников...
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#888b8d]">
                      Сотрудники не найдены по заданным критериям
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const isSelf = staff.id === currentStaffId;
                    const isTargetSuper = staff.role === "SUPER_ADMIN";

                    return (
                      <tr
                        key={staff.id}
                        className={`border-t border-[#383e41] transition ${
                          !staff.active ? "bg-red-950/10 opacity-70" : "hover:bg-[#24282b]"
                        }`}
                      >
                        <td className="p-3">
                          <div className="font-bold text-[#f1f0eb]">
                            {staff.name}
                            {isSelf && (
                              <span className="ml-2 border border-[#ff6428] px-1 py-0.5 text-[9px] uppercase text-[#ff865c]">
                                Это вы
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#888b8d]">
                            {staff.jobTitle || "Должность не указана"}
                          </div>
                        </td>

                        <td className="p-3 font-mono text-[11px] text-[#c2c8c9]">
                          {staff.email}
                        </td>

                        <td className="p-3">
                          <span
                            className={`inline-block border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                              ROLE_BADGES[staff.role] || "border-[#414749] text-[#c2c8c9]"
                            }`}
                          >
                            {ROLE_LABELS[staff.role] || staff.role}
                          </span>
                        </td>

                        <td className="p-3">
                          {staff.active ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Активен
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              Заблокирован
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <span className="tabular-nums font-semibold text-[#f1f0eb]">
                            {staff.activeSessionCount}
                          </span>
                          <span className="ml-1 text-[10px] text-[#888b8d]">
                            {staff.activeSessionCount === 1 ? "сессия" : "сессий"}
                          </span>
                        </td>

                        <td className="p-3 tabular-nums text-[11px] text-[#888b8d]">
                          {new Intl.DateTimeFormat("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }).format(new Date(staff.createdAt))}
                        </td>

                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAudit(staff)}
                              title="История действий"
                              className="border border-[#414749] px-2 py-1 text-[10px] uppercase text-[#888b8d] hover:border-[#ff6428] hover:text-[#f1f0eb]"
                            >
                              История
                            </button>

                            {isSuperAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(staff)}
                                  disabled={isTargetSuper && !isSelf}
                                  title="Редактировать"
                                  className="border border-[#51595c] px-2 py-1 text-[10px] font-bold uppercase text-[#ff865c] hover:border-[#ff6428] disabled:opacity-40"
                                >
                                  Изменить
                                </button>

                                {staff.activeSessionCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleTerminateSessions(staff)}
                                    title="Завершить все сессии"
                                    className="border border-[#51595c] px-2 py-1 text-[10px] uppercase text-amber-300 hover:border-amber-400"
                                  >
                                    Сброс сессий
                                  </button>
                                )}

                                {!isSelf && !isTargetSuper && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(staff)}
                                    title={staff.active ? "Заблокировать" : "Разблокировать"}
                                    className={`border px-2 py-1 text-[10px] font-bold uppercase ${
                                      staff.active
                                        ? "border-red-900/60 text-red-400 hover:border-red-600"
                                        : "border-emerald-800 text-emerald-400 hover:border-emerald-600"
                                    }`}
                                  >
                                    {staff.active ? "Блок" : "Активировать"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeTab === "invitations" && (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-[#292e30] text-[10px] uppercase text-[#aeb5b6]">
              <tr>
                <th className="p-3">Сотрудник / Должность</th>
                <th className="p-3">Email</th>
                <th className="p-3">Роль</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Срок действия (7 дней)</th>
                <th className="p-3">Кем приглашён</th>
                <th className="p-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#888b8d]">
                    Приглашений пока нет. Нажмите «+ Создать сотрудника», чтобы отправить приглашение.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => {
                  const statusInfo = INVITATION_STATUS_LABELS[inv.status] || {
                    label: inv.status,
                    tone: "border-[#414749] text-[#c2c8c9]",
                  };

                  return (
                    <tr key={inv.id} className="border-t border-[#383e41]">
                      <td className="p-3">
                        <div className="font-bold text-[#f1f0eb]">{inv.name}</div>
                        <div className="text-[11px] text-[#888b8d]">
                          {inv.jobTitle || "Должность не указана"}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-[#c2c8c9]">{inv.email}</td>

                      <td className="p-3">
                        <span className={`inline-block border px-2 py-0.5 text-[9px] uppercase ${ROLE_BADGES[inv.role]}`}>
                          {ROLE_LABELS[inv.role] || inv.role}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase ${statusInfo.tone}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="p-3 tabular-nums text-[11px] text-[#888b8d]">
                        до{" "}
                        {new Intl.DateTimeFormat("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(inv.expiresAt))}
                      </td>

                      <td className="p-3 text-[11px] text-[#888b8d]">
                        {inv.invitedByName || "SUPER_ADMIN"}
                      </td>

                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {inv.status === "PENDING" && inv.inviteUrl && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(inv.inviteUrl!)}
                              className="border border-[#ff6428] px-2 py-1 text-[10px] font-bold uppercase text-[#ff865c] hover:bg-[#ff6428]/15"
                            >
                              📋 Скопировать ссылку
                            </button>
                          )}

                          {isSuperAdmin && inv.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              className="border border-red-900/60 px-2 py-1 text-[10px] uppercase text-red-400 hover:border-red-600"
                            >
                              Отозвать
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE INVITATION MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg border border-[#4b5255] bg-[#202325] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#383e41] pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
                  Новый аккаунт
                </p>
                <h2 className="mt-1 text-lg font-extrabold uppercase">
                  Пригласить сотрудника
                </h2>
                <p className="mt-0.5 text-xs text-[#888b8d]">
                  Генерирует защищённую ссылку активации со сроком действия 7 дней.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-sm text-[#888b8d] hover:text-[#f1f0eb]"
              >
                ✕
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="mt-4 space-y-4">
                <div className="border border-emerald-900/50 bg-emerald-950/30 p-3 text-xs text-emerald-300">
                  Приглашение успешно создано! Отправьте эту ссылку новому сотруднику для самостоятельной установки пароля:
                </div>

                <div className="border border-[#414749] bg-[#17191b] p-3">
                  <div className="break-all font-mono text-xs text-[#ff986f]">
                    {createdInviteUrl}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdInviteUrl)}
                    className="flex-1 bg-[#ff6428] py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
                  >
                    Скопировать ссылку
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="border border-[#51595c] px-4 py-2.5 text-xs font-bold uppercase text-[#f1f0eb]"
                  >
                    Готово
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvitation} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    ФИО сотрудника *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Иван Петров"
                    value={createDraft.name}
                    onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Email для входа *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ivan@zaptut.pro"
                    value={createDraft.email}
                    onChange={(e) => setCreateDraft({ ...createDraft, email: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Должность
                  </label>
                  <input
                    type="text"
                    placeholder="Ведущий менеджер по закупкам"
                    value={createDraft.jobTitle}
                    onChange={(e) => setCreateDraft({ ...createDraft, jobTitle: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Роль сотрудника *
                  </label>
                  <select
                    value={createDraft.role}
                    onChange={(e) =>
                      setCreateDraft({
                        ...createDraft,
                        role: e.target.value as "ADMIN" | "MANAGER" | "LOGISTICS",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="MANAGER">MANAGER (Менеджер по закупкам)</option>
                    <option value="ADMIN">ADMIN (Администратор CRM)</option>
                    <option value="LOGISTICS">LOGISTICS (Логист)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-[#888b8d]">
                    Роль SUPER_ADMIN не может быть создана через обычную форму.
                  </p>
                </div>

                {/* Individual Permissions Override */}
                <details className="border border-[#383e41] p-2.5">
                  <summary className="cursor-pointer text-[10px] font-bold uppercase text-[#ff865c]">
                    Индивидуальные разрешения ({createDraft.permissions.length} переопределений)
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {availablePermissions.map((perm) => {
                      const override = createDraft.permissions.find((p) => p.permissionCode === perm.code);
                      return (
                        <div
                          key={perm.code}
                          className="flex items-center justify-between border-b border-[#2d3133] py-1 text-[11px]"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-[#f1f0eb]">{perm.code}</span>
                            <span className="ml-1 text-[10px] text-[#888b8d]">{perm.description}</span>
                          </div>
                          <select
                            value={override?.effect || "DEFAULT"}
                            onChange={(e) => {
                              const val = e.target.value;
                              const filtered = createDraft.permissions.filter((p) => p.permissionCode !== perm.code);
                              if (val === "GRANT" || val === "DENY") {
                                setCreateDraft({
                                  ...createDraft,
                                  permissions: [...filtered, { permissionCode: perm.code, effect: val }],
                                });
                              } else {
                                setCreateDraft({ ...createDraft, permissions: filtered });
                              }
                            }}
                            className="border border-[#414749] bg-[#17191b] px-1.5 py-0.5 text-[10px] text-[#f1f0eb]"
                          >
                            <option value="DEFAULT">По роли</option>
                            <option value="GRANT">РАЗРЕШИТЬ (+)</option>
                            <option value="DENY">ЗАПРЕТИТЬ (-)</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </details>

                <div className="flex justify-end gap-2 border-t border-[#383e41] pt-3">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="border border-[#51595c] px-4 py-2 text-xs font-bold uppercase text-[#f1f0eb]"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="bg-[#ff6428] px-5 py-2 text-xs font-extrabold uppercase text-[#17191b] hover:bg-[#ff8050] disabled:opacity-50"
                  >
                    {createSubmitting ? "Создание..." : "Сформировать приглашение"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg border border-[#4b5255] bg-[#202325] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#383e41] pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
                  Редактирование профиля
                </p>
                <h2 className="mt-1 text-lg font-extrabold uppercase">
                  {editingStaff.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-[#888b8d]">
                  {editingStaff.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-sm text-[#888b8d] hover:text-[#f1f0eb]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                  ФИО сотрудника
                </label>
                <input
                  type="text"
                  required
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                  Должность
                </label>
                <input
                  type="text"
                  value={editDraft.jobTitle}
                  onChange={(e) => setEditDraft({ ...editDraft, jobTitle: e.target.value })}
                  className={inputClass}
                />
              </div>

              {editingStaff.role !== "SUPER_ADMIN" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Роль в системе
                  </label>
                  <select
                    value={editDraft.role}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        role: e.target.value as "ADMIN" | "MANAGER" | "LOGISTICS",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="MANAGER">MANAGER (Менеджер по закупкам)</option>
                    <option value="ADMIN">ADMIN (Администратор CRM)</option>
                    <option value="LOGISTICS">LOGISTICS (Логист)</option>
                  </select>
                </div>
              )}

              {/* Individual Permissions Override */}
              <details className="border border-[#383e41] p-2.5">
                <summary className="cursor-pointer text-[10px] font-bold uppercase text-[#ff865c]">
                  Индивидуальные разрешения ({editDraft.permissions.length} переопределений)
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {availablePermissions.map((perm) => {
                    const override = editDraft.permissions.find((p) => p.permissionCode === perm.code);
                    return (
                      <div
                        key={perm.code}
                        className="flex items-center justify-between border-b border-[#2d3133] py-1 text-[11px]"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-mono text-[#f1f0eb]">{perm.code}</span>
                          <span className="ml-1 text-[10px] text-[#888b8d]">{perm.description}</span>
                        </div>
                        <select
                          value={override?.effect || "DEFAULT"}
                          onChange={(e) => {
                            const val = e.target.value;
                            const filtered = editDraft.permissions.filter((p) => p.permissionCode !== perm.code);
                            if (val === "GRANT" || val === "DENY") {
                              setEditDraft({
                                ...editDraft,
                                permissions: [...filtered, { permissionCode: perm.code, effect: val }],
                              });
                            } else {
                              setEditDraft({ ...editDraft, permissions: filtered });
                            }
                          }}
                          className="border border-[#414749] bg-[#17191b] px-1.5 py-0.5 text-[10px] text-[#f1f0eb]"
                        >
                          <option value="DEFAULT">По роли</option>
                          <option value="GRANT">РАЗРЕШИТЬ (+)</option>
                          <option value="DENY">ЗАПРЕТИТЬ (-)</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </details>

              <div className="flex justify-end gap-2 border-t border-[#383e41] pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="border border-[#51595c] px-4 py-2 text-xs font-bold uppercase text-[#f1f0eb]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="bg-[#ff6428] px-5 py-2 text-xs font-extrabold uppercase text-[#17191b] hover:bg-[#ff8050] disabled:opacity-50"
                >
                  {editSubmitting ? "Сохранение..." : "Сохранить изменения"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {auditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl border border-[#4b5255] bg-[#202325] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#383e41] pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
                  Аудит безопасности
                </p>
                <h2 className="mt-1 text-lg font-extrabold uppercase">
                  История действий: {auditTarget.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-[#888b8d]">
                  {auditTarget.email} · {auditTarget.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuditTarget(null)}
                className="text-sm text-[#888b8d] hover:text-[#f1f0eb]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-2">
              {auditLoading ? (
                <div className="py-8 text-center text-xs text-[#888b8d]">
                  Загрузка журнала аудита...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#888b8d]">
                  Записей в журнале пока нет
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-[#383e41] bg-[#1a1d1f] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#ff865c]">{log.action}</span>
                      <span className="tabular-nums text-[10px] text-[#888b8d]">
                        {new Intl.DateTimeFormat("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }).format(new Date(log.occurredAt))}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#c2c8c9]">
                      Инициатор: <span className="font-semibold text-[#f1f0eb]">{log.actorName}</span>
                    </div>
                    {log.details && (
                      <pre className="mt-2 overflow-x-auto bg-[#141618] p-2 text-[10px] text-[#aeb5b6]">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-[#383e41] pt-3">
              <button
                type="button"
                onClick={() => setAuditTarget(null)}
                className="border border-[#51595c] px-4 py-2 text-xs font-bold uppercase text-[#f1f0eb]"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 border border-[#ff6428] bg-[#1e2124] px-4 py-3 text-xs text-[#f1f0eb] shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
