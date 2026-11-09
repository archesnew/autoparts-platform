"use client";

import { useEffect, useState, type FormEvent } from "react";

type Address = {
  id: string;
  recipientName: string;
  phone: string;
  country: string;
  region?: string | null;
  city: string;
  street: string;
  house: string;
  apartment?: string | null;
  postalCode?: string | null;
  isDefault: boolean;
  comment?: string | null;
  createdAt: string;
};

type FormData = {
  recipientName: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
  isDefault: boolean;
  comment: string;
};

const initialFormData: FormData = {
  recipientName: "",
  phone: "",
  country: "Россия",
  region: "",
  city: "",
  street: "",
  house: "",
  apartment: "",
  postalCode: "",
  isDefault: false,
  comment: "",
};

export default function CustomerAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [form, setForm] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function fetchAddresses() {
    try {
      const res = await fetch("/api/customer/addresses");
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAddresses();
  }, []);

  function openCreateModal() {
    setEditingAddress(null);
    setForm(initialFormData);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(a: Address) {
    setEditingAddress(a);
    setForm({
      recipientName: a.recipientName,
      phone: a.phone,
      country: a.country || "Россия",
      region: a.region || "",
      city: a.city,
      street: a.street,
      house: a.house,
      apartment: a.apartment || "",
      postalCode: a.postalCode || "",
      isDefault: a.isDefault,
      comment: a.comment || "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.recipientName.trim() || !form.phone.trim() || !form.city.trim() || !form.street.trim() || !form.house.trim()) {
      setError("Пожалуйста, заполните обязательные поля: ФИО, телефон, город, улицу и дом.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        country: form.country.trim() || "Россия",
        region: form.region.trim() || undefined,
        city: form.city.trim(),
        street: form.street.trim(),
        house: form.house.trim(),
        apartment: form.apartment.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        isDefault: form.isDefault,
        comment: form.comment.trim() || undefined,
      };

      const url = editingAddress
        ? `/api/customer/addresses/${editingAddress.id}`
        : "/api/customer/addresses";
      const method = editingAddress ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сохранения адреса");
      }

      setModalOpen(false);
      await fetchAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить адрес");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/customer/addresses/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        setDeleteConfirmId(null);
      }
    } catch {
      // Ignore
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`/api/customer/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        await fetchAddresses();
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
            Адресная книга
          </p>
          <h1 className="mt-1 text-2xl font-black uppercase text-[#f1f0eb]">
            Адреса доставки ({addresses.length})
          </h1>
          <p className="mt-1 text-xs text-[#888b8d]">
            Сохранённые точки получения деталей и контактные данные получателей
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-[#ff6428] px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#17191b] transition hover:bg-[#ff8050]"
        >
          + Добавить адрес
        </button>
      </div>

      {/* Address List */}
      {loading ? (
        <div className="border border-[#383e41] bg-[#1e2124] p-8 text-center text-xs text-[#888b8d]">
          Загрузка адресной книги...
        </div>
      ) : addresses.length === 0 ? (
        <div className="border border-dashed border-[#414749] bg-[#1e2124]/50 p-8 text-center sm:p-12">
          <p className="text-3xl">📍</p>
          <h2 className="mt-3 text-sm font-bold uppercase text-[#f1f0eb]">
            Адреса доставки пока не добавлены
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#888b8d]">
            Добавьте адрес доставки для автоматического заполнения при оформлении заказов
            и расчёта логистики.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 bg-[#ff6428] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#17191b] hover:bg-[#ff8050]"
          >
            Добавить первый адрес
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <div
              key={a.id}
              className={`relative border p-5 transition ${
                a.isDefault
                  ? "border-[#ff6428] bg-[#222528]"
                  : "border-[#383e41] bg-[#1e2124] hover:border-[#4b5255]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-[#f1f0eb]">
                    {a.recipientName}
                  </h3>
                  <p className="text-xs text-[#ff986f] mt-0.5">{a.phone}</p>
                </div>
                {a.isDefault ? (
                  <span className="border border-[#ff6428] bg-[#ff6428]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ff865c]">
                    По умолчанию
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(a.id)}
                    className="border border-[#414749] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#888b8d] hover:border-[#ff6428] hover:text-[#ff6428]"
                  >
                    Сделать основным
                  </button>
                )}
              </div>

              {/* Address details */}
              <div className="mt-4 border-t border-[#343a3d] pt-3 text-xs text-[#c5cbcc] space-y-1">
                <p>
                  <span className="text-[#888b8d]">Страна / Регион:</span>{" "}
                  {a.country}{a.region ? `, ${a.region}` : ""}
                </p>
                <p>
                  <span className="text-[#888b8d]">Адрес:</span> г. {a.city}, ул. {a.street}, д. {a.house}
                  {a.apartment ? `, кв./оф. ${a.apartment}` : ""}
                </p>
                {a.postalCode && (
                  <p>
                    <span className="text-[#888b8d]">Индекс:</span> {a.postalCode}
                  </p>
                )}
                {a.comment && (
                  <p className="italic text-[#888b8d] pt-1">
                    «{a.comment}»
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#343a3d] pt-3">
                {deleteConfirmId === a.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-400">Удалить?</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase text-white hover:bg-red-700"
                    >
                      Да
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="border border-[#51595c] px-2 py-1 text-[10px] font-bold uppercase text-[#c3c8ca]"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(a)}
                      className="border border-[#414749] px-3 py-1 text-xs font-bold uppercase text-[#aeb5b6] hover:border-[#ff6428] hover:text-[#f1f0eb]"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(a.id)}
                      className="border border-transparent px-2 py-1 text-xs font-bold uppercase text-red-400 hover:text-red-300"
                    >
                      Удалить
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 overflow-y-auto"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="my-auto w-full max-w-lg border border-[#4b5255] bg-[#1e2124] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#383e41] pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff6428]">
                  {editingAddress ? "Редактирование адреса" : "Новый адрес"}
                </p>
                <h2 className="mt-1 text-lg font-black uppercase text-[#f1f0eb]">
                  {editingAddress ? "Изменить адрес доставки" : "Добавить в адресную книгу"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-lg font-bold text-[#888b8d] hover:text-[#f1f0eb]"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mt-4 border border-red-900/50 bg-red-950/20 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  ФИО получателя *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Иван Петров"
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Телефон получателя *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+7 999 000-00-00"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Страна *
                </label>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                >
                  <option value="Россия">Россия</option>
                  <option value="Беларусь">Беларусь</option>
                  <option value="Казахстан">Казахстан</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Регион / Область
                </label>
                <input
                  type="text"
                  placeholder="Московская обл., Татарстан..."
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Город / Населённый пункт *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Москва, Казань, Минск..."
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Улица *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ленина, Мира, Тверская..."
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Дом / Корпус *
                </label>
                <input
                  type="text"
                  required
                  placeholder="12, 10к2, 4Б..."
                  value={form.house}
                  onChange={(e) => setForm({ ...form, house: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Квартира / Офис
                </label>
                <input
                  type="text"
                  placeholder="45, оф. 3"
                  value={form.apartment}
                  onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Почтовый индекс
                </label>
                <input
                  type="text"
                  placeholder="101000"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#aeb5b6]">
                  Комментарий курьеру
                </label>
                <input
                  type="text"
                  placeholder="Домофон 45, этаж 3..."
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  className="mt-1 w-full border border-[#414749] bg-[#17191b] px-3 py-2 text-sm text-[#f1f0eb] outline-none focus:border-[#ff6428]"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 text-xs text-[#c5cbcc] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#ff6428]"
                  />
                  <span>Сделать адресом доставки по умолчанию</span>
                </label>
              </div>

              <div className="sm:col-span-2 mt-4 flex items-center justify-end gap-3 border-t border-[#383e41] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="border border-[#51595c] px-4 py-2 text-xs font-bold uppercase text-[#c3c8ca]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#ff6428] px-5 py-2 text-xs font-extrabold uppercase text-[#17191b] hover:bg-[#ff8050] disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : editingAddress ? "Сохранить изменения" : "Добавить адрес"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
