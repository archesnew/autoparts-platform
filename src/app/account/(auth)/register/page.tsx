"use client";

import { useSearchParams } from "next/navigation";
import { PhoneAuthForm } from "@/components/customer/phone-auth-form";

export default function CustomerRegisterPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/account";

  return (
    <PhoneAuthForm
      title="Регистрация покупателя"
      subtitle="Быстрая регистрация по SMS-коду без email и пароля."
      redirectTo={callbackUrl}
    />
  );
}
