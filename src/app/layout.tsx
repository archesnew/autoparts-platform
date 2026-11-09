import type { Metadata } from "next";
import "./globals.css";
import { RouteLoadingProvider } from "@/components/brand/route-loading-provider";
export const metadata: Metadata = {
  metadataBase: new URL("https://zaptut.pro"),
  title: "ZAPTUT.PRO — Запчасти. Без границ.",
  description: "Единый поиск автозапчастей по VIN, OEM и названию в России, Беларуси и Польше. Новые детали и предложения авторазборок.",
  alternates: { canonical: "/" },
  openGraph: { title: "ZAPTUT.PRO — Запчасти. Без границ.", description: "Единый поиск автозапчастей в России, Беларуси и Польше.", url: "https://zaptut.pro", siteName: "ZAPTUT.PRO", locale: "ru_RU", type: "website" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><RouteLoadingProvider>{children}</RouteLoadingProvider></body></html>;
}
