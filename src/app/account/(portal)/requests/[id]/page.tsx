"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLoader } from "@/components/brand/brand-loader";

type RequestItem = {
  id: string;
  description: string;
  requestedPartNumber?: string | null;
  quantity: number;
  conditionPreference?: string | null;
  compatibilityNotes?: string | null;
};

type OfferLine = {
  itemId: string;
  name: string;
  quantity: number;
  condition?: string;
  deliveryDays?: number | string;
  totalRubMinor?: number;
  totalRubFormatted: string;
};

type CustomerOffer = {
  version: number;
  comment?: string;
  totalRubFormatted: string;
  totalRubMinor?: number;
  sharedLogisticsRubMinor?: number;
  lines: OfferLine[];
};

type RequestDetail = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  customerComment?: string | null;
  vehicle: {
    make?: string | null;
    model?: string | null;
    year?: string | null;
    vin?: string | null;
  };
  items: RequestItem[];
  customerOffer: CustomerOffer | null;
  customerOfferStatus?: string | null;
  customerResponseStatus?: string | null;
  linkedOrder?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  timeline: Array<{
    id: string;
    action: string;
    text: string;
    at: string;
  }>;
};

const STATUS_MAP: Record<string, { label: string; badgeClass: string }> = {
  NEW: { label: "Новая заявка", badgeClass: "border-[#ff6428] text-[#ff865c] bg-[#ff6428]/10" },
  ASSIGNED: { label: "В работе", badgeClass: "border-[#888b8d] text-[#f1f0eb] bg-[#888b8d]/10" },
  SEARCHING: { label: "Подбор на складах", badgeClass: "border-sky-600 text-sky-400 bg-sky-950/20" },
  WAITING_SUPPLIERS: { label: "Запросы поставщикам", badgeClass: "border-amber-600 text-amber-400 bg-amber-950/20" },
  OFFERS_READY: { label: "Предложение готово", badgeClass: "border-[#ff6428] text-[#ff6428] bg-[#ff6428]/25" },
  SENT_TO_CUSTOMER: { label: "Ожидает согласования", badgeClass: "border-emerald-600 text-emerald-400 bg-emerald-950/20" },
  CONFIRMED: { label: "Подтверждена", badgeClass: "border-emerald-500 text-emerald-300 bg-emerald-950/30" },
  COMPLETED: { label: "Завершена", badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]" },
  CANCELLED: { label: "Отменена", badgeClass: "border-red-900 text-red-400 bg-red-950/20" },
};

