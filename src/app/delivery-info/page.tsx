import { LegalPageLayout } from "@/components/layout/legal-page-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Доставка и получение — ZAPTUT.PRO",
  description: "География, сроки, стоимость и порядок отслеживания доставки автозапчастей.",
};

export default function DeliveryInfoPage() {
  return (
    <LegalPageLayout
      title="Доставка и получение заказов"
      subtitle="Условия транспортировки, партнерские службы доставки и трекинг"
    >
      <section className="space-y-4">
        <h2 className="text-base font-bold uppercase text-[#f1f0eb]">1. Службы доставки</h2>
        <p>
          Мы сотрудничаем с ведущими федеральными и международными операторами логистики:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>СДЭК:</strong> экспресс-доставка до пунктов выдачи (ПВЗ) и курьером по всей России.</li>
          <li><strong>Деловые Линии и ПЭК:</strong> транспортировка крупногабаритных и тяжелых грузов (двигатели в сборе, АКПП, кузовные элементы, редукторы).</li>
          <li><strong>Самовывоз:</strong> получение в партнерском распределительном пункте выдачи.</li>
        </ul>

        <h2 className="mt-8 text-base font-bold uppercase text-[#f1f0eb]">2. Сроки доставки</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Склады РФ (в наличии):</strong> от 1 до 4 рабочих дней в зависимости от региона получателя.</li>
          <li><strong>Склады Беларуси:</strong> 3–6 рабочих дней.</li>
          <li><strong>Европейские склады / Allegro:</strong> 7–14 рабочих дней (включая доставку до консолидационного хаба и прохождение границы).</li>
        </ul>

        <h2 className="mt-8 text-base font-bold uppercase text-[#f1f0eb]">3. Отслеживание отправления</h2>
        <p>
          После передачи упакованной детали перевозчику в личном кабинете покупателя отображается трек-номер и прямая ссылка на официальный сервис отслеживания службы доставки. Уведомление о присвоении трек-номера также фиксируется в центре уведомлений.
        </p>
      </section>
    </LegalPageLayout>
  );
}
