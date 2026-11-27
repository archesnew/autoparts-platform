"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_COUNTRIES,
  maskNationalDigits,
  normalizeToE164,
  type SupportedCountryCode,
} from "@/lib/phone-utils";

type AuthStep = "PHONE_INPUT" | "OTP_INPUT";

export function PhoneAuthForm({
  title = "Вход или регистрация",
  subtitle = "Введите номер телефона для получения SMS с кодом подтверждения.",
  redirectTo = "/account",
}: {
  title?: string;
  subtitle?: string;
  redirectTo?: string;
}) {
  const router = useRouter();

  // Screen state
  const [step, setStep] = useState<AuthStep>("PHONE_INPUT");
  const [countryCode, setCountryCode] = useState<SupportedCountryCode>("RU");
  const [nationalDigits, setNationalDigits] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");

  // OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer & UI feedback
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active country config
  const activeCountry = SUPPORTED_COUNTRIES.find((c) => c.code === countryCode) || SUPPORTED_COUNTRIES[0];

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Handle national digits input with mask
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, "");
    // Truncate to maximum digits for national number (e.g. 10 for RU/BY, 9 for PL)
    const maxDigits = countryCode === "PL" ? 9 : 10;
    setNationalDigits(rawDigits.slice(0, maxDigits));
    setError(null);
  };

  // Switch country
  const handleCountryChange = (code: SupportedCountryCode) => {
    setCountryCode(code);
    setNationalDigits("");
    setError(null);
  };

  // Submit phone -> send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const fullRaw = `${activeCountry.dialCode}${nationalDigits}`;
    const norm = normalizeToE164(fullRaw);

    if (!norm) {
      setError("Пожалуйста, введите полный номер телефона.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/customer/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: norm }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "SMS_NOT_CONFIGURED") {
          setError("SMS_NOT_CONFIGURED: Провайдер SMS-сообщений не настроен на сервере.");
        } else {
          setError(data.error || "Ошибка отправки кода.");
        }
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        return;
      }

      setNormalizedPhone(data.normalizedPhone || norm);
      setCooldown(data.cooldownSeconds || 60);
      setStep("OTP_INPUT");
      setOtpDigits(["", "", "", "", "", ""]);

      // Focus first digit input after transition
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError("Сбой сети. Проверьте соединение с сервером.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit change
  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    const updated = [...otpDigits];

    if (!clean) {
      updated[index] = "";
      setOtpDigits(updated);
      return;
    }

    // Single digit input
    updated[index] = clean[clean.length - 1];
    setOtpDigits(updated);

    // Auto-advance to next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // If last digit filled, auto submit
      const fullCode = updated.join("");
      if (fullCode.length === 6) {
        verifyOtpCode(fullCode);
      }
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle full paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || "";
    }
    setOtpDigits(updated);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (pasted.length === 6) {
      verifyOtpCode(pasted);
    }
  };

  // Verify OTP code
  const verifyOtpCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join("");
    if (code.length !== 6) {
      setError("Введите все 6 цифр кода.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/customer/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          code,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Неверный код подтверждения.");
        return;
      }

      // Success! Redirect to account portal
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Ошибка проверки кода. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold uppercase tracking-wide text-[#f1f0eb]">
          {title}
        </h1>
        <p className="mt-2 text-xs text-[#888b8d]">
          {step === "PHONE_INPUT" ? subtitle : `Код подтверждения отправлен на номер ${normalizedPhone}`}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 border border-red-900/60 bg-red-950/30 p-3.5 text-xs text-red-300"
        >
          <p className="font-bold">Ошибка:</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {step === "PHONE_INPUT" ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          {/* Country selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Страна обслуживания
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {SUPPORTED_COUNTRIES.map((c) => {
                const active = c.code === countryCode;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountryChange(c.code)}
                    className={`flex items-center justify-center gap-1.5 border px-2.5 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-[#ff6428] bg-[#ff6428]/15 text-[#ff865c]"
                        : "border-[#383e41] bg-[#1a1d1f] text-[#888b8d] hover:border-[#52595c] hover:text-[#f1f0eb]"
                    }`}
                  >
                    <span>{c.code === "RU" ? "🇷🇺" : c.code === "BY" ? "🇧🇾" : "🇵🇱"}</span>
                    <span>{c.dialCode}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phone input with calling code and mask */}
          <div>
            <label
              htmlFor="phone-input"
              className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]"
            >
              Номер телефона
            </label>
            <div className="mt-1.5 flex items-stretch border border-[#383e41] bg-[#17191b] transition focus-within:border-[#ff6428]">
              <span className="flex items-center border-r border-[#383e41] bg-[#202325] px-3.5 text-xs font-bold text-[#888b8d]">
                {activeCountry.dialCode}
              </span>
              <input
                id="phone-input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={activeCountry.placeholder.replace(activeCountry.dialCode + " ", "")}
                value={maskNationalDigits(nationalDigits, countryCode)}
                onChange={handlePhoneChange}
                disabled={loading}
                className="w-full bg-transparent px-3.5 py-3 text-sm font-semibold tracking-wider text-[#f1f0eb] placeholder:text-[#52595c] focus:outline-none"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[#5e6568]">
              Пример: {activeCountry.placeholder}
            </p>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={loading || nationalDigits.length < 7}
            className="w-full bg-[#ff6428] py-3.5 text-center text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7b47] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Отправляем код..." : "Получить SMS-код →"}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          {/* OTP Digit boxes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              6-значный SMS-код
            </label>
            <div className="mt-2.5 flex items-center justify-between gap-2 sm:gap-3">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={loading}
                  aria-label={`Цифра ${index + 1}`}
                  className="h-12 w-11 border border-[#383e41] bg-[#17191b] text-center text-xl font-black text-[#f1f0eb] transition focus:border-[#ff6428] focus:bg-[#202325] focus:outline-none sm:h-14 sm:w-13"
                />
              ))}
            </div>
          </div>

          {/* Verify button */}
          <button
            type="button"
            onClick={() => verifyOtpCode()}
            disabled={loading || otpDigits.join("").length !== 6}
            className="w-full bg-[#ff6428] py-3.5 text-center text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7b47] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Проверяем..." : "Войти в аккаунт →"}
          </button>

          {/* Secondary actions: Resend timer & Change phone */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#383e41] pt-4 text-xs sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setStep("PHONE_INPUT");
                setError(null);
              }}
              className="font-semibold text-[#888b8d] transition hover:text-[#f1f0eb]"
            >
              ← Изменить номер
            </button>

            {cooldown > 0 ? (
              <span className="tabular-nums text-[#888b8d]">
                Повторная отправка:{" "}
                <b className="text-[#ff986f]">
                  00:{cooldown < 10 ? `0${cooldown}` : cooldown}
                </b>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={loading}
                className="font-bold text-[#ff6428] transition hover:underline"
              >
                Отправить код повторно ↻
              </button>
            )}
          </div>
        </div>
      )}

      {/* 152-ФЗ Trust & Legal Consent note */}
      <div className="mt-6 border-t border-[#383e41]/60 pt-4 text-center">
        <p className="text-[11px] leading-relaxed text-[#888b8d]">
          Нажимая «Получить SMS-код», вы даёте{" "}
          <Link href="/consent" target="_blank" className="text-[#f1f0eb] underline decoration-[#ff6428] underline-offset-2 transition hover:text-[#ff865c]">
            согласие на обработку персональных данных
          </Link>{" "}
          и принимаете условия{" "}
          <Link href="/privacy-policy" target="_blank" className="text-[#f1f0eb] underline decoration-[#ff6428] underline-offset-2 transition hover:text-[#ff865c]">
            политики конфиденциальности
          </Link>{" "}
          и{" "}
          <Link href="/terms" target="_blank" className="text-[#f1f0eb] underline decoration-[#ff6428] underline-offset-2 transition hover:text-[#ff865c]">
            пользовательского соглашения
          </Link>
          . Пароль не требуется.
        </p>
      </div>
    </div>
  );
}
