"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { IconBell } from "@/components/ui/icons";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  REQUEST_CREATED: "Заявка",
  NEW_REQUEST: "Заявка",
  OFFER_READY: "Предложение",
  ORDER_CREATED: "Заказ",
  PAYMENT_INSTRUCTIONS: "Оплата",
  PAYMENT_SUBMITTED: "Оплата",
  PAYMENT_CONFIRMED: "Оплата",
  SHIPMENT_DISPATCHED: "Доставка",
  MESSAGE_RECEIVED: "Сообщение",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);
  const [busy, setBusy] = useState(false);

  function loadNotifications(unreadOnly = false) {
    setLoading(true);
    fetch(`/api/customer/notifications${unreadOnly ? "?unread=true" : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setItems(data.items || []);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadNotifications(filterUnread);
  }, [filterUnread]);

  async function markAsRead(id: string) {
    try {
      const res = await fetch("/api/customer/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function markAllAsRead() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/customer/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) => ({ ...item, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#383e41] pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ff6428]">
            ЛИЧНЫЙ КАБИНЕТ · УВЕДОМЛЕНИЯ
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-black uppercase tracking-tight text-[#f1f0eb]">
              Центр уведомлений
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#ff6428] px-2.5 py-0.5 text-xs font-bold text-[#17191b]">
                {unreadCount} новых
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={busy}
              className="border border-[#414749] bg-[#1e2124] px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#cbd0d1] transition hover:border-[#ff6428] hover:text-[#f1f0eb] disabled:opacity-50"
            >
              ✓ Прочитать все
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#383e41] pb-2">
        <button
          onClick={() => setFilterUnread(false)}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
            !filterUnread
              ? "border-b-2 border-[#ff6428] text-[#f1f0eb]"
              : "text-[#888b8d] hover:text-[#f1f0eb]"
          }`}
        >
          Все ({items.length})
        </button>
        <button
          onClick={() => setFilterUnread(true)}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
            filterUnread
              ? "border-b-2 border-[#ff6428] text-[#f1f0eb]"
              : "text-[#888b8d] hover:text-[#f1f0eb]"
          }`}
        >
          Непрочитанные ({unreadCount})
        </button>
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[#888b8d]">Загрузка уведомлений...</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#414749] bg-[#1e2124] p-10 text-center">
          <p className="text-base font-bold text-[#f1f0eb]">
            {filterUnread ? "Все уведомления прочитаны" : "У вас пока нет уведомлений"}
          </p>
          <p className="mt-2 text-xs text-[#888b8d]">
            Здесь будут появляться обновления по вашим заявкам, готовые расчеты предложений, статусы оплаты и трек-номера доставки.
          </p>
          <div className="mt-5">
            <Link
              href="/catalog"
              className="inline-block bg-[#ff6428] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
            >
              Перейти в каталог →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const isUnread = !n.readAt;
            const categoryLabel = TYPE_LABELS[n.type] || "Уведомление";
            const dateStr = new Date(n.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={n.id}
                className={`flex flex-col justify-between gap-4 border p-4 transition sm:flex-row sm:items-center ${
                  isUnread
                    ? "border-[#ff6428]/60 bg-[#222629]"
                    : "border-[#383e41] bg-[#1e2124] opacity-85"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-[#383e41] bg-[#17191b] text-[#ff6428]">
                    <IconBell className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-[#414749] bg-[#17191b] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
                        {categoryLabel}
                      </span>
                      <h2 className="text-sm font-bold text-[#f1f0eb]">{n.title}</h2>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-[#ff6428]" title="Новое" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#cbd0d1]">{n.message}</p>
                    <span className="mt-2 inline-block text-[11px] text-[#888b8d]">{dateStr}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => isUnread && markAsRead(n.id)}
                      className="border border-[#414749] bg-[#17191b] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#ff865c] hover:border-[#ff6428] hover:bg-[#ff6428] hover:text-[#17191b] transition"
                    >
                      Открыть →
                    </Link>
                  )}
                  {isUnread && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="px-2 py-1.5 text-xs text-[#888b8d] hover:text-[#f1f0eb]"
                      title="Отметить как прочитанное"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
