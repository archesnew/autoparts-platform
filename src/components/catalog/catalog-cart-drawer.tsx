"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CartItem } from "@/lib/catalog-cart";
import { clearCartStorage } from "@/lib/catalog-cart";

type GarageVehicle = {
  id: string;
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  isDefault?: boolean;
};

type CustomerProfile = {
  id: string;
  name: string;
  phone?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
};

export function CatalogCartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: Props) {
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [manualMake, setManualMake] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualVin, setManualVin] = useState("");
  const [comment, setComment] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdRequest, setCreatedRequest] = useState<{ id: string; number: string } | null>(null);

  // Check customer session and load garage vehicles on open
  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/customer/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.customer) {
          setCustomer(data.customer);
          return fetch("/api/customer/vehicles");
        }
        return null;
      })
      .then((res) => (res?.ok ? res.json() : null))
      .then((vData) => {
        if (vData?.vehicles && vData.vehicles.length > 0) {
          setVehicles(vData.vehicles);
          const defaultCar = vData.vehicles.find((v: GarageVehicle) => v.isDefault) || vData.vehicles[0];
          setSelectedVehicleId(defaultCar.id);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmountKnown = items.reduce((sum, item) => {
    return item.price ? sum + item.price * item.quantity : sum;
  }, 0);
  const hasUnknownPrice = items.some((item) => item.price === null);

  async function handleCheckout() {
    if (!customer) {
      // Unauthenticated visitor -> redirect to login with callback
      router.push("/account/login?redirect=/catalog");
      return;
    }

    if (items.length === 0) return;

    setSubmitting(true);
    setErrorMsg("");

    try {
      const selectedCar = vehicles.find((v) => v.id === selectedVehicleId);

      const payload = {
        items: items.map((item) => ({
          description: `${item.title} (${item.brand})`,
          requestedPartNumber: item.oem || null,
          quantity: item.quantity,
          conditionPreference: item.condition,
        })),
        vehicleId: selectedVehicleId || null,
        vehicleMake: selectedCar ? selectedCar.make : manualMake.trim() || null,
        vehicleModel: selectedCar ? selectedCar.model : manualModel.trim() || null,
        vehicleYear: selectedCar ? (selectedCar.year ? String(selectedCar.year) : null) : manualYear.trim() || null,
        vehicleVin: selectedCar ? selectedCar.vin || null : manualVin.trim() || null,
        customerComment: comment.trim() || null,
      };

      const res = await fetch("/api/customer/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить заявку");
      }

      clearCartStorage();
      onClearCart();
      setCreatedRequest({
        id: data.request.id,
        number: data.request.number,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Ошибка отправки заявки");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative flex h-full w-full max-w-lg flex-col border-l border-[#383e41] bg-[#1e2124] text-[#f1f0eb] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#383e41] p-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
              Корзина деталей
            </p>
            <h2 className="text-lg font-black uppercase text-[#f1f0eb]">
              Заявка на запчасти ({totalQuantity})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-[#888b8d] transition hover:text-[#f1f0eb]"
            aria-label="Закрыть корзину"
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {createdRequest ? (
            <div className="space-y-4 py-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#ff6428]/20 text-2xl text-[#ff6428] border border-[#ff6428]/50">
                ✓
              </div>
              <h3 className="text-xl font-black uppercase text-[#f1f0eb]">
                Заявка {createdRequest.number} создана!
              </h3>
              <p className="text-xs text-[#888b8d]">
                Специалисты ZAPTUT.PRO проверят наличие на складах в РФ, Беларуси и Польше и сформируют коммерческое предложение.
              </p>
              <div className="pt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href={`/account/requests/${createdRequest.id}`}
                  className="inline-flex min-h-11 items-center justify-center bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
                >
                  Перейти к заявке →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedRequest(null);
                    onClose();
                  }}
                  className="min-h-11 border border-[#414749] px-4 text-xs font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428]"
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="border border-dashed border-[#414749] p-8 text-center">
              <p className="text-sm font-bold text-[#f1f0eb]">Заявка пуста</p>
              <p className="mt-1 text-xs text-[#888b8d]">
                Добавьте детали из каталога, нажав кнопку «В заявку +».
              </p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="border border-red-900/60 bg-red-950/20 p-3 text-xs font-bold text-red-300">
                  {errorMsg}
                </div>
              )}

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                    Выбранные детали:
                  </span>
                  <button
                    onClick={onClearCart}
                    className="text-[10px] font-bold uppercase tracking-wider text-[#ff6428] hover:text-[#f1f0eb]"
                  >
                    Очистить все
                  </button>
                </div>

                <div className="divide-y divide-[#383e41] border border-[#383e41] bg-[#17191b]">
                  {items.map((item) => (
                    <div key={item.id} className="p-3">
                      <div className="flex gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-[#383e41] bg-[#121416]">
                          <Image
                            src={item.photo || "/brake-rotor.webp"}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-[#f1f0eb] line-clamp-1">
                            {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#888b8d]">
                            <span>OEM: <b className="font-mono text-[#ff865c]">{item.oem}</b></span>
                            <span>· {item.brand}</span>
                            <span>· {item.condition}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center border border-[#383e41] bg-[#1e2124]">
                              <button
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className="px-2.5 py-0.5 text-xs font-bold text-[#888b8d] hover:text-[#f1f0eb]"
                              >
                                -
                              </button>
                              <span className="px-2 text-xs font-mono font-bold text-[#f1f0eb]">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className="px-2.5 py-0.5 text-xs font-bold text-[#888b8d] hover:text-[#f1f0eb]"
                              >
                                +
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-black text-[#ff6428]">
                                {item.price ? `${(item.price * item.quantity).toLocaleString("ru-RU")} ₽` : "По запросу"}
                              </span>
                              <button
                                onClick={() => onRemoveItem(item.id)}
                                className="text-sm text-[#888b8d] hover:text-red-400"
                                title="Удалить"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicle Context Section */}
              <div className="border border-[#383e41] bg-[#17191b] p-4 space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
                  Привязка к автомобилю
                </p>

                {vehicles.length > 0 ? (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                      Автомобиль из вашего гаража
                    </label>
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className="mt-1 w-full border border-[#414749] bg-[#1e2124] px-3 py-2 text-xs font-semibold text-[#f1f0eb] focus:border-[#ff6428] focus:outline-none"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.make} {v.model} {v.year ? `(${v.year})` : ""} {v.vin ? `· VIN: ${v.vin}` : ""}
                        </option>
                      ))}
                      <option value="">Другой автомобиль (указать вручную)</option>
                    </select>
                  </div>
                ) : null}

                {(!vehicles.length || selectedVehicleId === "") && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <input
                        placeholder="Марка (напр. Kia)"
                        value={manualMake}
                        onChange={(e) => setManualMake(e.target.value)}
                        className="w-full border border-[#414749] bg-[#1e2124] px-3 py-1.5 text-xs text-[#f1f0eb] focus:border-[#ff6428] focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        placeholder="Модель (Sportage)"
                        value={manualModel}
                        onChange={(e) => setManualModel(e.target.value)}
                        className="w-full border border-[#414749] bg-[#1e2124] px-3 py-1.5 text-xs text-[#f1f0eb] focus:border-[#ff6428] focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        placeholder="Год (2022)"
                        value={manualYear}
                        onChange={(e) => setManualYear(e.target.value)}
                        className="w-full border border-[#414749] bg-[#1e2124] px-3 py-1.5 text-xs text-[#f1f0eb] focus:border-[#ff6428] focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        placeholder="VIN номер"
                        value={manualVin}
                        onChange={(e) => setManualVin(e.target.value)}
                        className="w-full border border-[#414749] bg-[#1e2124] px-3 py-1.5 text-xs text-[#f1f0eb] focus:border-[#ff6428] focus:outline-none uppercase font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Comment */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                  Комментарий к заявке
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Укажите пожелания по срокам, производителю или проверке совместимости..."
                  className="w-full border border-[#414749] bg-[#17191b] p-3 text-xs text-[#f1f0eb] focus:border-[#ff6428] focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              {/* Summary & Price */}
              <div className="border-t border-[#383e41] pt-3 text-xs space-y-1">
                <div className="flex justify-between text-[#888b8d]">
                  <span>Всего деталей:</span>
                  <span className="font-mono text-[#f1f0eb]">{totalQuantity} шт.</span>
                </div>
                {totalAmountKnown > 0 && (
                  <div className="flex justify-between text-sm font-black">
                    <span className="text-[#f1f0eb]">Ориентировочная сумма:</span>
                    <span className="font-mono text-[#ff6428]">
                      {hasUnknownPrice ? "от " : ""}
                      {totalAmountKnown.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-[#888b8d] italic">
                  * Окончательные цены и сроки доставки согласуются менеджером в официальном предложении.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Checkout Action */}
        {!createdRequest && items.length > 0 && (
          <div className="border-t border-[#383e41] bg-[#17191b] p-5">
            {customer ? (
              <button
                id="cart-submit-btn"
                type="button"
                onClick={handleCheckout}
                disabled={submitting}
                className="w-full min-h-12 bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45] disabled:opacity-50"
              >
                {submitting ? "Создание заявки..." : `Оформить заявку (${totalQuantity} поз.) →`}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  id="cart-login-btn"
                  type="button"
                  onClick={handleCheckout}
                  className="w-full min-h-12 bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
                >
                  Войти по телефону для оформления →
                </button>
                <p className="text-center text-[10px] text-[#888b8d]">
                  Выбранные детали сохранятся в корзине при входе
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
