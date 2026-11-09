"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCustomerSession } from "@/components/customer/customer-session-provider";
import { ZaptutGarageCard, type GarageVehicle } from "@/components/garage/zaptut-garage-card";
import { formatPhoneDisplay } from "@/lib/phone-utils";

type Address = {
  id: string;
  recipientName: string;
  city: string;
  street: string;
  house: string;
  apartment?: string | null;
  isDefault: boolean;
};

type CustomerRequest = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | null;
  itemsCount?: number;
  itemsSummary?: string;
  hasOffer?: boolean;
  offerTotalRub?: string | null;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalRub: string;
  createdAt: string;
  itemsCount: number;
  deliveryDays?: string | null;
};

const REQUEST_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Новая заявка", color: "border-[#ff6428] text-[#ff865c] bg-[#ff6428]/10" },
  ASSIGNED: { label: "В обработке", color: "border-[#888b8d] text-[#f1f0eb] bg-[#888b8d]/10" },
  SEARCHING: { label: "Подбор деталей", color: "border-sky-700 text-sky-400 bg-sky-950/20" },
  WAITING_SUPPLIERS: { label: "Запросы складам", color: "border-amber-700 text-amber-400 bg-amber-950/20" },
  OFFERS_READY: { label: "Предложение готово", color: "border-[#ff6428] text-[#ff6428] bg-[#ff6428]/25" },
  SENT_TO_CUSTOMER: { label: "Ожидает согласования", color: "border-emerald-700 text-emerald-400 bg-emerald-950/20" },
  CONFIRMED: { label: "Подтверждена", color: "border-emerald-600 text-emerald-300 bg-emerald-900/30" },
  COMPLETED: { label: "Завершена", color: "border-[#4b5255] text-[#888b8d] bg-[#202325]" },
  CANCELLED: { label: "Отменена", color: "border-red-900 text-red-400 bg-red-950/20" },
};

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "Ожидает оплаты", color: "border-amber-700 text-amber-400 bg-amber-950/20" },
  PAID: { label: "Оплачен", color: "border-emerald-700 text-emerald-400 bg-emerald-950/20" },
  IN_DELIVERY: { label: "В доставке", color: "border-sky-700 text-sky-400 bg-sky-950/20" },
  DELIVERED: { label: "Доставлен", color: "border-emerald-600 text-emerald-300 bg-emerald-900/30" },
  CANCELLED: { label: "Отменён", color: "border-red-900 text-red-400 bg-red-950/20" },
};

