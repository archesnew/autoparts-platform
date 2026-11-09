"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLoader } from "@/components/brand/brand-loader";

type CustomerRequest = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | null;
  vehicleVin?: string | null;
  itemsCount: number;
  itemsSummary: string;
  hasOffer: boolean;
  offerVersion?: number | null;
  offerTotalRub?: string | null;
  customerOfferStatus?: string | null;
  customerResponseStatus?: string | null;
};

const STATUS_MAP: Record<string, { label: string; badgeClass: string }> = {
  NEW: { label: "Новая", badgeClass: "border-[#ff6428] text-[#ff865c] bg-[#ff6428]/10" },
  ASSIGNED: { label: "В работе", badgeClass: "border-[#888b8d] text-[#f1f0eb] bg-[#888b8d]/10" },
  SEARCHING: { label: "Подбор на складах", badgeClass: "border-sky-600 text-sky-400 bg-sky-950/20" },
  WAITING_SUPPLIERS: { label: "Запросы складам", badgeClass: "border-amber-600 text-amber-400 bg-amber-950/20" },
  OFFERS_READY: { label: "Предложение готово", badgeClass: "border-[#ff6428] text-[#ff6428] bg-[#ff6428]/25" },
  SENT_TO_CUSTOMER: { label: "Ждёт подтверждения", badgeClass: "border-emerald-600 text-emerald-400 bg-emerald-950/20" },
  CONFIRMED: { label: "Подтверждена", badgeClass: "border-emerald-500 text-emerald-300 bg-emerald-950/30" },
  COMPLETED: { label: "Завершена", badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]" },
  CANCELLED: { label: "Отменена", badgeClass: "border-red-900 text-red-400 bg-red-950/20" },
};

export default function CustomerRequestsPage() {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
    try {
      const res = await fetch("/api/customer/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-[#383e41] bg-[#1e2124]">
        <BrandLoader phase="loading" label="Загрузка заявок..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border border-[#383e41] bg-[#1e2124] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff6428]">
            Личный кабинет · Заявки
          </p>
          <h1 className="mt-1 text-xl font-black uppercase text-[#f1f0eb]">
            Мои заявки на запчасти ({requests.length})
          </h1>
          <p className="mt-1 text-xs text-[#888b8d]">
            История ваших запросов на подбор деталей, коммерческие предложения и расчёт стоимости.
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex min-h-11 items-center justify-center bg-[#ff6428] px-5 text-xs font-black uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff7a45]"
        >
          + Выбрать в каталоге
        </Link>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="border border-dashed border-[#414749] bg-[#1e2124] p-10 text-center">
          <p className="text-sm font-bold text-[#f1f0eb]">У вас пока нет созданных заявок</p>
          <p className="mt-2 text-xs text-[#888b8d]">
            Добавьте нужные детали из каталога или отправьте артикулы на оценку нашим специалистам.
          </p>
          <Link
            href="/catalog"
            className="mt-5 inline-block border border-[#ff6428] bg-transparent px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#ff6428] transition hover:bg-[#ff6428] hover:text-[#17191b]"
          >
            Перейти в каталог →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const statusConfig = STATUS_MAP[req.status] || {
              label: req.status,
              badgeClass: "border-[#4b5255] text-[#888b8d] bg-[#202325]",
            };
            const hasReadyOffer = Boolean(req.hasOffer || req.offerTotalRub);

            return (
              <div
                key={req.id}
                className={`border p-5 transition ${
                  hasReadyOffer && req.customerResponseStatus !== "ACCEPTED"
                    ? "border-[#ff6428]/60 bg-[#221c1a]"
                    : "border-[#383e41] bg-[#1e2124] hover:border-[#4b5255]"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-[#f1f0eb]">
                        {req.number}
                      </span>
                      <span
                        className={`inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusConfig.badgeClass}`}
                      >
                        {statusConfig.label}
                      </span>
                      {hasReadyOffer && req.customerResponseStatus !== "ACCEPTED" && (
                        <span className="inline-block border border-emerald-500 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Предложение сформировано
                        </span>
                      )}
                      {req.customerResponseStatus === "ACCEPTED" && (
                        <span className="inline-block border border-emerald-600 bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Предложение принято
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-[#888b8d]">
                      От {new Date(req.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>

                    {(req.vehicleMake || req.vehicleModel) && (
                      <p className="mt-2 text-xs font-semibold text-[#f1f0eb]">
                        Автомобиль: {req.vehicleMake} {req.vehicleModel} {req.vehicleYear ? `(${req.vehicleYear})` : ""}
                        {req.vehicleVin ? <span className="ml-2 font-mono text-[11px] text-[#ff865c]">VIN: {req.vehicleVin}</span> : null}
                      </p>
                    )}

                    <div className="mt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#888b8d]">
                        Запрошенные детали ({req.itemsCount} поз.):
                      </p>
                      <p className="mt-0.5 text-xs text-[#f1f0eb] line-clamp-2">
                        {req.itemsSummary || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                    {req.offerTotalRub && (
                      <div className="sm:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#888b8d]">
                          Сумма предложения:
                        </span>
                        <p className="text-lg font-black tabular-nums text-[#ff6428]">
                          {req.offerTotalRub}
                        </p>
                      </div>
                    )}

                    <Link
                      href={`/account/requests/${req.id}`}
                      className={`inline-flex min-h-10 items-center justify-center px-4 text-xs font-bold uppercase tracking-wider transition ${
                        hasReadyOffer && req.customerResponseStatus !== "ACCEPTED"
                          ? "bg-[#ff6428] text-[#17191b] hover:bg-[#ff7a45]"
                          : "border border-[#414749] text-[#f1f0eb] hover:border-[#ff6428] hover:text-[#ff6428]"
                      }`}
                    >
                      {hasReadyOffer ? "Посмотреть предложение →" : "Подробнее →"}
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
