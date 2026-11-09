"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLoader } from "@/components/brand/brand-loader";

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  grandTotal: string;
  grandTotalFormatted: string;
  currency: string;
  createdAt: string;
  itemsCount: number;
  itemsSummary: string;
  trackingNumber?: string | null;
  carrier?: string | null;
};

const ORDER_STATUS_MAP: Record<string, { label: string; badgeClass: string }> = {
  NEW: { label: "Новый заказ", badgeClass: "border-[#ff6428] text-[#ff865c] bg-[#ff6428]/10" },
  PROCESSING: { label: "В комплектации", badgeClass: "border-sky-600 text-sky-400 bg-sky-950/20" },
  READY_FOR_SHIPMENT: { label: "Готов к отправке", badgeClass: "border-amber-600 text-amber-400 bg-amber-950/20" },
  SHIPPED: { label: "В пути / Отправлен", badgeClass: "border-emerald-600 text-emerald-400 bg-emerald-950/20" },
  DELIVERED: { label: "Доставлен", badgeClass: "border-emerald-500 text-emerald-300 bg-emerald-950/30" },
  COMPLETED: { label: "Выполнен", badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]" },
  CANCELLED: { label: "Отменён", badgeClass: "border-red-900 text-red-400 bg-red-950/20" },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; badgeClass: string }> = {
  PENDING: { label: "Ожидает оплаты", badgeClass: "border-amber-700 text-amber-400 bg-amber-950/20" },
  PARTIALLY_PAID: { label: "Частично оплачен", badgeClass: "border-sky-700 text-sky-400 bg-sky-950/20" },
  PAID: { label: "Оплачен", badgeClass: "border-emerald-700 text-emerald-400 bg-emerald-950/20" },
  REFUNDED: { label: "Возврат", badgeClass: "border-purple-700 text-purple-400 bg-purple-950/20" },
  CANCELLED: { label: "Отмена оплаты", badgeClass: "border-red-900 text-red-400 bg-red-950/20" },
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    try {
      const res = await fetch("/api/customer/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-[#383e41] bg-[#1e2124]">
        <BrandLoader phase="loading" label="Загрузка заказов..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border border-[#383e41] bg-[#1e2124] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
            Личный кабинет · Заказы
          </p>
          <h1 className="mt-1 text-xl font-black uppercase text-[#f1f0eb]">
            Мои заказы ({orders.length})
          </h1>
          <p className="mt-1 text-xs text-[#888b8d]">
            История оформленных заказов, статусы комплектации, трек-номера и счета.
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex min-h-11 items-center justify-center bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
        >
          Каталог деталей →
        </Link>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="border border-dashed border-[#414749] bg-[#1e2124] p-10 text-center">
          <p className="text-sm font-bold text-[#f1f0eb]">У вас пока нет оформленных заказов</p>
          <p className="mt-2 text-xs text-[#888b8d]">
            Заказ формируется автоматически после согласования и принятия коммерческого предложения по вашей заявке.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/account/requests"
              className="border border-[#414749] px-4 py-2 text-xs font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428]"
            >
              Мои заявки
            </Link>
            <Link
              href="/catalog"
              className="bg-[#ff6428] px-4 py-2 text-xs font-black uppercase text-[#17191b] hover:bg-[#ff7a45]"
            >
              Перейти в каталог
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const statusConfig = ORDER_STATUS_MAP[ord.status] || {
              label: ord.status,
              badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]",
            };
            const paymentConfig = PAYMENT_STATUS_MAP[ord.paymentStatus] || {
              label: ord.paymentStatus,
              badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]",
            };

            return (
              <div
                key={ord.id}
                className="border border-[#383e41] bg-[#1e2124] p-5 transition hover:border-[#4b5255]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-[#f1f0eb]">
                        {ord.orderNumber}
                      </span>
                      <span
                        className={`inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusConfig.badgeClass}`}
                      >
                        {statusConfig.label}
                      </span>
                      <span
                        className={`inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${paymentConfig.badgeClass}`}
                      >
                        {paymentConfig.label}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[#888b8d]">
                      Оформлен {new Date(ord.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>

                    <div className="mt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#888b8d]">
                        Товары в заказе ({ord.itemsCount} поз.):
                      </p>
                      <p className="mt-0.5 text-xs text-[#f1f0eb] line-clamp-2">
                        {ord.itemsSummary || "—"}
                      </p>
                    </div>

                    {ord.trackingNumber && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                          Доставка {ord.carrier || "СДЭК"}:
                        </span>
                        <span className="font-mono font-bold text-[#ff865c]">
                          {ord.trackingNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                    <div className="sm:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                        Сумма заказа:
                      </span>
                      <p className="text-xl font-black tabular-nums text-[#ff6428]">
                        {ord.grandTotalFormatted}
                      </p>
                    </div>

                    <Link
                      href={`/account/orders/${ord.id}`}
                      className="inline-flex min-h-10 items-center justify-center border border-[#414749] px-4 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] transition hover:border-[#ff6428] hover:text-[#ff6428]"
                    >
                      Детали заказа →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