export default function CustomerDashboardPage() {
  const customer = useCustomerSession();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const [vRes, aRes, rRes, oRes] = await Promise.all([
        fetch("/api/customer/vehicles"),
        fetch("/api/customer/addresses"),
        fetch("/api/customer/requests"),
        fetch("/api/customer/orders"),
      ]);

      if (vRes.ok) {
        const vData = await vRes.json();
        setVehicles(vData.vehicles || []);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setAddresses(aData.addresses || []);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        setRequests(rData.requests || []);
      }
      if (oRes.ok) {
        const oData = await oRes.json();
        setOrders(oData.orders || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSetDefaultVehicle(vehicleId: string) {
    try {
      const res = await fetch(`/api/customer/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {}
  }

  return (
    <div className="space-y-7">
      {/* Top Welcome Bar */}
      <div className="border border-[#383e41] bg-[#1e2124] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff6428]">
              Личный кабинет · ZAPTUT.PRO
            </p>
            <h1 className="mt-1.5 text-2xl font-black uppercase tracking-tight text-[#f1f0eb] sm:text-3xl">
              Здравствуйте, {customer.name}
            </h1>
            <p className="mt-1 text-xs text-[#aeb5b6]">
              Единое рабочее место покупателя: персональный гараж, статус заказов и адреса доставки.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/catalog"
              className="bg-[#ff6428] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050]"
            >
              Каталог запчастей →
            </Link>
            <Link
              href="/account/vehicles"
              className="border border-[#414749] bg-[#17191b] px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] transition hover:border-[#ff6428]"
            >
              + Автомобиль
            </Link>
          </div>
        </div>

        {/* User Identity Badges */}
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[#343a3d] pt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#888b8d]">Телефон:</span>
            <span className="font-bold text-[#f1f0eb]">
              {customer.phone ? formatPhoneDisplay(customer.phone) : "Не указан"}
            </span>
            <span className="rounded bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-400">
              Подтверждён
            </span>
          </div>

          {customer.email && (
            <div>
              <span className="text-[#888b8d]">Email:</span>{" "}
              <span className="font-medium text-[#f1f0eb]">{customer.email}</span>
            </div>
          )}

          <Link
            href="/account/profile"
            className="ml-auto text-xs font-bold uppercase text-[#ff865c] hover:underline"
          >
            Настройки профиля →
          </Link>
        </div>
      </div>

      {/* 1. ZAPTUT GARAGE FEATURED BLOCK */}
      <ZaptutGarageCard
        vehicles={vehicles}
        onSelectDefault={handleSetDefaultVehicle}
      />

      {/* 2. RECENT REQUESTS & OFFERS */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#383e41] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff6428]">
                Заявки и предложения
              </span>
              <span className="text-xs font-mono text-[#888b8d]">
                ({requests.length})
              </span>
            </div>
            <h2 className="mt-1 text-lg font-black uppercase text-[#f1f0eb]">
              Актуальные запросы на подбор
            </h2>
          </div>

          <Link
            href="/catalog"
            className="text-xs font-bold uppercase text-[#ff865c] hover:underline"
          >
            Новый запрос в каталог →
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#888b8d]">Загрузка заявок...</div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#888b8d]">
            У вас пока нет активных заявок. Выберите деталь в каталоге или отправьте запрос менеджеру.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-[#343a3d]">
            {requests.slice(0, 5).map((req) => {
              const statusCfg = REQUEST_STATUS_LABELS[req.status] || {
                label: req.status,
                color: "border-[#4b5255] text-[#f1f0eb] bg-[#202325]",
              };

              return (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#ff865c]">
                        {req.number}
                      </span>
                      <span
                        className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-[#f1f0eb]">
                      {[req.vehicleMake, req.vehicleModel, req.vehicleYear].filter(Boolean).join(" ")}
                    </p>
                    {req.itemsSummary && (
                      <p className="mt-0.5 text-[11px] text-[#888b8d] line-clamp-1">
                        {req.itemsSummary}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    {req.offerTotalRub ? (
                      <p className="text-sm font-black text-[#f1f0eb]">
                        {req.offerTotalRub}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#888b8d]">Расчёт стоимости</p>
                    )}
                    <span className="text-[10px] text-[#5e6568]">
                      {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
                        new Date(req.createdAt)
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. RECENT ORDERS */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#383e41] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff6428]">
                Заказы
              </span>
              <span className="text-xs font-mono text-[#888b8d]">
                ({orders.length})
              </span>
            </div>
            <h2 className="mt-1 text-lg font-black uppercase text-[#f1f0eb]">
              История оформления и доставка
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#888b8d]">Загрузка заказов...</div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#888b8d]">
            Заказов пока нет. Согласованные предложения из заявок переходят в подтверждённые заказы.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-[#343a3d]">
            {orders.slice(0, 5).map((ord) => {
              const statusCfg = ORDER_STATUS_LABELS[ord.status] || {
                label: ord.status,
                color: "border-[#4b5255] text-[#f1f0eb] bg-[#202325]",
              };

              return (
                <div
                  key={ord.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#f1f0eb]">
                        {ord.orderNumber}
                      </span>
                      <span
                        className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#888b8d]">
                      Позиций в заказе: <b className="text-[#f1f0eb]">{ord.itemsCount}</b>
                      {ord.deliveryDays && ` · Срок поставки: ${ord.deliveryDays} дн.`}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-[#ff865c]">
                      {ord.totalRub}
                    </p>
                    <span className="text-[10px] text-[#5e6568]">
                      {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(
                        new Date(ord.createdAt)
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. ADDRESSES SUMMARY */}
      <section className="border border-[#383e41] bg-[#1e2124] p-5 sm:p-7">
        <div className="flex items-center justify-between border-b border-[#343a3d] pb-3">
          <div>
            <h2 className="text-sm font-black uppercase text-[#f1f0eb]">
              Адресная книга ({addresses.length})
            </h2>
            <p className="text-[10px] text-[#888b8d]">Сохранённые точки получения заказов</p>
          </div>
          <Link
            href="/account/addresses"
            className="text-xs font-bold uppercase text-[#ff865c] hover:underline"
          >
            Управление адресами →
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.length === 0 ? (
            <div className="py-4 text-xs text-[#888b8d]">
              Адреса доставки не добавлены.{" "}
              <Link href="/account/addresses" className="text-[#ff6428] underline">
                Добавить адрес
              </Link>
            </div>
          ) : (
            addresses.slice(0, 2).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border border-[#343a3d] bg-[#17191b] p-3 text-xs"
              >
                <div>
                  <p className="font-bold text-[#f1f0eb]">{a.recipientName}</p>
                  <p className="mt-0.5 text-[11px] text-[#888b8d]">
                    {a.city}, ул. {a.street}, д. {a.house}
                    {a.apartment && `, кв. ${a.apartment}`}
                  </p>
                </div>
                {a.isDefault && (
                  <span className="border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                    Основной
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
