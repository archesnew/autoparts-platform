"use client";

import React, { useState } from "react";
import type { OrderDto } from "@/lib/server/order-types";

interface OrderWorkspaceProps {
  order: OrderDto;
  onBack: () => void;
  onStatusChange: (status: string, reason?: string) => Promise<void>;
  onRecordPayment: (input: { amount: number; paymentMethod: string; externalPaymentId?: string; notes?: string }) => Promise<void>;
  onUpdateShipment: (input: { carrier?: string; trackingNumber?: string; status?: string; city?: string; address?: string }) => Promise<void>;
  onAddDocument: (input: { documentType: string; documentNumber?: string; contentJson?: any }) => Promise<void>;
  onAddMessage: (input: { message: string; isInternal?: boolean }) => Promise<void>;
  onViewRequest?: (requestId: string) => void;
}

const statusOptions = [
  { value: "NEW", label: "Новый" },
  { value: "PENDING_PAYMENT", label: "Ожидает оплаты" },
  { value: "PAID", label: "Оплачен" },
  { value: "PENDING_PROCUREMENT", label: "В закупке" },
  { value: "IN_FULFILLMENT", label: "В комплектации" },
  { value: "READY_FOR_SHIPMENT", label: "Готов к отправке" },
  { value: "SHIPPED", label: "В пути" },
  { value: "DELIVERED", label: "Доставлен" },
  { value: "COMPLETED", label: "Выполнен" },
  { value: "CANCELLED", label: "Отменён" },
];

const deliveryStatusOptions = [
  { value: "PENDING", label: "Ожидает" },
  { value: "DISPATCH_PREPARED", label: "Сформирован" },
  { value: "IN_TRANSIT", label: "В пути" },
  { value: "AT_PICKUP_POINT", label: "В ПВЗ" },
  { value: "OUT_FOR_DELIVERY", label: "У курьера" },
  { value: "DELIVERED", label: "Вручён" },
  { value: "RETURNED", label: "Возврат" },
];

