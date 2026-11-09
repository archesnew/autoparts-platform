import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Каталог автозапчастей — ZAPTUT.PRO",
  description: "Каталог демонстрационных автозапчастей ZAPTUT.PRO. Поиск, категории и фильтры по автомобилю, производителю, состоянию и стране.",
};

export default function CatalogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
