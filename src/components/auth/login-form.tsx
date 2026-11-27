"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "@/components/brand/brand-logo";
import { IconEye, IconEyeOff } from "@/components/ui/icons";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || searchParams.get("redirect") || "/admin";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(form.get("email")).trim().toLowerCase(),
        password: String(form.get("password")),
        callbackURL: callbackUrl,
      });
      if (result.error) {
        setError("Не удалось войти. Проверьте данные или обратитесь к администратору.");
        setBusy(false);
        return;
      }
      window.location.replace(callbackUrl);
    } catch {
      setError("Сервис входа сейчас недоступен. Повторите попытку позже.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#17191b] text-[#f1f0eb] lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-[#343a3d] bg-[#1c1f21] p-12 lg:flex">
        <BrandLogo variant="dark" className="w-52" priority sizes="208px" />
        <div className="relative z-10 max-w-xl"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#ff865c]">Внутренняя платформа</p><h1 className="mt-4 text-5xl font-extrabold uppercase leading-[1.02]">Работа с запчастями<br/><span className="text-[#ff6428]">без границ.</span></h1><p className="mt-5 max-w-md text-sm leading-6 text-[#aeb5b6]">Защищённый доступ для сотрудников ZAPTUT.PRO.</p></div>
        <p className="text-xs text-[#737d80]">Россия · Беларусь · Польша</p>
      </section>
      <section className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><BrandLogo variant="dark" className="w-48" sizes="192px" /></div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff865c]">Сотрудникам</p>
          <h2 className="mt-2 text-3xl font-extrabold uppercase">Вход в систему</h2>
          <p className="mt-2 text-sm text-[#aeb5b6]">Используйте рабочую учётную запись.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-xs font-semibold text-[#cbd0d1]">Рабочий email<input name="email" type="email" autoComplete="username" required maxLength={254} className="mt-2 min-h-12 w-full border border-[#414749] bg-[#202325] px-3 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]" /></label>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#cbd0d1]">Пароль</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff865c] hover:text-[#f1f0eb]"
                >
                  {showPassword ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                  <span>{showPassword ? "Скрыть" : "Показать"}</span>
                </button>
              </div>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
                className="mt-2 min-h-12 w-full border border-[#414749] bg-[#202325] px-3 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
              />
            </div>
            {error&&<p role="alert" className="border border-[#713f2e] bg-[#29201d] px-3 py-2 text-xs text-[#ffae8b]">{error}</p>}
            <button type="submit" disabled={busy} className="min-h-12 w-full bg-[#ff6428] px-4 text-xs font-extrabold uppercase tracking-wide text-[#17191b] hover:bg-[#ff8050] disabled:cursor-wait disabled:opacity-60">{busy?"Проверяем данные…":"Войти в CRM"}</button>
          </form>
          <p className="mt-6 border-t border-[#343a3d] pt-4 text-[11px] leading-5 text-[#778184]">Самостоятельная регистрация отключена. Учётные записи создаёт администратор.</p>
        </div>
      </section>
    </main>
  );
}
