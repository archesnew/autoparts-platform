"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function CustomerForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    resetUrl?: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/customer/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка запроса сброса пароля");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки запроса");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold uppercase tracking-tight text-[#f1f0eb]">
        Восстановление пароля
      </h1>
      <p className="mt-1.5 text-xs text-[#888b8d]">
        Укажите email, привязанный к вашему аккаунту покупателя
      </p>

      {error && (
        <div className="mt-4 border border-red-900/50 bg-red-950/20 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="border border-emerald-900/50 bg-emerald-950/20 p-4 text-xs text-emerald-200">
            <p className="font-bold">Запрос принят</p>
            <p className="mt-1 text-[#c5cbcc]">{result.message}</p>
          </div>

          <div className="border border-[#383e41] bg-[#17191b] p-4 text-xs text-[#c5cbcc]">
            <p className="font-bold uppercase tracking-wide text-[#ff986f]">
              Быстрый вход по SMS
            </p>
            <p className="mt-1">
              Для покупателей ZAPTUT.PRO основной безопасный вход и восстановление доступа работают по одноразовому SMS-коду без использования пароля.
            </p>
            <div className="mt-3">
              <Link
                href="/account/login"
                className="inline-block bg-[#ff6428] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
              >
                Войти по номеру телефона →
              </Link>
            </div>
          </div>

          <div className="pt-2 text-center text-xs">
            <Link href="/account/login" className="text-[#aeb5b6] hover:text-[#f1f0eb]">
              ← Вернуться к экрану входа
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
              Электронная почта
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.ru"
              className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2.5 text-sm text-[#f1f0eb] outline-none transition focus:border-[#ff6428]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff6428] py-3 text-xs font-extrabold uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050] disabled:opacity-50"
          >
            {loading ? "Формирование запроса..." : "Получить ссылку для сброса"}
          </button>

          <div className="border-t border-[#383e41] pt-4 text-center text-xs text-[#888b8d]">
            Вспомнили пароль?{" "}
            <Link href="/account/login" className="font-bold text-[#ff6428] hover:underline">
              Войти
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
