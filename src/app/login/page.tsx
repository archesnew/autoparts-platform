import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Вход сотрудников и поставщиков — ZAPTUT.PRO",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#17191b]" />}>
      <LoginForm />
    </Suspense>
  );
}
