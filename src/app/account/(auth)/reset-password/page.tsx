"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function CustomerResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token || !email) {
      setError("Ссылка для сброса пароля не содержит токена или email.");
      return;
    }

    if (newPassword.length < 12) {
      setError("Пароль должен содержать не менее 12 символов.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Введённые пароли не совпадают.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/customer/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сброса пароля");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/account/login");
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить пароль");
    } finally {
      setLoading(false);
    }
  }

  const isPasswordLongEnough = newPassword.length >= 12;

  return (
    <div>
      <h1 className="text-xl font-extrabold uppercase tracking-tight text-[#f1f0eb]">
        Новый пароль
      </h1>
      <p className="mt-1.5 text-xs text-[#888b8d]">
        Установите новый пароль для учётной записи <b>{email || "покупателя"}</b>
      </p>

      {error && (
        <div className="mt-4 border border-red-900/50 bg-red-950/20 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {success ? (
        <div className="mt-5 space-y-4">
          <div className="border border-emerald-900/50 bg-emerald-950/20 p-4 text-xs text-emerald-200">
            <p className="font-bold">Пароль успешно обновлён!</p>
            <p className="mt-1 text-[#c5cbcc]">
              Сейчас произойдёт автоматическое перенаправление на страницу входа...
            </p>
          </div>
          <div className="text-center pt-2">
            <Link
              href="/account/login"
              className="inline-block bg-[#ff6428] px-4 py-2 text-xs font-bold uppercase text-[#17191b]"
            >
              Войти сейчас →
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
                Новый пароль *
              </label>
              <span
                className={`text-[9px] font-bold uppercase ${
                  isPasswordLongEnough ? "text-emerald-400" : "text-[#888b8d]"
                }`}
              >
                {newPassword.length}/12+ символов
              </span>
            </div>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 12 символов"
              className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2.5 text-sm text-[#f1f0eb] outline-none transition focus:border-[#ff6428]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
              Повторите новый пароль *
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите введённый пароль"
              className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2.5 text-sm text-[#f1f0eb] outline-none transition focus:border-[#ff6428]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff6428] py-3 text-xs font-extrabold uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050] disabled:opacity-50"
          >
            {loading ? "Сохранение..." : "Сохранить новый пароль"}
          </button>

          <div className="border-t border-[#383e41] pt-4 text-center text-xs text-[#888b8d]">
            <Link href="/account/login" className="text-[#aeb5b6] hover:text-[#f1f0eb]">
              ← Отмена и вход
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
