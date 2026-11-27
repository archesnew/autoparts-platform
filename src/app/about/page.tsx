import { LegalPageLayout } from "@/components/layout/legal-page-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "О компании — ZAPTUT.PRO",
  description: "О платформе агрегации автозапчастей ZAPTUT.PRO. Поставки из России, Беларуси и Польши.",
};

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="О платформе ZAPTUT.PRO"
      subtitle="Единая цифровая экосистема поиска, подбора и поставки автокомпонентов"
      isDraftDocument={false}
    >
      <section className="space-y-4">
        <h2 className="text-base font-bold uppercase text-[#f1f0eb]">1. Кто мы</h2>
        <p>
          <strong>ZAPTUT.PRO</strong> — агрегатор и логистический оператор автозапчастей, объединяющий прямые склады производителей, оптовых дистрибьюторов и европейские разборки в едином защищённом интерфейсе.
        </p>
        <p>
          Наша миссия — предоставить владельцам автомобилей и автосервисам прозрачный доступ к миллионам оригинальных деталей, качественных аналогов и редких контрактных агрегатов с гарантией совместимости.
        </p>

        <h2 className="mt-8 text-base font-bold uppercase text-[#f1f0eb]">2. География поставок</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Россия:</strong> партнёрские федеральные склады, контрактные узлы, оперативная экспресс-доставка.</li>
          <li><strong>Беларусь:</strong> доступ к складам и разборкам Минска и приграничных хабов.</li>
          <li><strong>Польша / Allegro B2B:</strong> прямая интеграция с крупнейшими европейскими площадками контрактных запчастей с таможенной очисткой и логистикой под ключ.</li>
        </ul>

        <h2 className="mt-8 text-base font-bold uppercase text-[#f1f0eb]">3. Принципы ценообразования</h2>
        <p>
          Платформа работает по прозрачным фиксированным правилам. В розничную цену уже заложены проверка совместимости, сопровождение персонального менеджера и юридическая ответственность за поставку.
        </p>

        <h2 id="vehicle-data" className="mt-8 text-base font-bold uppercase text-[#f1f0eb]">4. Источники автомобильного справочника и лицензии</h2>
        <p>
          Справочник марок, моделей, кузовов и годов в ZAPTUT.PRO объединяет собственные структурированные данные рынка РФ/РБ/Польши с открытыми международными автомобильными базами:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-[#dcded8]">
          <li>
            <strong>Vehicle data by{" "}
            <a href="https://vehiclesdb.com" target="_blank" rel="noopener noreferrer" className="text-[#ff6428] underline hover:text-[#f1f0eb]">
              VehiclesDB
            </a></strong>{" "}
            — лицензия{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#f1f0eb]">
              CC BY 4.0
            </a>
            . Объединяет данные официальных государственных транспортных реестров (UK DfT/DVLA Open Government Licence v3.0, DE KBA DL-DE/BY-2.0, NL RDW CC0, FI Traficom CC BY 4.0, NZTA CC BY 4.0, CA NRCan OGL-Canada, US EPA и др.).
          </li>
          <li>
            <strong><a href="https://github.com/MeterApp/vehicle-db" target="_blank" rel="noopener noreferrer" className="text-[#ff6428] underline hover:text-[#f1f0eb]">
              MeterApp Vehicle DB
            </a></strong>{" "}
            — код по лицензии ISC; данные по модельным, производственным и регистрационным годам из открытых государственных реестров (NHTSA vPIC Public Domain, EEA CO2 Monitoring CC BY 4.0, Malaysia JPJ CC BY 4.0, Brazil SENATRAN Public Domain, FuelEconomy.gov) и официальных каталогов производителей.
          </li>
        </ul>
      </section>
    </LegalPageLayout>
  );
}
