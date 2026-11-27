"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { BrandLoader } from "@/components/brand/brand-loader";

type OrderItem = {
  id: string;
  partName: string;
  brand: string;
  partNumber: string;
  condition: string;
  quantity: number;
  salePrice: string;
  totalAmount: string;
};

type Shipment = {
  id: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  status: string;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  pickupPointId?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
};

type OrderDocument = {
  id: string;
  documentType: string;
  documentNumber: string;
  fileUrl?: string | null;
  createdAt: string;
};

type OrderMessage = {
  id: string;
  senderType: string;
  message: string;
  authorName?: string | null;
  createdAt: string;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  requestId?: string | null;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  subtotal: string;
  logisticsTotal: string;
  grandTotal: string;
  grandTotalFormatted: string;
  currency: string;
  customerComment?: string | null;
  createdAt: string;
  items: OrderItem[];
  shipments: Shipment[];
  documents: OrderDocument[];
  messages: OrderMessage[];
};

const ORDER_STATUS_MAP: Record<string, { label: string; badgeClass: string; stepIndex: number }> = {
  NEW: { label: "Новый заказ", badgeClass: "border-[#ff6428] text-[#ff865c] bg-[#ff6428]/10", stepIndex: 0 },
  PROCESSING: { label: "В комплектации", badgeClass: "border-sky-600 text-sky-400 bg-sky-950/20", stepIndex: 1 },
  READY_FOR_SHIPMENT: { label: "Собран на складе", badgeClass: "border-amber-600 text-amber-400 bg-amber-950/20", stepIndex: 1 },
  SHIPPED: { label: "В пути / Отправлен", badgeClass: "border-emerald-600 text-emerald-400 bg-emerald-950/20", stepIndex: 2 },
  DELIVERED: { label: "Доставлен", badgeClass: "border-emerald-500 text-emerald-300 bg-emerald-950/30", stepIndex: 3 },
  COMPLETED: { label: "Выполнен", badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]", stepIndex: 3 },
  CANCELLED: { label: "Отменён", badgeClass: "border-red-900 text-red-400 bg-red-950/20", stepIndex: -1 },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; badgeClass: string }> = {
  PENDING: { label: "Ожидает оплаты", badgeClass: "border-amber-700 text-amber-400 bg-amber-950/20" },
  PARTIALLY_PAID: { label: "Частично оплачен", badgeClass: "border-sky-700 text-sky-400 bg-sky-950/20" },
  PAID: { label: "Оплачен", badgeClass: "border-emerald-700 text-emerald-400 bg-emerald-950/20" },
  REFUNDED: { label: "Возврат", badgeClass: "border-purple-700 text-purple-400 bg-purple-950/20" },
  CANCELLED: { label: "Отмена оплаты", badgeClass: "border-red-900 text-red-400 bg-red-950/20" },
};

const PROGRESS_STEPS = [
  { title: "Заказ оформлен", desc: "Подтверждено покупателем" },
  { title: "Комплектация", desc: "Сборка и проверка деталей" },
  { title: "В пути", desc: "Передано в службу доставки" },
  { title: "Получен", desc: "Выдан покупателю" },
];

