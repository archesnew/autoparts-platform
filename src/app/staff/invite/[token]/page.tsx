"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Главный администратор",
  ADMIN: "Администратор",
  MANAGER: "Менеджер по закупкам",
  LOGISTICS: "Логист",
};

export default function StaffInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{
    id: string;
    email: string;
    name: string;
    jobTitle: string;
    role: string;
    expiresAt: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Не указан токен приглашения");
      setLoading(false);
      return;
    }

    fetch(`/api/staff/invitations/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Приглашение не найдено или устарело");
        }
        return res.json();
      })
      .then((data) => {
        setInvitation(data.invitation);
        setName(data.invitation.name);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Укажите ваше имя");
      return;
    }
    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/staff/invitations/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось активировать аккаунт");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Ошибка активации аккаунта");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#17191b] p-4 text-[#f1f0eb]">
      <div className="w-full max-w-md border border-[#383e41] bg-[#1e2124] p-6 sm:p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo variant="light" className="w-48" sizes="192px" />
          <h1 className="mt-5 text-xl font-extrabold uppercase tracking-wide">
            Активация аккаунта сотрудника
          </h1>
          <p className="mt-1 text-xs text-[#888b8d]">
            Внутренняя CRM-платформа ZAPTUT.PRO
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#888b8d]">
            Проверка приглашения...
          </div>
        ) : error && !invitation ? (
          <div className="space-y-4 py-4 text-center">
            <div className="border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
              {error}
            </div>
            <Link
              href="/login"
              className="inline-block border border-[#51595c] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] hover:border-[#ff6428]"
            >
              Перейти ко входу
            </Link>
          </div>
        ) : success ? (
          <div className="space-y-5 py-4 text-center">
            <div className="border border-emerald-900/50 bg-emerald-950/30 p-4 text-sm text-emerald-400">
              Аккаунт успешно активирован! Теперь вы можете войти в рабочее пространство CRM со своим паролем.
            </div>
            <Link
              href="/login"
              className="inline-block w-full bg-[#ff6428] py-3 text-center text-xs font-extrabold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
            >
              Войти в CRM →
            </Link>
          </div>
        ) : (
          invitation && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border border-[#383e41] bg-[#17191b] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#888b8d]">Email:</span>
                  <span className="font-mono text-[#f1f0eb]">{invitation.email}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[#888b8d]">Роль в системе:</span>
                  <span className="font-bold text-[#ff865c]">
                    {ROLE_LABELS[invitation.role] || invitation.role}
                  </span>
                </div>
                {invitation.jobTitle && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[#888b8d]">Должность:</span>
                    <span className="text-[#f1f0eb]">{invitation.jobTitle}</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="border border-red-900/50 bg-red-950/20 p-3 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                  ФИО сотрудника
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                  Придумайте пароль (минимум 8 символов)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                  Подтвердите пароль
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#ff6428] py-3 text-xs font-extrabold uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050] disabled:opacity-50"
              >
                {submitting ? "Активация..." : "Активировать аккаунт и установить пароль"}
              </button>

              <p className="text-center text-[10px] text-[#888b8d]">
                Срок действия ссылки — 7 дней с момента отправки.
              </p>
            </form>
          )
        )}
      </div>
    </div>
  );
}
