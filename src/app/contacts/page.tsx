import { LegalPageLayout } from "@/components/layout/legal-page-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Контакты — ZAPTUT.PRO",
  description: "Контактная информация, клиентская поддержка и реквизиты ZAPTUT.PRO.",
};

export default function ContactsPage() {
  return (
    <LegalPageLayout
      title="Контактная информация"
      subtitle="Связь с клиентской поддержкой, отделом логистики и партнёрской программой"
      isDraftDocument={false}
    >
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border border-[#383e41] bg-[#1e2124] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#ff6428]">Клиентская поддержка</h2>
            <p className="mt-2 text-sm font-bold text-[#f1f0eb]">Консультации по подбору и заказам</p>
            <p className="mt-2 text-xs text-[#cbd0d1]">Ежедневно: 09:00 — 21:00 (МСК)</p>
            <p className="mt-3 text-xs text-[#888b8d]">
              Email: <a href="mailto:support@zaptut.pro" className="text-[#ff865c] hover:underline">support@zaptut.pro</a>
            </p>
          </div>

          <div className="border border-[#383e41] bg-[#1e2124] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#ff6428]">Отдел поставок и B2B</h2>
            <p className="mt-2 text-sm font-bold text-[#f1f0eb]">Подключение складов и интеграция фидов</p>
            <p className="mt-2 text-xs text-[#cbd0d1]">Пн — Пт: 10:00 — 19:00 (МСК)</p>
            <p className="mt-3 text-xs text-[#888b8d]">
              Email: <a href="mailto:partners@zaptut.pro" className="text-[#ff865c] hover:underline">partners@zaptut.pro</a>
            </p>
          </div>
        </div>

        <div className="border border-[#383e41] bg-[#1e2124] p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#f1f0eb]">Официальные реквизиты и запросы субъектов персональных данных</h2>
          <div className="mt-4 space-y-2 text-xs text-[#aeb5b6]">
            <p><strong>Оператор платформы:</strong> ООО «ЗАПТУТ ПРО» (Администрация сервиса ZAPTUT.PRO)</p>
            <p><strong>Запросы по персональным данным (152-ФЗ):</strong> <a href="mailto:privacy@zaptut.pro" className="text-[#ff865c] hover:underline">privacy@zaptut.pro</a></p>
            <p><strong>Клиентская служба и претензии:</strong> <a href="mailto:support@zaptut.pro" className="text-[#ff865c] hover:underline">support@zaptut.pro</a></p>
            <p><strong>Центральный пункт выдачи и склад:</strong> г. Москва / Московская область (точный адрес уточняется при согласовании самовывоза)</p>
            <p><strong>Почтовый адрес для официальной корреспонденции:</strong> направляется по предварительному согласованию на адрес <code>privacy@zaptut.pro</code></p>
          </div>
        </div>
      </section>
    </LegalPageLayout>
  );
}