export default function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [paymentComment, setPaymentComment] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmittedMsg, setPaymentSubmittedMsg] = useState("");

  async function submitPaymentReport(e: React.FormEvent) {
    e.preventDefault();
    if (paymentSubmitting) return;
    setPaymentSubmitting(true);
    try {
      const res = await fetch(`/api/customer/orders/${id}/payment-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: paymentComment }),
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentSubmittedMsg(data.message || "Сообщение об оплате отправлено менеджеру");
        setPaymentComment("");
        loadOrder();
      } else {
        alert(data.error || "Ошибка при отправке сообщения об оплате");
      }
    } catch {
      alert("Ошибка сети при отправке сообщения");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function loadOrder() {
    try {
      const res = await fetch(`/api/customer/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order || data);
      } else {
        setErrorMsg("Заказ не найден или доступ ограничен");
      }
    } catch {
      setErrorMsg("Ошибка сети при загрузке заказа");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center border border-[#383e41] bg-[#1e2124]">
        <BrandLoader phase="loading" label="Загрузка данных заказа..." />
      </div>
    );
  }

  if (errorMsg && !order) {
    return (
      <div className="border border-red-900/50 bg-[#1e2124] p-8 text-center">
        <p className="text-sm font-bold text-red-400">{errorMsg}</p>
        <Link
          href="/account/orders"
          className="mt-4 inline-block border border-[#414749] px-4 py-2 text-xs font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428]"
        >
          ← Вернуться к заказам
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const statusConfig = ORDER_STATUS_MAP[order.status] || {
    label: order.status,
    badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]",
    stepIndex: 0,
  };
  const paymentConfig = PAYMENT_STATUS_MAP[order.paymentStatus] || {
    label: order.paymentStatus,
    badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]",
  };

  const primaryShipment = order.shipments[0];
  const currentStep = statusConfig.stepIndex;

  return (
    <div className="space-y-6">
      {/* Top Bar with back link */}
      <div className="flex flex-col gap-4 border border-[#383e41] bg-[#1e2124] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/account/orders"
            className="text-[11px] font-bold uppercase tracking-wider text-[#ff6428] hover:text-[#f1f0eb]"
          >
            ← Ко всем заказам
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black font-mono uppercase text-[#f1f0eb]">
              {order.orderNumber}
            </h1>
            <span
              className={`inline-block border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${statusConfig.badgeClass}`}
            >
              {statusConfig.label}
            </span>
            <span
              className={`inline-block border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${paymentConfig.badgeClass}`}
            >
              {paymentConfig.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#888b8d]">
            Оформлен {new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <div className="sm:text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
            Итого к оплате
          </span>
          <p className="text-2xl font-black tabular-nums text-[#ff6428]">
            {order.grandTotalFormatted}
          </p>
          {order.requestId && (
            <Link
              href={`/account/requests/${order.requestId}`}
              className="mt-1 inline-block text-[11px] text-[#888b8d] hover:text-[#ff6428]"
            >
              Связано с заявкой →
            </Link>
          )}
        </div>
      </div>

      {/* Progress Timeline Bar */}
      {currentStep >= 0 && (
        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#888b8d]">
            Статус выполнения заказа
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PROGRESS_STEPS.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div key={step.title} className="relative">
                  <div className="flex items-center gap-2">
                    <div
                      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                        isCurrent
                          ? "bg-[#ff6428] text-[#17191b]"
                          : isPast
                          ? "bg-emerald-600 text-[#17191b]"
                          : "border border-[#414749] bg-[#17191b] text-[#888b8d]"
                      }`}
                    >
                      {isPast ? "✓" : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isCurrent ? "text-[#ff6428]" : isPast ? "text-[#f1f0eb]" : "text-[#888b8d]"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  <p className="mt-1 pl-9 text-[11px] text-[#888b8d]">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ordered Items Table */}
      <div className="border border-[#383e41] bg-[#1e2124] p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
          Товары в заказе ({order.items.length})
        </p>
        <div className="mt-4 divide-y divide-[#383e41] border border-[#383e41] bg-[#17191b]">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between text-xs"
            >
              <div>
                <p className="font-bold text-[#f1f0eb]">{item.partName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#888b8d]">
                  {item.brand && <span>Бренд: <b className="text-[#f1f0eb]">{item.brand}</b></span>}
                  {item.partNumber && <span>OEM: <b className="font-mono text-[#ff865c]">{item.partNumber}</b></span>}
                  {item.condition && <span>Состояние: <b className="text-[#f1f0eb]">{item.condition}</b></span>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-6 sm:justify-end text-right">
                <span className="text-[#888b8d]">
                  {item.quantity} шт. × {Number(item.salePrice).toLocaleString("ru-RU")} ₽
                </span>
                <span className="font-mono text-sm font-black text-[#ff6428]">
                  {Number(item.totalAmount).toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-end gap-1 text-xs">
          <div className="flex justify-between gap-8 text-[#888b8d]">
            <span>Сумма деталей:</span>
            <span className="font-mono text-[#f1f0eb]">
              {Number(order.subtotal).toLocaleString("ru-RU")} ₽
            </span>
          </div>
          {Number(order.logisticsTotal) > 0 && (
            <div className="flex justify-between gap-8 text-[#888b8d]">
              <span>Доставка:</span>
              <span className="font-mono text-[#f1f0eb]">
                {Number(order.logisticsTotal).toLocaleString("ru-RU")} ₽
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between gap-8 border-t border-[#383e41] pt-2 text-sm font-black">
            <span className="text-[#f1f0eb]">Итого:</span>
            <span className="font-mono text-[#ff6428]">
              {order.grandTotalFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Instructions & Action */}
      <div className="border border-[#383e41] bg-[#1e2124] p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
              Оплата заказа
            </p>
            <h3 className="mt-1 text-base font-bold text-[#f1f0eb]">
              {order.paymentStatus === "PAID"
                ? "Заказ оплачен"
                : "Инструкция по оплате"}
            </h3>
          </div>
          <span className={`inline-block border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${paymentConfig.badgeClass}`}>
            {paymentConfig.label}
          </span>
        </div>

        {order.paymentStatus === "PAID" ? (
          <div className="mt-4 border border-emerald-900/50 bg-emerald-950/20 p-4 text-xs text-emerald-300">
            ✓ Оплата по заказу успешно подтверждена менеджером. Заказ передан в комплектацию и доставку.
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            <div className="border border-[#383e41] bg-[#17191b] p-4 leading-6 text-[#cbd0d1]">
              <p className="font-bold text-[#f1f0eb]">Сумма к оплате: <span className="text-[#ff6428] text-base">{order.grandTotalFormatted}</span></p>
              <p className="mt-2 text-[#aeb5b6]">
                Оплата производится прямым банковским переводом по выставленному согласованию с вашим персональным менеджером ZAPTUT.PRO. После осуществления перевода отправьте подтверждение ниже, чтобы менеджер сверил выписку и подтвердил зачисление.
              </p>
            </div>

            {paymentSubmittedMsg ? (
              <div className="border border-sky-800 bg-sky-950/30 p-4 text-xs text-sky-300">
                ✓ {paymentSubmittedMsg}
              </div>
            ) : (
              <form onSubmit={submitPaymentReport} className="space-y-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#888b8d]">
                  Сообщение об оплате для менеджера
                  <input
                    type="text"
                    required
                    placeholder="Например: Оплачено через СБП 15:40 / Иванов И.И."
                    value={paymentComment}
                    onChange={(e) => setPaymentComment(e.target.value)}
                    className="mt-1.5 w-full border border-[#414749] bg-[#17191b] px-3 py-2.5 text-xs text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="bg-[#ff6428] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050] disabled:opacity-50"
                >
                  {paymentSubmitting ? "Отправка..." : "Сообщить об оплате →"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Shipment & Delivery Details */}
      {primaryShipment && (
        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
            Информация о доставке
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                Служба доставки
              </span>
              <p className="mt-1 font-bold text-[#f1f0eb]">{primaryShipment.carrier || "СДЭК"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                Трек-номер отправления
              </span>
              <p className="mt-1 font-mono font-bold text-[#ff865c]">
                {primaryShipment.trackingNumber || "Будет присвоен после передачи в доставку"}
              </p>
              {primaryShipment.trackingNumber && (
                <a
                  href={
                    primaryShipment.carrier?.toLowerCase().includes("почта")
                      ? `https://www.pochta.ru/tracking#${encodeURIComponent(primaryShipment.trackingNumber)}`
                      : primaryShipment.carrier?.toLowerCase().includes("деловые")
                      ? `https://www.dellin.ru/tracker/?rw=${encodeURIComponent(primaryShipment.trackingNumber)}`
                      : `https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(primaryShipment.trackingNumber)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-[11px] font-bold text-[#ff6428] hover:underline"
                >
                  Отследить отправление на сайте службы ↗
                </a>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                Пункт назначения / Адрес
              </span>
              <p className="mt-1 text-[#f1f0eb]">
                {primaryShipment.city ? `${primaryShipment.city}, ` : ""}
                {primaryShipment.address || "Центральный пункт выдачи"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Documents */}
      {order.documents && order.documents.length > 0 && (
        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#888b8d]">
            Документы по заказу
          </p>
          <div className="mt-3 space-y-2">
            {order.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between border border-[#383e41] bg-[#17191b] p-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base text-[#ff6428]">📄</span>
                  <div>
                    <span className="font-bold text-[#f1f0eb]">{doc.documentNumber}</span>
                    <p className="text-[10px] text-[#888b8d]">
                      Счёт на оплату от {new Date(doc.createdAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#ff865c]">Сформирован</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client-facing messages from manager */}
      {order.messages && order.messages.length > 0 && (
        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#888b8d]">
            Сообщения менеджера
          </p>
          <div className="mt-3 space-y-3">
            {order.messages.map((msg) => (
              <div key={msg.id} className="border border-[#383e41] bg-[#17191b] p-3 text-xs">
                <div className="flex items-center justify-between text-[10px] text-[#888b8d]">
                  <span className="font-bold text-[#ff865c]">{msg.authorName || "Менеджер ZAPTUT"}</span>
                  <span>{new Date(msg.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-2 text-[#f1f0eb]">{msg.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
