import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { RouteLoadingProvider } from "@/components/brand/route-loading-provider";
import { CookieConsentBanner } from "@/components/ui/cookie-consent-banner";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const isStaging =
  process.env.NEXT_PUBLIC_APP_ENV === "staging" ||
  process.env.BETTER_AUTH_URL?.includes("staging") ||
  process.env.BETTER_AUTH_URL?.includes("netlify.app");

export const metadata: Metadata = {
  metadataBase: new URL(isStaging ? "https://zaptut-staging.netlify.app" : "https://zaptut.pro"),
  title: "ZAPTUT.PRO — Запчасти. Без границ.",
  description: "Единый поиск автозапчастей по VIN, OEM и названию в России, Беларуси и Польше. Новые детали и предложения авторазборок.",
  alternates: { canonical: isStaging ? undefined : "/" },
  robots: isStaging ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { title: "ZAPTUT.PRO — Запчасти. Без границ.", description: "Единый поиск автозапчастей в России, Беларуси и Польше.", url: "https://zaptut.pro", siteName: "ZAPTUT.PRO", locale: "ru_RU", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={onest.className}>
      <body>
        <RouteLoadingProvider>{children}</RouteLoadingProvider>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
