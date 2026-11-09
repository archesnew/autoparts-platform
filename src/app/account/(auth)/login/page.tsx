"use client";

import { useSearchParams } from "next/navigation";
import { PhoneAuthForm } from "@/components/customer/phone-auth-form";

export default function CustomerLoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || searchParams.get("redirect") || "/account";

  return (
    <PhoneAuthForm
      title="Вход по номеру телефона"
      subtitle="Введите номер для входа в кабинет покупателя ZAPTUT.PRO. Пароль не требуется."
      redirectTo={callbackUrl}
    />
  );
}