export function OrderWorkspace({
  order,
  onBack,
  onStatusChange,
  onRecordPayment,
  onUpdateShipment,
  onAddDocument,
  onAddMessage,
  onViewRequest,
}: OrderWorkspaceProps) {
  // Modals & form state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(order.grandTotal);
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payExtId, setPayExtId] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  // Shipment form state
  const firstShipment = order.shipments[0];
  const [shipCarrier, setShipCarrier] = useState(firstShipment?.carrier ?? "CDEK");
  const [shipTracking, setShipTracking] = useState(firstShipment?.trackingNumber ?? "");
  const [shipStatus, setShipStatus] = useState(firstShipment?.status ?? "PENDING");
  const [shipCity, setShipCity] = useState(firstShipment?.city ?? "");
  const [shipAddress, setShipAddress] = useState(firstShipment?.address ?? "");
  const [updatingShip, setUpdatingShip] = useState(false);

  // Message state
  const [msgText, setMsgText] = useState("");
  const [msgInternal, setMsgInternal] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Invoice modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const totalPaid = order.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingToPay = Math.max(0, Number(order.grandTotal) - totalPaid);

  const canReadPurchase = order.items.some((i) => i.purchasePrice !== undefined);

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) return;
    setPaying(true);
    try {
      await onRecordPayment({
        amount: Number(payAmount),
        paymentMethod: payMethod,
        externalPaymentId: payExtId || undefined,
        notes: payNotes || undefined,
      });
      setPaymentModalOpen(false);
    } finally {
      setPaying(false);
    }
  }

  async function handleShipmentSave() {
    setUpdatingShip(true);
    try {
      await onUpdateShipment({
        carrier: shipCarrier,
        trackingNumber: shipTracking,
        status: shipStatus,
        city: shipCity,
        address: shipAddress,
      });
    } finally {
      setUpdatingShip(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgText.trim()) return;
    setSendingMsg(true);
    try {
      await onAddMessage({ message: msgText.trim(), isInternal: msgInternal });
      setMsgText("");
    } finally {
      setSendingMsg(false);
    }
  }

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#383e41] bg-[#1a1d1f] p-4 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="border border-[#4b5255] bg-[#222528] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] hover:border-[#ff6428]"
          >
            ← К реестру заказов
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-extrabold text-[#f1f0eb]">
                {order.orderNumber}
              </h1>
              <span className="rounded bg-[#ff6428] px-2 py-0.5 text-[10px] font-bold text-[#17191b]">
                {order.status}
              </span>
            </div>
            {order.requestNumber && (
              <div className="mt-0.5 text-[11px] text-[#929a9c]">
                Создан из заявки:{" "}
                <button
                  type="button"
                  onClick={() => onViewRequest?.(order.requestId || order.requestNumber || "")}
                  className="font-bold text-[#ff865c] hover:underline"
                >
                  {order.requestNumber}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status selector */}
          <select
            value={order.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="border border-[#4b5255] bg-[#222528] px-2.5 py-1.5 text-xs font-bold uppercase text-[#f1f0eb] outline-none hover:border-[#ff6428] focus:border-[#ff6428]"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Quick Invoice button */}
          <button
            type="button"
            onClick={() => setInvoiceModalOpen(true)}
            className="border border-[#4b5255] bg-[#222528] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#f1f0eb] hover:border-[#ff6428]"
          >
            📄 Счёт / Печать
          </button>
        </div>
      </div>

      {/* 2. Main 2-Column Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column (2 spans): Items, Payment, Shipment, Messages */}
        <div className="space-y-4 lg:col-span-2">
          {/* Section A: Ordered Items */}
          <div className="border border-[#383e41] bg-[#1e2124] p-4 shadow-sm">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#aeb5b6]">
              1. Состав заказа и финансовый расчёт
            </h2>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#383e41] bg-[#17191b] text-[10px] font-bold uppercase tracking-wider text-[#929a9c]">
                  <tr>
                    <th className="px-3 py-2">Деталь / Артикул</th>
                    <th className="px-3 py-2">Поставщик</th>
                    <th className="px-3 py-2 text-center">Кол-во</th>
                    {canReadPurchase && <th className="px-3 py-2 text-right">Закупка</th>}
                    {canReadPurchase && <th className="px-3 py-2 text-right">Наценка</th>}
                    <th className="px-3 py-2 text-right">Розница</th>
                    <th className="px-3 py-2 text-right">Итого</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2f32]">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#24282b]">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-[#f1f0eb]">{item.nameOnPurchase}</div>
                        <div className="font-mono text-[10px] text-[#ff865c]">
                          OEM: {item.requestedPartNumber}
                        </div>
                        <div className="text-[9px] text-[#747d80]">
                          Состояние: {item.condition === "NEW" ? "Новая" : "Б/У"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">
                        <div className="text-[#f1f0eb]">{item.supplierName ?? "Склад"}</div>
                        <div className="text-[10px] text-[#888b8d]">{item.supplierCountry}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-[#f1f0eb]">
                        {item.quantity}
                      </td>
                      {canReadPurchase && (
                        <td className="px-3 py-2.5 text-right font-mono text-[#aeb5b6]">
                          {Number(item.purchasePrice).toLocaleString("ru-RU")} {item.purchaseCurrency}
                        </td>
                      )}
                      {canReadPurchase && (
                        <td className="px-3 py-2.5 text-right font-mono text-[#2ecc71]">
                          +{Number(item.markup).toLocaleString("ru-RU")} ₽
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-[#f1f0eb]">
                        {Number(item.salePrice).toLocaleString("ru-RU")} ₽
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#ff6428]">
                        {Number(item.totalAmount).toLocaleString("ru-RU")} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial summary bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#383e41] pt-3 text-xs">
              <div className="flex flex-wrap gap-4 text-[#aeb5b6]">
                <div>
                  Позиции:{" "}
                  <b className="font-mono text-[#f1f0eb]">
                    {Number(order.subtotal).toLocaleString("ru-RU")} ₽
                  </b>
                </div>
                <div>
                  Логистика:{" "}
                  <b className="font-mono text-[#f1f0eb]">
                    {Number(order.logisticsTotal).toLocaleString("ru-RU")} ₽
                  </b>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#929a9c]">Итого к оплате: </span>
                <span className="font-mono text-base font-extrabold text-[#ff6428]">
                  {Number(order.grandTotal).toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </div>
          </div>

          {/* Section B: Payments */}
          <div className="border border-[#383e41] bg-[#1e2124] p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#2d3235] pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#aeb5b6]">
                  2. Платежи и статус оплаты
                </h2>
                <span className="rounded bg-[#2a2f32] px-2 py-0.5 text-[10px] font-bold text-[#ff865c]">
                  {order.paymentStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="border border-[#ff6428] bg-[#ff6428]/10 px-2.5 py-1 text-[10px] font-bold uppercase text-[#ff865c] hover:bg-[#ff6428] hover:text-[#17191b]"
              >
                + Зарегистрировать оплату
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="border border-[#383e41] bg-[#17191b] p-3">
                <div className="text-[10px] text-[#929a9c]">Сумма счёта</div>
                <div className="font-mono text-sm font-bold text-[#f1f0eb]">
                  {Number(order.grandTotal).toLocaleString("ru-RU")} ₽
                </div>
              </div>
              <div className="border border-[#383e41] bg-[#17191b] p-3">
                <div className="text-[10px] text-[#929a9c]">Оплачено</div>
                <div className="font-mono text-sm font-bold text-[#2ecc71]">
                  {totalPaid.toLocaleString("ru-RU")} ₽
                </div>
              </div>
              <div className="border border-[#383e41] bg-[#17191b] p-3">
                <div className="text-[10px] text-[#929a9c]">Остаток к доплате</div>
                <div className="font-mono text-sm font-bold text-[#ff6428]">
                  {remainingToPay.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            </div>

            {/* Payments list */}
            {order.payments.length > 0 ? (
              <div className="mt-3 divide-y divide-[#2a2f32] border border-[#383e41] bg-[#17191b]">
                {order.payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                    <div>
                      <div className="font-bold text-[#f1f0eb]">
                        {Number(p.amount).toLocaleString("ru-RU")} {p.currency}
                      </div>
                      <div className="text-[10px] text-[#888b8d]">
                        {p.paymentMethod} • {p.paidAt ? new Date(p.paidAt).toLocaleString("ru-RU") : "Ожидает"}
                        {p.externalPaymentId && ` • ID: ${p.externalPaymentId}`}
                      </div>
                      {p.notes && <div className="mt-0.5 text-[10px] text-[#aeb5b6]">{p.notes}</div>}
                    </div>
                    <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 p-3 text-center text-[11px] text-[#747d80]">
                Платежей по заказу пока не зафиксировано.
              </div>
            )}
          </div>

          {/* Section C: Shipment & Logistics */}
          <div className="border border-[#383e41] bg-[#1e2124] p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#2d3235] pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#aeb5b6]">
                  3. Доставка и логистика
                </h2>
                <span className="rounded bg-[#2a2f32] px-2 py-0.5 text-[10px] font-bold text-[#3498db]">
                  {order.deliveryStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={handleShipmentSave}
                disabled={updatingShip}
                className="border border-[#4b5255] bg-[#222528] px-3 py-1 text-[10px] font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428] disabled:opacity-50"
              >
                {updatingShip ? "Сохранение..." : "Сохранить трек и статус"}
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[9px] font-bold uppercase text-[#929a9c]">
                  Служба доставки
                </label>
                <select
                  value={shipCarrier}
                  onChange={(e) => setShipCarrier(e.target.value)}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2.5 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                >
                  <option value="CDEK">СДЭК</option>
                  <option value="RUSSIAN_POST">Почта России</option>
                  <option value="BOXBERRY">Boxberry</option>
                  <option value="DELLIN">Деловые Линии</option>
                  <option value="COURIER">Курьерская служба</option>
                  <option value="PICKUP">Самовывоз со склада</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-[#929a9c]">
                  Трек-номер отправления
                </label>
                <input
                  type="text"
                  value={shipTracking}
                  onChange={(e) => setShipTracking(e.target.value)}
                  placeholder="Номер накладной / трек..."
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2.5 py-1.5 font-mono text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-[#929a9c]">
                  Статус доставки
                </label>
                <select
                  value={shipStatus}
                  onChange={(e) => setShipStatus(e.target.value as any)}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2.5 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                >
                  {deliveryStatusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[9px] font-bold uppercase text-[#929a9c]">
                  Город доставки
                </label>
                <input
                  type="text"
                  value={shipCity}
                  onChange={(e) => setShipCity(e.target.value)}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2.5 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase text-[#929a9c]">
                  Адрес / Пункт выдачи
                </label>
                <input
                  type="text"
                  value={shipAddress}
                  onChange={(e) => setShipAddress(e.target.value)}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2.5 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>
            </div>
          </div>

          {/* Section D: Messages & Notes */}
          <div className="border border-[#383e41] bg-[#1e2124] p-4 shadow-sm">
            <h2 className="border-b border-[#2d3235] pb-2 text-xs font-extrabold uppercase tracking-wider text-[#aeb5b6]">
              4. Внутренние заметки и история сообщений
            </h2>

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {order.messages.map((m) => (
                <div
                  key={m.id}
                  className={`border p-2.5 ${
                    m.isInternal
                      ? "border-[#383e41] bg-[#17191b]"
                      : "border-blue-900/40 bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-[#888b8d]">
                    <span className="font-bold text-[#f1f0eb]">{m.authorName ?? "Менеджер"}</span>
                    <span>{new Date(m.createdAt).toLocaleString("ru-RU")}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#c2c7c8]">{m.message}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
              <input
                type="text"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Добавить заметку к заказу..."
                className="flex-1 border border-[#414749] bg-[#17191b] px-3 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
              />
              <button
                type="submit"
                disabled={sendingMsg || !msgText.trim()}
                className="border border-[#ff6428] bg-[#ff6428] px-4 py-1.5 text-xs font-bold uppercase text-[#17191b] hover:opacity-90 disabled:opacity-50"
              >
                Отправить
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (1 span): Customer Card, Documents, Timeline */}
        <div className="space-y-4">
          {/* Customer Card */}
          <div className="border border-[#383e41] bg-[#1e2124] p-4 shadow-sm">
            <h2 className="border-b border-[#2d3235] pb-2 text-xs font-extrabold uppercase tracking-wider text-[#aeb5b6]">
              Покупатель
            </h2>
            <div className="mt-3 space-y-1.5">
              <div className="font-bold text-[#f1f0eb]">{order.customerName}</div>
              <div className="text-[11px] text-[#c2c7c8]">📞 {order.customerPhone}</div>
              {order.customerEmail && (
                <div className="text-[11px] text-[#c2c7c8]">✉️ {order.customerEmail}</div>
              )}
              {order.customerComment && (
                <div className="mt-2 border-t border-[#2d3235] pt-2 text-[11px] text-[#ffb08c]">
                  <b>Пожелание клиента:</b> {order.customerComment}
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="border border-[#383e41] bg-[#1e2124] p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#2d3235] pb-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#aeb5b6]">
                Документы
              </h2>
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(true)}
                className="text-[10px] font-bold text-[#ff865c] hover:underline"
              >
                Счёт-фактура
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {order.documents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between border border-[#383e41] bg-[#17191b] p-2"
                >
                  <div>
                    <div className="font-mono text-[11px] font-bold text-[#f1f0eb]">
                      {d.documentNumber}
                    </div>
                    <div className="text-[9px] text-[#888b8d]">
                      {d.documentType} • Версия {d.version}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInvoiceModalOpen(true)}
                    className="border border-[#4b5255] px-2 py-0.5 text-[9px] font-bold uppercase hover:border-[#ff6428]"
                  >
                    Печать
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log Audit Trail */}
          <div className="border border-[#383e41] bg-[#1e2124] p-4 shadow-sm">
            <h2 className="border-b border-[#2d3235] pb-2 text-xs font-extrabold uppercase tracking-wider text-[#aeb5b6]">
              История событий
            </h2>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {(order.events ?? []).map((evt, idx) => (
                <div key={idx} className="border-l-2 border-[#ff6428] pl-2 text-[10px]">
                  <div className="text-[#888b8d]">{evt.at} • {evt.who}</div>
                  <div className="font-semibold text-[#f1f0eb]">{evt.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border border-[#4b5255] bg-[#202325] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#383e41] pb-3">
              <h3 className="text-sm font-extrabold uppercase text-[#f1f0eb]">
                Регистрация оплаты заказа {order.orderNumber}
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-sm font-bold text-[#929a9c] hover:text-[#f1f0eb]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#929a9c]">
                  Сумма платежа (₽)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-1.5 font-mono text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#929a9c]">
                  Способ оплаты
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                >
                  <option value="BANK_TRANSFER">Безналичный платёж (р/с юрлица)</option>
                  <option value="CARD_ONLINE">Банковская карта (эквайринг)</option>
                  <option value="SBP">Система быстрых платежей (СБП)</option>
                  <option value="CASH_PICKUP">Наличными при получении в ПВЗ</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#929a9c]">
                  Внешний ID транзакции / номер платёжки
                </label>
                <input
                  type="text"
                  value={payExtId}
                  onChange={(e) => setPayExtId(e.target.value)}
                  placeholder="Номер п/п или RRN транзакции..."
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#929a9c]">
                  Примечание к платежу
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Заметка бухгалтера или менеджера..."
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-1.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#383e41] pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="border border-[#4b5255] px-4 py-1.5 text-xs font-bold uppercase text-[#aeb5b6]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="border border-[#ff6428] bg-[#ff6428] px-4 py-1.5 text-xs font-bold uppercase text-[#17191b] hover:opacity-90 disabled:opacity-50"
                >
                  {paying ? "Сохранение..." : "Подтвердить платёж"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl border border-[#4b5255] bg-[#ffffff] p-8 text-[#17191b] shadow-2xl">
            <div className="flex items-start justify-between border-b-2 border-[#17191b] pb-4">
              <div>
                <div className="text-xl font-extrabold tracking-wider">ZAPTUT.PRO</div>
                <div className="text-xs text-[#555]">Агрегатор автозапчастей и логистика</div>
                <div className="mt-2 text-xs">
                  <b>Поставщик:</b> ООО «ЗАПТУТ ПРО», ИНН 7701234567, КПП 770101001
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold">СЧЁТ № {order.orderNumber}</div>
                <div className="text-xs text-[#666]">
                  от {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="mt-2 rounded bg-zinc-200 px-3 py-1 text-xs font-bold hover:bg-zinc-300"
                >
                  ✕ Закрыть
                </button>
              </div>
            </div>

            <div className="mt-4 text-xs">
              <b>Покупатель:</b> {order.customerName}, тел. {order.customerPhone}
            </div>

            <table className="mt-4 w-full border-collapse border border-zinc-300 text-left text-xs">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border border-zinc-300 p-2">№</th>
                  <th className="border border-zinc-300 p-2">Наименование товара</th>
                  <th className="border border-zinc-300 p-2">OEM Артикул</th>
                  <th className="border border-zinc-300 p-2 text-center">Кол-во</th>
                  <th className="border border-zinc-300 p-2 text-right">Цена, ₽</th>
                  <th className="border border-zinc-300 p-2 text-right">Сумма, ₽</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td className="border border-zinc-300 p-2 text-center">{idx + 1}</td>
                    <td className="border border-zinc-300 p-2 font-bold">{it.nameOnPurchase}</td>
                    <td className="border border-zinc-300 p-2 font-mono">{it.requestedPartNumber}</td>
                    <td className="border border-zinc-300 p-2 text-center">{it.quantity}</td>
                    <td className="border border-zinc-300 p-2 text-right">
                      {Number(it.salePrice).toLocaleString("ru-RU")}
                    </td>
                    <td className="border border-zinc-300 p-2 text-right font-bold">
                      {Number(it.totalAmount).toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end text-xs">
              <div className="w-64 space-y-1">
                <div className="flex justify-between">
                  <span>Сумма деталей:</span>
                  <b>{Number(order.subtotal).toLocaleString("ru-RU")} ₽</b>
                </div>
                <div className="flex justify-between">
                  <span>Доставка:</span>
                  <b>{Number(order.logisticsTotal).toLocaleString("ru-RU")} ₽</b>
                </div>
                <div className="flex justify-between border-t border-zinc-300 pt-1 text-sm font-bold">
                  <span>Итого к оплате:</span>
                  <span>{Number(order.grandTotal).toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-[#17191b] px-4 py-1.5 text-xs font-bold text-white hover:bg-black"
              >
                🖨️ Распечатать счёт
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