export default function CustomerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function loadRequest() {
    try {
      const res = await fetch(`/api/customer/requests/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRequest(data.request || data);
      } else {
        setErrorMsg("Заявка не найдена или доступ ограничен");
      }
    } catch {
      setErrorMsg("Ошибка сети при загрузке данных заявки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequest();
  }, [id]);

  async function handleResponse(decision: "ACCEPTED" | "REJECTED", comment?: string) {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/customer/requests/${id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: decision, comment }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить ответ");
      }

      setShowRejectModal(false);
      // Reload full request data to see created order and confirmed status
      await loadRequest();

      if (decision === "ACCEPTED" && data.orderId) {
        router.push(`/account/orders/${data.orderId}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ошибка обработки решения");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center border border-[#383e41] bg-[#1e2124]">
        <BrandLoader phase="loading" label="Загрузка деталей заявки..." />
      </div>
    );
  }

  if (errorMsg && !request) {
    return (
      <div className="border border-red-900/50 bg-[#1e2124] p-8 text-center">
        <p className="text-sm font-bold text-red-400">{errorMsg}</p>
        <Link
          href="/account/requests"
          className="mt-4 inline-block border border-[#414749] px-4 py-2 text-xs font-bold uppercase text-[#f1f0eb] hover:border-[#ff6428]"
        >
          ← Вернуться к списку заявок
        </Link>
      </div>
    );
  }

  if (!request) return null;

  const statusConfig = STATUS_MAP[request.status] || {
    label: request.status,
    badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]",
  };

  const offer = request.customerOffer;
  const isOfferPending =
    offer &&
    (request.customerResponseStatus === "SENT" ||
      !request.customerResponseStatus ||
      request.customerResponseStatus === "PENDING" ||
      request.customerResponseStatus === "VIEWED");
  const isAccepted = request.customerResponseStatus === "ACCEPTED";
  const isRejected = request.customerResponseStatus === "REJECTED";

  return (
    <div className="space-y-6">
      {/* Top Bar with back link */}
      <div className="flex flex-col gap-4 border border-[#383e41] bg-[#1e2124] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/account/requests"
            className="text-[11px] font-bold uppercase tracking-wider text-[#ff6428] hover:text-[#f1f0eb]"
          >
            ← Ко всем заявкам
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black font-mono uppercase text-[#f1f0eb]">
              {request.number}
            </h1>
            <span
              className={`inline-block border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${statusConfig.badgeClass}`}
            >
              {statusConfig.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#888b8d]">
            Создана {new Date(request.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {request.linkedOrder && (
          <Link
            href={`/account/orders/${request.linkedOrder.id}`}
            className="inline-flex min-h-11 items-center justify-center border border-emerald-600 bg-emerald-950/30 px-5 text-xs font-black uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-900/40"
          >
            Заказ {request.linkedOrder.orderNumber} →
          </Link>
        )}
      </div>

      {errorMsg && (
        <div className="border border-red-900/60 bg-red-950/20 p-4 text-xs font-bold text-red-300">
          {errorMsg}
        </div>
      )}

      {/* COMMERCIAL OFFER HERO SECTION (IF AVAILABLE) */}
      {offer && (
        <div className={`border p-6 ${isAccepted ? "border-emerald-600/60 bg-[#16201b]" : isRejected ? "border-red-900/40 bg-[#1f1818]" : "border-[#ff6428] bg-[#221c1a]"}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-[#383e41] pb-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
                Коммерческое предложение
              </p>
              <h2 className="mt-1 text-xl font-black uppercase text-[#f1f0eb]">
                Предложение по заявке {request.number} (Версия {offer.version})
              </h2>
              {offer.comment && (
                <p className="mt-2 text-xs italic text-[#f1f0eb] bg-[#17191b] p-3 border border-[#383e41]">
                  «{offer.comment}»
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                Итого к оплате
              </span>
              <p className="text-2xl font-black tabular-nums text-[#ff6428]">
                {offer.totalRubFormatted}
              </p>
            </div>
          </div>

          {/* Offer items table */}
          <div className="mt-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#888b8d]">
              Состав предложения:
            </h3>
            <div className="divide-y divide-[#383e41] border border-[#383e41] bg-[#17191b]">
              {offer.lines.map((line, idx) => (
                <div
                  key={line.itemId || idx}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-[#f1f0eb]">{line.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#888b8d]">
                      {line.condition && <span>Состояние: <b className="text-[#f1f0eb]">{line.condition}</b></span>}
                      {line.deliveryDays && <span>· Срок поставки: <b className="text-[#f1f0eb]">{line.deliveryDays} дн.</b></span>}
                      <span>· Количество: <b className="text-[#f1f0eb]">{line.quantity} шт.</b></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-black text-[#ff6428]">
                      {line.totalRubFormatted}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offer Decisions & Status */}
          <div className="mt-6 border-t border-[#383e41] pt-4">
            {isAccepted ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="text-lg">✓</span>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Предложение принято вами. Заказ сформирован и передан в обработку.
                  </span>
                </div>
                {request.linkedOrder && (
                  <Link
                    href={`/account/orders/${request.linkedOrder.id}`}
                    className="inline-flex min-h-10 items-center justify-center bg-emerald-600 px-5 text-xs font-black uppercase tracking-wider text-[#17191b] hover:bg-emerald-500"
                  >
                    Перейти к заказу →
                  </Link>
                )}
              </div>
            ) : isRejected ? (
              <div className="text-red-400 text-xs font-bold uppercase tracking-wider">
                Предложение было отклонено. Вы можете связаться с менеджером для составления новой спецификации.
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#888b8d]">
                  Пожалуйста, проверьте наименования, количество и стоимость. Нажмите «Принять предложение», чтобы подтвердить заказ.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    id="reject-offer-btn"
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting}
                    className="min-h-11 border border-[#414749] px-4 text-xs font-bold uppercase tracking-wider text-[#888b8d] transition hover:border-red-500 hover:text-red-400 disabled:opacity-50"
                  >
                    Отклонить
                  </button>
                  <button
                    id="accept-offer-btn"
                    type="button"
                    onClick={() => handleResponse("ACCEPTED")}
                    disabled={submitting}
                    className="min-h-11 bg-[#ff6428] px-6 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45] disabled:opacity-50"
                  >
                    {submitting ? "Оформление заказа..." : "Принять предложение →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-[#414749] bg-[#1e2124] p-6">
            <h3 className="text-base font-bold text-[#f1f0eb]">Отклонить предложение?</h3>
            <p className="mt-2 text-xs text-[#888b8d]">
              Укажите причину (высокая цена, долгий срок, деталь уже не нужна), чтобы менеджер мог скорректировать подбор.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина отклонения..."
              className="mt-4 w-full border border-[#383e41] bg-[#17191b] p-3 text-xs text-[#f1f0eb] focus:border-[#ff6428] focus:outline-none"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="border border-[#414749] px-4 py-2 text-xs font-bold uppercase text-[#888b8d] hover:text-[#f1f0eb]"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => handleResponse("REJECTED", rejectReason)}
                disabled={submitting}
                className="bg-red-600 px-4 py-2 text-xs font-bold uppercase text-[#17191b] hover:bg-red-500 disabled:opacity-50"
              >
                Подтвердить отклонение
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle and Request metadata */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
            Данные автомобиля
          </p>
          <div className="mt-3 space-y-2 text-xs text-[#f1f0eb]">
            <p>
              Марка и модель:{" "}
              <b className="font-bold">
                {request.vehicle.make || "—"} {request.vehicle.model || ""}
              </b>
            </p>
            <p>
              Год выпуска: <b className="font-bold">{request.vehicle.year || "—"}</b>
            </p>
            <p>
              VIN-номер:{" "}
              <span className="font-mono text-[#ff865c]">
                {request.vehicle.vin || "не указан"}
              </span>
            </p>
          </div>
        </div>

        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
            Ваш комментарий
          </p>
          <p className="mt-3 text-xs text-[#aeb5b6]">
            {request.customerComment || "Комментарий не был указан при создании заявки."}
          </p>
        </div>
      </div>

      {/* Requested Items List */}
      <div className="border border-[#383e41] bg-[#1e2124] p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
          Запрошенные позиции ({request.items.length})
        </p>
        <div className="mt-4 divide-y divide-[#383e41] border border-[#383e41] bg-[#17191b]">
          {request.items.map((item, idx) => (
            <div key={item.id || idx} className="p-4 text-xs">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-[#f1f0eb]">{item.description}</p>
                  {item.requestedPartNumber && (
                    <p className="mt-1 font-mono text-[11px] text-[#ff6428]">
                      OEM: {item.requestedPartNumber}
                    </p>
                  )}
                  {item.compatibilityNotes && (
                    <p className="mt-1 text-[11px] text-[#888b8d]">
                      Примечание: {item.compatibilityNotes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-right">
                  <span className="border border-[#383e41] px-2 py-1 text-[11px] text-[#888b8d]">
                    {item.conditionPreference || "Любое состояние"}
                  </span>
                  <span className="font-mono font-bold text-[#f1f0eb]">
                    {item.quantity} шт.
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline of events */}
      {request.timeline && request.timeline.length > 0 && (
        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#888b8d]">
            История движения заявки
          </p>
          <div className="mt-4 space-y-3">
            {request.timeline.map((evt) => (
              <div key={evt.id} className="flex items-baseline gap-3 text-xs">
                <span className="font-mono text-[10px] text-[#888b8d]">
                  {new Date(evt.at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6428]" />
                <span className="text-[#f1f0eb]">{evt.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
