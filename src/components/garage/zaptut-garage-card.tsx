"use client";

import { useState } from "react";
import Link from "next/link";
import { VehicleSideView } from "./vehicle-side-view";
import { IconCar } from "@/components/ui/icons";
import {
  BODY_TYPE_LABELS,
  type BodyType,
} from "@/lib/garage/vehicle-visual-registry";

export type GarageVehicle = {
  id: string;
  make: string;
  model: string;
  generation?: string | null;
  year?: number | null;
  bodyType?: string | null;
  modification?: string | null;
  vin: string;
  engine?: string | null;
  colorName?: string | null;
  colorCode?: string | null;
  colorHex?: string | null;
  isDefault: boolean;
};

export function ZaptutGarageCard({
  vehicles = [],
  onSelectDefault,
}: {
  vehicles: GarageVehicle[];
  onSelectDefault?: (vehicleId: string) => Promise<void>;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (vehicles.length === 0) {
    return (
      <section className="border border-[#383e41] bg-[#1e2124] p-6 sm:p-7 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#383e41] bg-[#17191b] text-[#ff6428]">
            <IconCar className="h-5 w-5" />
          </div>
          <p className="mt-2.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#ff6428]">
            ZAPTUT GARAGE
          </p>
          <h2 className="mt-1 text-lg font-extrabold uppercase text-[#f1f0eb]">
            В гараже пока нет автомобилей
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#888b8d]">
            Добавьте ваш автомобиль, чтобы быстро подбирать детали из каталога под конкретную модификацию.
          </p>
          <Link
            href="/account/vehicles"
            className="mt-4 inline-flex items-center gap-2 bg-[#ff6428] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050]"
          >
            + Добавить первый автомобиль
          </Link>
        </div>
      </section>
    );
  }

  const currentVehicle = vehicles[selectedIndex] || vehicles[0];
  const catalogQuery = new URLSearchParams({
    make: currentVehicle.make,
    model: currentVehicle.model,
    ...(currentVehicle.year ? { year: String(currentVehicle.year) } : {}),
  }).toString();

  const bodyTypeLabel = currentVehicle.bodyType
    ? BODY_TYPE_LABELS[currentVehicle.bodyType as BodyType] || currentVehicle.bodyType
    : null;

  return (
    <section className="relative overflow-hidden border border-[#383e41] bg-[#1e2124] p-5 sm:p-6 shadow-lg">
      {/* Top Row: Left Info + Right Compact Vehicle Layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Make, Model, Generation, Year, Body Type, Status */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff6428]">
              ZAPTUT GARAGE
            </span>
            {currentVehicle.isDefault && (
              <span className="border border-[#ff6428]/60 bg-[#ff6428]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ff986f]">
                Основной авто ✓
              </span>
            )}
            {/* Multi-vehicle switcher if multiple vehicles */}
            {vehicles.length > 1 && (
              <div className="ml-auto flex items-center gap-1 rounded border border-[#383e41] bg-[#17191b] p-0.5 sm:ml-2">
                {vehicles.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                      i === selectedIndex
                        ? "bg-[#ff6428] text-[#17191b]"
                        : "text-[#888b8d] hover:text-[#f1f0eb]"
                    }`}
                  >
                    #{i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <h2 className="mt-1.5 text-xl font-black uppercase tracking-tight text-[#f1f0eb] sm:text-2xl">
            {currentVehicle.make} {currentVehicle.model}
          </h2>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#888b8d]">
            {currentVehicle.generation && <span>{currentVehicle.generation}</span>}
            {currentVehicle.year && (
              <>
                <span className="text-[#4b5255]">·</span>
                <span>{currentVehicle.year} г.</span>
              </>
            )}
            {bodyTypeLabel && (
              <>
                <span className="text-[#4b5255]">·</span>
                <span>{bodyTypeLabel}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Compact 2D side-view vehicle (limited to 220-280px on desktop, no borders, preserves aspect ratio) */}
        <div className="w-full sm:w-[240px] md:w-[260px] max-w-[280px] shrink-0 self-center sm:self-auto">
          <VehicleSideView
            make={currentVehicle.make}
            model={currentVehicle.model}
            generation={currentVehicle.generation}
            bodyType={currentVehicle.bodyType}
            colorHex={currentVehicle.colorHex || "#2E3338"}
            className="w-full h-auto"
          />
        </div>
      </div>

      {/* Characteristics Grid (compact, below top row) */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#383e41] pt-3.5 sm:grid-cols-4">
        <div className="border border-[#343a3d] bg-[#17191b]/70 p-2.5">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#888b8d]">
            VIN-номер
          </span>
          <span className="mt-0.5 block truncate font-mono text-xs font-bold text-[#f1f0eb]">
            {currentVehicle.vin}
          </span>
        </div>

        <div className="border border-[#343a3d] bg-[#17191b]/70 p-2.5">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#888b8d]">
            Двигатель
          </span>
          <span className="mt-0.5 block truncate text-xs font-bold text-[#f1f0eb]">
            {currentVehicle.engine || "Не указан"}
          </span>
        </div>

        <div className="border border-[#343a3d] bg-[#17191b]/70 p-2.5">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#888b8d]">
            Цвет кузова
          </span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30"
              style={{ backgroundColor: currentVehicle.colorHex || "#2E3338" }}
            />
            <span className="truncate text-xs font-bold text-[#f1f0eb]">
              {currentVehicle.colorName || "Базовый тёмный"}
            </span>
          </div>
        </div>

        <div className="border border-[#343a3d] bg-[#17191b]/70 p-2.5">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#888b8d]">
            Модификация
          </span>
          <span className="mt-0.5 block truncate text-xs font-bold text-[#f1f0eb]">
            {currentVehicle.modification || "Стандарт"}
          </span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#383e41] pt-3.5">
        <Link
          href={`/catalog?${catalogQuery}`}
          className="inline-flex items-center gap-1.5 bg-[#ff6428] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050]"
        >
          🔍 Подобрать запчасти
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {!currentVehicle.isDefault && onSelectDefault && (
            <button
              type="button"
              onClick={() => onSelectDefault(currentVehicle.id)}
              className="border border-[#52595c] px-3 py-2 text-xs font-bold uppercase text-[#888b8d] transition hover:border-[#ff6428] hover:text-[#f1f0eb]"
            >
              Сделать основным ★
            </button>
          )}
          <Link
            href="/account/vehicles"
            className="border border-[#52595c] px-3.5 py-2 text-xs font-bold uppercase text-[#f1f0eb] transition hover:border-[#ff6428]"
          >
            Гараж и автомобили ({vehicles.length}) →
          </Link>
        </div>
      </div>
    </section>
  );
}
