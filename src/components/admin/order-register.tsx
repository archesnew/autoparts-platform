"use client";

import React, { useState } from "react";
import type { OrderDto } from "@/lib/server/order-types";

export type OrderQueue =
  | "all"
  | "new"
  | "pending_payment"
  | "paid"
  | "procurement"
  | "in_fulfillment"
  | "ready_shipment"
  | "in_transit"
  | "completed"
  | "cancelled";

interface OrderRegisterProps {
  orders: OrderDto[];
  queues: Record<string, number>;
  activeQueue: OrderQueue;
  onQueueChange: (queue: OrderQueue) => void;
  onSelectOrder: (orderId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  paymentFilter: string;
  onPaymentFilterChange: (p: string) => void;
  deliveryFilter: string;
  onDeliveryFilterChange: (d: string) => void;
  countryFilter: string;
  onCountryFilterChange: (c: string) => void;
  loading?: boolean;
}

const statusBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  NEW: { bg: "bg-blue-900/40 border-blue-500/50", text: "text-blue-300", label: "Новый" },
  PENDING_PAYMENT: { bg: "bg-yellow-900/40 border-yellow-500/50", text: "text-yellow-300", label: "Ожидает оплаты" },
  PAID: { bg: "bg-emerald-900/40 border-emerald-500/50", text: "text-emerald-300", label: "Оплачен" },
  PENDING_PROCUREMENT: { bg: "bg-amber-900/40 border-amber-500/50", text: "text-amber-300", label: "В закупке" },
  IN_FULFILLMENT: { bg: "bg-purple-900/40 border-purple-500/50", text: "text-purple-300", label: "Комплектация" },
  READY_FOR_SHIPMENT: { bg: "bg-cyan-900/40 border-cyan-500/50", text: "text-cyan-300", label: "Готов к отправке" },
  SHIPPED: { bg: "bg-indigo-900/40 border-indigo-500/50", text: "text-indigo-300", label: "В пути" },
  DELIVERED: { bg: "bg-teal-900/40 border-teal-500/50", text: "text-teal-300", label: "Доставлен" },
  COMPLETED: { bg: "bg-emerald-950/60 border-emerald-500", text: "text-emerald-400", label: "Выполнен" },
  CANCELLED: { bg: "bg-red-950/40 border-red-500/50", text: "text-red-400", label: "Отменён" },
};

const paymentBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-[#292d30] border-[#4b5255]", text: "text-[#aeb5b6]", label: "Не оплачен" },
  PARTIALLY_PAID: { bg: "bg-yellow-950/40 border-yellow-500/60", text: "text-yellow-400", label: "Частично" },
  PAID: { bg: "bg-emerald-950/40 border-emerald-500/60", text: "text-emerald-400", label: "Оплачен" },
  REFUNDED: { bg: "bg-purple-950/40 border-purple-500/60", text: "text-purple-400", label: "Возврат" },
  FAILED: { bg: "bg-red-950/40 border-red-500/60", text: "text-red-400", label: "Ошибка" },
  CANCELLED: { bg: "bg-zinc-900 border-zinc-700", text: "text-zinc-400", label: "Отменён" },
};

const deliveryBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-[#292d30] border-[#4b5255]", text: "text-[#aeb5b6]", label: "Ожидает" },
  DISPATCH_PREPARED: { bg: "bg-cyan-950/40 border-cyan-500/60", text: "text-cyan-400", label: "Сформирован" },
  IN_TRANSIT: { bg: "bg-blue-950/40 border-blue-500/60", text: "text-blue-400", label: "В пути" },
  AT_PICKUP_POINT: { bg: "bg-amber-950/40 border-amber-500/60", text: "text-amber-400", label: "В ПВЗ" },
  OUT_FOR_DELIVERY: { bg: "bg-indigo-950/40 border-indigo-500/60", text: "text-indigo-400", label: "У курьера" },
  DELIVERED: { bg: "bg-emerald-950/40 border-emerald-500/60", text: "text-emerald-400", label: "Вручён" },
  RETURNED: { bg: "bg-red-950/40 border-red-500/60", text: "text-red-400", label: "Возврат" },
  FAILED: { bg: "bg-red-950/40 border-red-500/60", text: "text-red-400", label: "Сбой" },
};

const queueTabs: Array<{ id: OrderQueue; label: string }> = [
  { id: "all", label: "Все заказы" },
  { id: "new", label: "Новые" },
  { id: "pending_payment", label: "Ожидают оплаты" },
  { id: "paid", label: "Оплачены" },
  { id: "procurement", label: "В закупке" },
  { id: "in_fulfillment", label: "В комплектации" },
  { id: "ready_shipment", label: "Готовы к отправке" },
  { id: "in_transit", label: "В пути" },
  { id: "completed", label: "Завершены" },
  { id: "cancelled", label: "Отменены" },
];

