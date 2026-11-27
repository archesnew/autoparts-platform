"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCustomerSession } from "@/components/customer/customer-session-provider";
import { formatPhoneDisplay } from "@/lib/phone-utils";

export default function CustomerProfilePage() {
  const router = useRouter();
  const session = useCustomerSession();

  // Profile data
  const [name, setName] = useState(session.name);
  const [phone, setPhone] = useState(session.phone || "");
  const [email, setEmail] = useState(session.email || "");
  const [registrationDate, setRegistrationDate] = useState<string>("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Phone Change Modal / Drawer State
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneChangeLoading, setPhoneChangeLoading] = useState(false);
  const [phoneChangeError, setPhoneChangeError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // 152-ФЗ Erasure State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load detailed profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/customer/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.customer) {
            setName(data.customer.name || "");
            setPhone(data.customer.phone || "");
            setEmail(data.customer.email || "");
            if (data.customer.userCreatedAt || data.customer.createdAt) {
              const d = new Date(data.customer.userCreatedAt || data.customer.createdAt);
              setRegistrationDate(
                new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(d)
              );
            }
          }
        }
      } catch {}
    }
    loadProfile();
  }, []);

  // Cooldown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Update profile handler (name + optional email)
  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMessage(null);
    setProfileSaving(true);

    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сохранения профиля");
      }

      setProfileMessage({ type: "success", text: "Данные профиля успешно сохранены" });
      router.refresh();
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Не удалось обновить профиль",
      });
    } finally {
      setProfileSaving(false);
    }
  }

  // Send OTP for phone change
  async function handleSendChangeOtp() {
    setPhoneChangeError(null);
    if (!newPhone.trim()) {
      setPhoneChangeError("Введите новый номер телефона");
      return;
    }

    setPhoneChangeLoading(true);
    try {
      const res = await fetch("/api/customer/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: newPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить код на новый номер");
      }
      setOtpSent(true);
      setCooldown(data.cooldownSeconds || 60);
    } catch (err: any) {
      setPhoneChangeError(err.message || "Ошибка отправки SMS");
    } finally {
      setPhoneChangeLoading(false);
    }
  }

  // Verify and apply phone change
  async function handleApplyPhoneChange() {
    setPhoneChangeError(null);
    if (otpCode.length !== 6) {
      setPhoneChangeError("Введите 6-значный код из SMS");
      return;
    }

    setPhoneChangeLoading(true);
    try {
      const res = await fetch("/api/customer/auth/phone/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPhone: newPhone.trim(),
          code: otpCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось изменить номер");
      }

      setPhone(data.newPhone);
      setPhoneModalOpen(false);
      setNewPhone("");
      setOtpCode("");
      setOtpSent(false);
      setProfileMessage({ type: "success", text: "Номер телефона успешно изменён и подтверждён" });
      router.refresh();
    } catch (err: any) {
      setPhoneChangeError(err.message || "Ошибка изменения номера");
    } finally {
      setPhoneChangeLoading(false);
    }
  }

  // Logout handler
  async function handleSignOut() {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch {}
    window.location.href = "/account/login";
  }

  // 152-ФЗ Data Erasure Handler
  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/customer/profile", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось отправить запрос");
      alert(data.message || "Согласие отозвано. Персональные данные удалены.");
      window.location.href = "/";
    } catch (err: any) {
      alert(err.message || "Ошибка отзыва согласия");
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
          ZAPTUT.PRO · Личные данные
        </p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-[#f1f0eb]">
          Профиль покупателя
        </h1>
        <p className="mt-1 text-xs text-[#888b8d]">
          Управление контактными данными и безопасностью учётной записи.
        </p>
      </div>

      {profileMessage && (
        <div
          role="alert"
          className={`border p-3 text-xs ${
            profileMessage.type === "success"
              ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-300"
              : "border-red-900/60 bg-red-950/25 text-red-300"
          }`}
        >
          {profileMessage.text}
        </div>
      )}

      {/* Main Profile Info Card */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5 sm:p-7">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#d8dcdd]">
          Контакты и идентификация
        </h2>
        <p className="mt-1 text-[11px] text-[#888b8d]">
          Основным идентификатором является подтверждённый номер телефона. Email необязателен.
        </p>

        <form onSubmit={handleUpdateProfile} className="mt-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Имя покупателя
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Алексей"
              className="mt-1.5 w-full border border-[#414749] bg-[#17191b] px-3.5 py-2.5 text-sm font-semibold text-[#f1f0eb] outline-none transition focus:border-[#ff6428]"
            />
          </div>

          {/* Verified Phone */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
              Номер телефона (основной доступ)
            </label>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3 border border-[#414749] bg-[#17191b] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wider text-[#f1f0eb]">
                  {phone ? formatPhoneDisplay(phone) : "Не указан"}
                </span>
                <span className="inline-flex items-center border border-emerald-800/80 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400">
                  Подтверждён ✓
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPhoneModalOpen(true);
                  setPhoneChangeError(null);
                  setOtpSent(false);
                  setOtpCode("");
                }}
                className="text-xs font-extrabold uppercase text-[#ff6428] transition hover:underline"
              >
                Изменить номер →
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[#5e6568]">
              Смена номера происходит через подтверждение по SMS.
            </p>
          </div>

          {/* Optional Email */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                Электронная почта
              </label>
              <span className="text-[10px] font-medium text-[#5e6568]">Необязательно</span>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.ru"
              className="mt-1.5 w-full border border-[#414749] bg-[#17191b] px-3.5 py-2.5 text-sm text-[#f1f0eb] outline-none transition focus:border-[#ff6428]"
            />
            <p className="mt-1 text-[10px] text-[#5e6568]">
              Используется только для дублирования счетов и чеков по вашему желанию.
            </p>
          </div>

          {/* Registration Date */}
          {registrationDate && (
            <div className="border-t border-[#383e41] pt-3 text-[11px] text-[#888b8d]">
              Дата регистрации: <b className="text-[#f1f0eb]">{registrationDate}</b>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={profileSaving}
              className="bg-[#ff6428] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050] disabled:opacity-50"
            >
              {profileSaving ? "Сохраняем..." : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </section>

      {/* Session and Account Security Card */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5 sm:p-7">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#d8dcdd]">
          Безопасность и сессия
        </h2>
        <p className="mt-1 text-[11px] text-[#888b8d]">
          Вход в аккаунт защищён одноразовыми SMS-кодами. Пароль не используется, что исключает кражу учетных данных.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#383e41] pt-5">
          <div>
            <p className="text-xs font-bold text-[#f1f0eb]">Активная сессия</p>
            <p className="text-[11px] text-[#888b8d]">Текущее подключение к личному кабинету покупателя ZAPTUT.PRO</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="border border-[#52595c] bg-[#17191b] px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400 transition hover:border-red-600 hover:bg-red-950/20"
          >
            Выйти из аккаунта ↪
          </button>
        </div>
      </section>

      {/* 152-ФЗ Personal Data & Erasure section */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5 sm:p-7">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#ff6428]">
          Конфиденциальность и персональные данные (152-ФЗ)
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#888b8d]">
          В соответствии со статьями 14 и 21 Федерального закона № 152-ФЗ «О персональных данных», вы имеете право
          на получение сведений об обработке ваших данных, их уточнение, блокирование или полный отзыв согласия.
        </p>

        <div className="mt-5 border border-[#383e41]/80 bg-[#17191b] p-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[#f1f0eb]">Отзыв согласия и удаление аккаунта</p>
              <p className="mt-0.5 text-[11px] text-[#888b8d]">
                Деактивация доступа, прекращение обработки персональных данных и удаление информации в течение 30 календарных дней.
              </p>
            </div>
            {deleteConfirmOpen ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="border border-[#52595c] px-3 py-1.5 text-xs font-semibold text-[#888b8d]"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="bg-red-600 px-3.5 py-1.5 text-xs font-bold uppercase text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? "Удаление..." : "Подтвердить отзыв"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="border border-red-900/60 bg-red-950/20 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-red-400 transition hover:border-red-600 hover:bg-red-950/40"
              >
                Отозвать согласие ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Phone Change Modal */}
      {phoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-[#383e41] bg-[#1e2124] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#383e41] pb-3">
              <h3 className="text-sm font-black uppercase text-[#f1f0eb]">
                Смена номера телефона
              </h3>
              <button
                type="button"
                onClick={() => setPhoneModalOpen(false)}
                className="text-xs text-[#888b8d] hover:text-[#f1f0eb]"
              >
                ✕
              </button>
            </div>

            {phoneChangeError && (
              <div className="mt-3 border border-red-900/60 bg-red-950/30 p-2.5 text-xs text-red-300">
                {phoneChangeError}
              </div>
            )}

            {!otpSent ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
                    Новый номер телефона (+7, +375, +48)
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+7 999 000-00-00"
                    className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                  />
                  <p className="mt-1 text-[10px] text-[#5e6568]">
                    На этот номер будет отправлен 6-значный SMS-код подтверждения.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPhoneModalOpen(false)}
                    className="border border-[#52595c] px-4 py-2 text-xs font-semibold text-[#888b8d]"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSendChangeOtp}
                    disabled={phoneChangeLoading || !newPhone}
                    className="bg-[#ff6428] px-4 py-2 text-xs font-bold uppercase text-[#17191b] hover:bg-[#ff8050] disabled:opacity-50"
                  >
                    {phoneChangeLoading ? "Отправляем..." : "Получить код →"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-[#aeb5b6]">
                  Код отправлен на <b className="text-[#f1f0eb]">{newPhone}</b>.
                </p>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#888b8d]">
                    6-значный код из SMS
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-center text-lg font-black tracking-widest text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  {cooldown > 0 ? (
                    <span className="text-[10px] text-[#888b8d]">
                      Повтор через {cooldown} сек.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendChangeOtp}
                      className="text-[10px] font-bold text-[#ff6428] hover:underline"
                    >
                      Отправить снова
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="border border-[#52595c] px-3 py-1.5 text-xs font-semibold text-[#888b8d]"
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyPhoneChange}
                      disabled={phoneChangeLoading || otpCode.length !== 6}
                      className="bg-[#ff6428] px-4 py-1.5 text-xs font-bold uppercase text-[#17191b] hover:bg-[#ff8050] disabled:opacity-50"
                    >
                      {phoneChangeLoading ? "Проверка..." : "Подтвердить"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
