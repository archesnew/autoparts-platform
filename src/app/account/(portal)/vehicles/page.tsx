"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VehicleSideView } from "@/components/garage/vehicle-side-view";
import {
  VehicleCascadingSelector,
  type VehicleSelectorValues,
} from "@/components/garage/vehicle-cascading-selector";
import {
  BODY_TYPE_LABELS,
  type BodyType,
} from "@/lib/garage/vehicle-visual-registry";

type Vehicle = {
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
  createdAt: string;
};

export default function CustomerVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function fetchVehicles() {
    try {
      const res = await fetch("/api/customer/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVehicles();
  }, []);

  function openCreateModal() {
    setEditingVehicle(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openEditModal(v: Vehicle) {
    setEditingVehicle(v);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSaveVehicle(values: VehicleSelectorValues) {
    setSaving(true);
    setModalError(null);

    try {
      const payload = {
        make: values.make.trim(),
        model: values.model.trim(),
        generation: values.generation?.trim() || undefined,
        year: values.year ? Number(values.year) : undefined,
        bodyType: values.bodyType || undefined,
        modification: values.modification?.trim() || undefined,
        vin: values.vin ? values.vin.trim().toUpperCase() : "",
        engine: values.engine?.trim() || undefined,
        colorName: values.colorName?.trim() || undefined,
        colorCode: values.colorCode?.trim() || undefined,
        colorHex: values.colorHex?.trim() || undefined,
        isDefault: values.isDefault,
        vehicleMakeId: values.vehicleMakeId || undefined,
        vehicleModelId: values.vehicleModelId || undefined,
        vehicleGenerationId: values.vehicleGenerationId || undefined,
        vehicleModificationId: values.vehicleModificationId || undefined,
      };

      const url = editingVehicle
        ? `/api/customer/vehicles/${editingVehicle.id}`
        : "/api/customer/vehicles";
      const method = editingVehicle ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сохранения автомобиля");
      }

      setModalOpen(false);
      await fetchVehicles();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Не удалось сохранить автомобиль");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/customer/vehicles/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        setDeleteConfirmId(null);
      }
    } catch {
      // Ignore
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`/api/customer/vehicles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        await fetchVehicles();
      }
    } catch {
      // Ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
            ZAPTUT GARAGE · Персональный гараж
          </p>
          <h1 className="mt-1 text-2xl font-black uppercase text-[#f1f0eb]">
            Мои автомобили ({vehicles.length})
          </h1>
          <p className="mt-1 text-xs text-[#888b8d]">
            Автомобили с боковыми 2D-макетами для быстрого и точного подбора совместимых запчастей
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-[#ff6428] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050]"
        >
          + Добавить автомобиль
        </button>
      </div>

      {/* Vehicles List */}
      {loading ? (
        <div className="border border-[#383e41] bg-[#1e2124] p-8 text-center text-xs text-[#888b8d]">
          Загрузка гаража...
        </div>
      ) : vehicles.length === 0 ? (
        <div className="border border-dashed border-[#414749] bg-[#1e2124]/50 p-8 text-center sm:p-12">
          <p className="text-3xl">🚗</p>
          <h2 className="mt-3 text-lg font-bold text-[#f1f0eb]">Гараж пока пуст</h2>
          <p className="mt-1.5 text-xs text-[#888b8d]">
            Добавьте ваш первый автомобиль для автоматического подбора запчастей по каталогу
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 bg-[#ff6428] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
          >
            Добавить автомобиль
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {vehicles.map((v) => {
            const catalogQuery = new URLSearchParams({
              make: v.make,
              model: v.model,
              ...(v.year ? { year: String(v.year) } : {}),
            }).toString();

            const bodyLabel = v.bodyType
              ? BODY_TYPE_LABELS[v.bodyType as BodyType] || v.bodyType
              : null;

            return (
              <div
                key={v.id}
                className="flex flex-col justify-between border border-[#383e41] bg-[#1e2124] p-5 transition hover:border-[#52595c]"
              >
                <div>
                  {/* Top: Left Info & Right Compact 2D Car Model */}
                  <div className="flex flex-col gap-3 pb-3 border-b border-[#383e41] sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#ff6428]">
                          {v.make}
                        </span>
                        {v.isDefault && (
                          <span className="border border-[#ff6428]/60 bg-[#ff6428]/20 px-2 py-0.5 text-[9px] font-black uppercase text-[#ff986f]">
                            Основной ★
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 text-lg font-black uppercase text-[#f1f0eb]">
                        {v.make} {v.model}
                      </h3>
                      <p className="text-[11px] text-[#888b8d]">
                        {[v.generation, v.year ? `${v.year} г.` : null, bodyLabel]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    {/* Compact Side-View Car Projection */}
                    <div className="w-[180px] sm:w-[200px] shrink-0 self-center sm:self-start">
                      <VehicleSideView
                        make={v.make}
                        model={v.model}
                        generation={v.generation}
                        bodyType={v.bodyType}
                        colorHex={v.colorHex || "#2E3338"}
                        className="w-full h-auto drop-shadow-md"
                      />
                    </div>
                  </div>

                  {/* Specs Grid */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="border border-[#2b3033] bg-[#17191b]/50 p-2">
                      <span className="block text-[10px] uppercase text-[#888b8d]">VIN-номер</span>
                      <span className="font-mono font-bold text-[#f1f0eb]">
                        {v.vin || "Не указан"}
                      </span>
                    </div>

                    <div className="border border-[#2b3033] bg-[#17191b]/50 p-2">
                      <span className="block text-[10px] uppercase text-[#888b8d]">Цвет кузова</span>
                      <span className="flex items-center gap-1.5 font-medium text-[#f1f0eb]">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30"
                          style={{ backgroundColor: v.colorHex || "#2E3338" }}
                        />
                        <span className="truncate">{v.colorName || "Цвет по умолчанию"}</span>
                      </span>
                    </div>

                    {v.engine && (
                      <div className="border border-[#2b3033] bg-[#17191b]/50 p-2">
                        <span className="block text-[10px] uppercase text-[#888b8d]">Двигатель</span>
                        <span className="font-medium text-[#f1f0eb] truncate block">
                          {v.engine}
                        </span>
                      </div>
                    )}

                    {v.modification && (
                      <div className="border border-[#2b3033] bg-[#17191b]/50 p-2">
                        <span className="block text-[10px] uppercase text-[#888b8d]">Модификация</span>
                        <span className="font-medium text-[#f1f0eb] truncate block">
                          {v.modification}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 space-y-3 border-t border-[#383e41] pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/catalog?${catalogQuery}`}
                      className="inline-flex items-center gap-1.5 bg-[#ff6428] px-3.5 py-2 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050]"
                    >
                      🔍 Подобрать запчасти
                    </Link>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(v)}
                        className="border border-[#414749] px-2.5 py-1.5 text-xs font-semibold text-[#f1f0eb] transition hover:border-[#ff6428]"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(v.id)}
                        className="border border-[#414749] px-2.5 py-1.5 text-xs font-semibold text-red-400 transition hover:border-red-600 hover:bg-red-950/20"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>

                  {!v.isDefault && (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleSetDefault(v.id)}
                        className="text-[11px] font-bold uppercase tracking-wider text-[#888b8d] transition hover:text-[#ff6428]"
                      >
                        ★ Сделать основным автомобилем
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete Confirmation Banner */}
                {deleteConfirmId === v.id && (
                  <div className="mt-3 border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">
                    <p className="font-bold">Удалить этот автомобиль из гаража?</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id)}
                        className="bg-red-800 px-3 py-1 font-bold text-white hover:bg-red-700"
                      >
                        Да, удалить
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="border border-[#414749] px-3 py-1 font-semibold text-[#888b8d]"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-[#383e41] bg-[#1e2124] p-5 sm:p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#383e41] pb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff6428]">
                  {editingVehicle ? "РЕДАКТИРОВАНИЕ" : "ДОБАВЛЕНИЕ В ГАРАЖ"}
                </p>
                <h2 className="text-base font-black uppercase text-[#f1f0eb] sm:text-lg">
                  {editingVehicle ? "Параметры автомобиля" : "Выбор автомобиля"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="border border-[#414749] px-2.5 py-1 text-xs text-[#888b8d] transition hover:border-[#ff6428] hover:text-[#f1f0eb]"
              >
                ✕ Закрыть
              </button>
            </div>

            {modalError && (
              <div className="mb-4 border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">
                {modalError}
              </div>
            )}

            <VehicleCascadingSelector
              initialValues={
                editingVehicle
                  ? {
                      make: editingVehicle.make,
                      model: editingVehicle.model,
                      generation: editingVehicle.generation || "",
                      year: editingVehicle.year ?? "",
                      bodyType: editingVehicle.bodyType || "SUV",
                      engine: editingVehicle.engine || "",
                      modification: editingVehicle.modification || "",
                      vin: editingVehicle.vin || "",
                      colorName: editingVehicle.colorName || "",
                      colorCode: editingVehicle.colorCode || "",
                      colorHex: editingVehicle.colorHex || "",
                      isDefault: editingVehicle.isDefault,
                    }
                  : undefined
              }
              onSubmit={handleSaveVehicle}
              onCancel={() => setModalOpen(false)}
              isSubmitting={saving}
              submitButtonText={editingVehicle ? "Сохранить изменения" : "Добавить в гараж"}
              title={editingVehicle ? "Редактирование автомобиля" : "Добавление автомобиля"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