export function OrderRegister({
  orders,
  queues,
  activeQueue,
  onQueueChange,
  onSelectOrder,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  deliveryFilter,
  onDeliveryFilterChange,
  countryFilter,
  onCountryFilterChange,
  loading = false,
}: OrderRegisterProps) {
  return (
    <div className="space-y-4 text-xs">
      {/* 1. Header with Queues Navigation */}
      <div className="border border-[#383e41] bg-[#1a1d1f] p-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2d3235] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
              Управление заказами
            </span>
          </div>
          <div className="text-[11px] text-[#929a9c]">
            Всего заказов в выборке:{" "}
            <b className="tabular-nums text-[#f1f0eb]">{orders.length}</b>
          </div>
        </div>

        {/* Queues pill tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {queueTabs.map((tab) => {
            const count = queues[tab.id] ?? 0;
            const isActive = activeQueue === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onQueueChange(tab.id)}
                className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  isActive
                    ? "border-[#ff6428] bg-[#ff6428] text-[#17191b]"
                    : "border-[#383e41] bg-[#202325] text-[#c2c7c8] hover:border-[#ff6428]/60 hover:text-[#f1f0eb]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] tabular-nums ${
                    isActive
                      ? "bg-[#17191b] text-[#ff6428]"
                      : "bg-[#2c3134] text-[#aeb5b6]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="grid gap-2 border border-[#383e41] bg-[#1e2124] p-3 sm:grid-cols-2 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#929a9c]">
            Поиск заказа, клиента, OEM
          </label>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Номер заказа, ZP-..., имя, телефон, OEM..."
            className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-1.5 text-xs text-[#f1f0eb] outline-none placeholder:text-[#5e6669] focus:border-[#ff6428]"
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#929a9c]">
            Статус заказа
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
          >
            <option value="">Все статусы</option>
            <option value="NEW">Новый</option>
            <option value="PENDING_PAYMENT">Ожидает оплаты</option>
            <option value="PAID">Оплачен</option>
            <option value="PENDING_PROCUREMENT">В закупке</option>
            <option value="IN_FULFILLMENT">В комплектации</option>
            <option value="READY_FOR_SHIPMENT">Готов к отправке</option>
            <option value="SHIPPED">В пути</option>
            <option value="DELIVERED">Доставлен</option>
            <option value="COMPLETED">Выполнен</option>
            <option value="CANCELLED">Отменён</option>
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#929a9c]">
            Оплата
          </label>
          <select
            value={paymentFilter}
            onChange={(e) => onPaymentFilterChange(e.target.value)}
            className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
          >
            <option value="">Любая оплата</option>
            <option value="PENDING">Не оплачен</option>
            <option value="PARTIALLY_PAID">Частично</option>
            <option value="PAID">Оплачен</option>
            <option value="REFUNDED">Возврат</option>
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#929a9c]">
            Доставка
          </label>
          <select
            value={deliveryFilter}
            onChange={(e) => onDeliveryFilterChange(e.target.value)}
            className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
          >
            <option value="">Любая доставка</option>
            <option value="PENDING">Ожидает</option>
            <option value="IN_TRANSIT">В пути</option>
            <option value="AT_PICKUP_POINT">В ПВЗ</option>
            <option value="DELIVERED">Вручён</option>
          </select>
        </div>
      </div>

      {/* 3. Orders Table (Desktop) & Cards (Mobile) */}
      <div className="border border-[#383e41] bg-[#17191b]">
        {loading ? (
          <div className="p-8 text-center text-[#929a9c]">
            Загрузка списка заказов...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-[#929a9c]">
            Заказов по заданным критериям не найдено.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#383e41] bg-[#202325] text-[10px] font-bold uppercase tracking-wider text-[#929a9c]">
                  <tr>
                    <th className="px-3 py-2.5">Заказ</th>
                    <th className="px-3 py-2.5">Дата</th>
                    <th className="px-3 py-2.5">Покупатель</th>
                    <th className="px-3 py-2.5">Позиции</th>
                    <th className="px-3 py-2.5 text-right">Сумма</th>
                    <th className="px-3 py-2.5">Статус</th>
                    <th className="px-3 py-2.5">Оплата</th>
                    <th className="px-3 py-2.5">Доставка</th>
                    <th className="px-3 py-2.5 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2f32]">
                  {orders.map((order) => {
                    const sBadge = statusBadgeStyles[order.status] ?? statusBadgeStyles.NEW;
                    const pBadge = paymentBadgeStyles[order.paymentStatus] ?? paymentBadgeStyles.PENDING;
                    const dBadge = deliveryBadgeStyles[order.deliveryStatus] ?? deliveryBadgeStyles.PENDING;
                    const grandTotalNum = Number(order.grandTotal) || 0;
                    const firstShipment = order.shipments[0];

                    return (
                      <tr
                        key={order.id}
                        className="cursor-pointer transition-colors hover:bg-[#202326]"
                        onClick={() => onSelectOrder(order.id)}
                      >
                        <td className="px-3 py-3">
                          <div className="font-mono font-bold text-[#f1f0eb]">{order.orderNumber}</div>
                          {order.requestNumber && (
                            <div className="mt-0.5 text-[10px] text-[#ff865c]">← {order.requestNumber}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[11px] tabular-nums text-[#aeb5b6]">
                          {new Date(order.createdAt).toLocaleDateString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-[#f1f0eb]">{order.customerName}</div>
                          <div className="text-[10px] tabular-nums text-[#888b8d]">{order.customerPhone}</div>
                          {firstShipment?.city && (
                            <div className="text-[10px] text-[#747d80]">г. {firstShipment.city}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[11px] font-semibold text-[#f1f0eb]">
                            {order.items.length}{" "}
                            {order.items.length === 1 ? "деталь" : order.items.length < 5 ? "детали" : "деталей"}
                          </div>
                          <div className="truncate text-[10px] text-[#888b8d]" style={{ maxWidth: 220 }}>
                            {order.items.map((i) => i.nameOnPurchase).join(", ")}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="font-mono text-sm font-bold tabular-nums text-[#ff6428]">
                            {grandTotalNum.toLocaleString("ru-RU")} ₽
                          </div>
                          <div className="text-[9px] tabular-nums text-[#888b8d]">
                            лог.: {Number(order.logisticsTotal).toLocaleString("ru-RU")} ₽
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${sBadge.bg} ${sBadge.text}`}>
                            {sBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${pBadge.bg} ${pBadge.text}`}>
                            {pBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${dBadge.bg} ${dBadge.text}`}>
                            {dBadge.label}
                          </span>
                          {firstShipment?.trackingNumber && (
                            <div className="mt-0.5 font-mono text-[9px] text-[#888b8d]">
                              #{firstShipment.trackingNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectOrder(order.id);
                            }}
                            className="min-h-8 border border-[#4b5255] bg-[#222528] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#f1f0eb] transition-colors hover:border-[#ff6428] hover:text-[#ff6428]"
                          >
                            Открыть →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Order Cards */}
            <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:hidden">
              {orders.map((order) => {
                const sBadge = statusBadgeStyles[order.status] ?? statusBadgeStyles.NEW;
                const pBadge = paymentBadgeStyles[order.paymentStatus] ?? paymentBadgeStyles.PENDING;
                const dBadge = deliveryBadgeStyles[order.deliveryStatus] ?? deliveryBadgeStyles.PENDING;
                const grandTotalNum = Number(order.grandTotal) || 0;
                const firstShipment = order.shipments[0];

                return (
                  <article
                    key={order.id}
                    onClick={() => onSelectOrder(order.id)}
                    className="flex flex-col justify-between gap-3 border border-[#383e41] bg-[#1e2124] p-3.5 transition hover:border-[#ff6428]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-bold text-[#f1f0eb]">{order.orderNumber}</p>
                        {order.requestNumber && (
                          <p className="text-[10px] text-[#ff865c]">← {order.requestNumber}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-extrabold tabular-nums text-[#ff6428]">
                          {grandTotalNum.toLocaleString("ru-RU")} ₽
                        </p>
                        <p className="text-[10px] tabular-nums text-[#888b8d]">
                          {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[#343a3d] pt-2.5 text-xs">
                      <p className="font-semibold text-[#f1f0eb]">{order.customerName}</p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-[#aeb5b6]">
                        {order.customerPhone}
                        {firstShipment?.city ? ` · г. ${firstShipment.city}` : ""}
                      </p>
                      <p className="mt-1.5 line-clamp-1 text-[11px] text-[#888b8d]">
                        {order.items.length} поз.: {order.items.map((i) => i.nameOnPurchase).join(", ")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 border-t border-[#343a3d] pt-2.5">
                      <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase ${sBadge.bg} ${sBadge.text}`}>
                        {sBadge.label}
                      </span>
                      <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase ${pBadge.bg} ${pBadge.text}`}>
                        {pBadge.label}
                      </span>
                      <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase ${dBadge.bg} ${dBadge.text}`}>
                        {dBadge.label}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
