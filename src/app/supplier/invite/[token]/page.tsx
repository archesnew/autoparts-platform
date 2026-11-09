"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function SupplierInvitePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(props.params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{
    email: string;
    role: string;
    supplier: { id: string; name: string; countryCode: string };
  } | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/supplier/invitations/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "Недействительное приглашение");
        } else {
          setInviteData(data);
        }
      })
      .catch(() => setError("Ошибка связи с сервером"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password !== passwordConfirm) {
      setSubmitError("Пароли не совпадают");
      return;
    }

    if (password.length < 12) {
      setSubmitError("Пароль должен содержать не менее 12 символов");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/supplier/invitations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка активации аккаунта");

      // Auto login via Better Auth sign-in
      const loginRes = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteData?.email,
          password,
        }),
      });

      if (loginRes.ok) {
        router.push("/supplier");
      } else {
        router.push("/login?callbackUrl=/supplier");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Не удалось активировать приглашение");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2.5 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#17191b] p-4 text-[#f1f0eb]">
      <div className="w-full max-w-md border border-[#4b5255] bg-[#202325] p-6 sm:p-8">
        <BrandLogo variant="dark" className="mx-auto w-36" />

        <div className="mt-6 text-center">
          <span className="border border-[#ff6428]/40 bg-[#ff6428]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ff865c]">
            Приглашение представителя
          </span>
          <h1 className="mt-2 text-xl font-black uppercase text-[#f1f0eb]">
            Активация кабинета
          </h1>
        </div>

        {loading && (
          <p className="mt-6 text-center text-xs text-[#888b8d]">
            Проверяем приглашение...
          </p>
        )}

        {error && (
          <div className="mt-6 border border-red-800/40 bg-red-950/20 p-4 text-center">
            <p className="text-xs font-bold text-red-400">{error}</p>
            <Link
              href="/login"
              className="mt-4 inline-block text-xs font-bold uppercase text-[#ff865c]"
            >
              Перейти к входу →
            </Link>
          </div>
        )}

        {inviteData && (
          <form onSubmit={handleAccept} className="mt-6 space-y-4">
            <div className="border border-[#383e41] bg-[#17191b] p-3 text-xs">
              <p className="text-[10px] uppercase text-[#888b8d]">Поставщик</p>
              <p className="font-bold text-[#f1f0eb]">{inviteData.supplier.name}</p>
              <p className="mt-1 text-[10px] uppercase text-[#888b8d]">Email аккаунта</p>
              <p className="font-mono text-[#ff865c]">{inviteData.email}</p>
            </div>

            <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
              Ваше имя и фамилия *
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                className={inputClass}
              />
            </label>

            <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
              Пароль для входа (мин. 12 символов) *
              <input
                required
                type="password"
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
              Повторите пароль *
              <input
                required
                type="password"
                minLength={12}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputClass}
              />
            </label>

            {submitError && (
              <p className="border border-red-800 bg-red-950/30 p-2 text-xs text-red-400">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#ff6428] py-3 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45] disabled:opacity-50"
            >
              {submitting ? "Активация..." : "Завершить регистрацию и войти →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
