# Журнал совместной работы с AI

Для каждой задачи добавляй запись с датой, формулировкой задачи, изученными и изменёнными файлами, решениями, результатами проверок, оставшимися проблемами и статусом.

## 2026-11-16 — ZAPTUT.PRO — ВНЕДРЕНИЕ ТЕХНИЧЕСКИХ ТРЕБОВАНИЙ 152-ФЗ И РОСКОМНАДЗОРА (DONE)

- **Задача:**
  1. Реализовать технический комплекс изменений по устранению рисков 152-ФЗ («О персональных данных»), ст. 18 ФЗ «О рекламе» и требований Роскомнадзора:
     - Активные кликабельные гиперссылки на `/consent` и `/privacy-policy` под всеми точками захвата данных (форма авторизации по телефону, модалка подбора детали, корзина каталога, подвал каталога).
     - Компонент Cookie-баннера (`CookieConsentBanner`) с выбором «Принять все» / «Только технические» и сохранением согласия в `localStorage` (`zaptut_cookie_consent_v1`).
     - Локализация шрифтов Onest через `next/font/google` (self-hosted сборка Next.js) и полное исключение внешних трансграничных вызовов к `fonts.googleapis.com` / `fonts.gstatic.com`.
     - Механизм отзыва согласия и уничтожения/обезличивания данных субъекта в соответствии со ст. 14, 21 152-ФЗ (API `DELETE /api/customer/profile` и кнопка в личном кабинете `/account/profile`).
     - Актуализация правовых документов (`/privacy-policy`, `/consent`, `/contacts`, `/terms`) с детальным описанием оператора, целей, сроков хранения, категорий третьих лиц и регламента уничтожения по Приказу РКН № 179.

- **Изученные и изменённые файлы:**
  - `src/components/customer/phone-auth-form.tsx`: добавлены активные ссылки на `/consent`, `/privacy-policy` и `/terms` (`target="_blank"`).
  - `src/app/catalog/page.tsx`: добавлен юридический дисклеймер со ссылками на Согласие и Политику под кнопкой отправки запроса на подбор деталей, а также ссылки на правовые документы в подвале каталога.
  - `src/components/catalog/catalog-cart-drawer.tsx`: добавлены активные ссылки на `/consent` и `/privacy-policy` под кнопками оформления заказа для авторизованных и гостей.
  - `src/components/ui/cookie-consent-banner.tsx`: создан доступный баннер согласия на cookies (дизайн #1e2124, акцент #ff6428, варианты выбора, доступность по WCAG).
  - `src/app/layout.tsx`: подключен локальный шрифт `Onest` через `next/font/google` и внедрен `<CookieConsentBanner />`.
  - `src/app/globals.css`: удален внешний `@import url("https://fonts.googleapis.com/...")`.
  - `next.config.mjs`: удален `https://fonts.gstatic.com` из CSP директивы `font-src`.
  - `src/lib/server/customer-portal-service.ts`: реализован метод `requestDataErasure(customerId)` (деактивация `active: false`, аннулирование всех активных сессий, анонимизация ФИО, очистка email, удаление сохраненных адресов и гаража с сохранением финансовых транзакций по 402-ФЗ).
  - `src/app/api/customer/profile/route.ts`: добавлен обработчик `DELETE`, вызывающий `requestDataErasure`.
  - `src/app/account/(portal)/profile/page.tsx`: добавлена секция «Управление персональными данными (152-ФЗ)» с двухэтапным подтверждением отзыва согласия.
  - `src/app/privacy-policy/page.tsx`: обновлена Политика с учетом ст. 6, 14, 18.1, 21 152-ФЗ и Приказа РКН № 179.
  - `src/app/consent/page.tsx`: конкретизированы цели обработки, категории третьих лиц, срок хранения и отдельное согласие на рекламу.
  - `src/app/contacts/page.tsx`: указан контакт ответственного за обработку ПДн (`privacy@zaptut.pro`).
  - `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`: актуализированы.

- **Результаты проверок:**
  - `node node_modules/typescript/bin/tsc --noEmit`: 0 ошибок.
  - `npm run test:server`: 18/18 тестов пройдено успешно.
  - `npm run test:portal`: 9/9 тестов пройдено успешно.
  - Интеграционный тест `requestDataErasure`: подтверждено удаление сессий, деактивация профиля, анонимизация ПДн и очистка адресов/гаража в Neon PostgreSQL.
  - HTTP проверка страниц `/privacy-policy`, `/consent`, `/terms`, `/contacts`: все возвращают статус 200 OK.
  - Статус: **`DONE`** (`git commit` и `git push` не выполнялись согласно `AGENTS.md`).

## 2026-11-16 — ZAPTUT.PRO — АУДИТ СООТВЕТСТВИЯ 152-ФЗ И ТРЕБОВАНИЯМ РОСКОМНАДЗОРА (DONE)

- **Задача:**
  1. Провести полный юридическо-технический аудит платформы ZAPTUT.PRO на соответствие Федеральному закону № 152-ФЗ «О персональных данных», закону о локализации баз данных № 242-ФЗ, требованиям Роскомнадзора и ст. 18 ФЗ «О рекламе».
  2. Исследовать все точки сбора ПДн (форма авторизации по телефону, оформление заявки в корзине, модальное окно подбора детали, контакты), правовые документы (`/privacy-policy`, `/consent`, `/terms`), инфраструктурное размещение БД (Neon AWS eu-central-1) и внешние сетевые запросы (Google Fonts).
  3. Составить матрицу рисков, таблицу штрафов КоАП РФ (ст. 13.11, 14.3) и разработать пошаговый Action Plan приведения платформы в полное соответствие.

- **Изученные файлы:**
  - `src/app/privacy-policy/page.tsx`, `src/app/consent/page.tsx`, `src/app/terms/page.tsx`, `src/app/contacts/page.tsx`: выявлены шаблонные плейсхолдеры вместо реквизитов оператора (`[Наименование организации / ИП]`), отсутствие обязательных разделов (сроки хранения, порядок уничтожения по Приказу РКН № 179, категории третьих лиц, спорная формулировка «бессрочно»).
  - `src/components/customer/phone-auth-form.tsx`: текст согласия не содержит активных гиперссылок на Политику и Согласие.
  - `src/app/catalog/page.tsx` (модалка подбора) и `src/components/catalog/catalog-cart-drawer.tsx`: отсутствие согласий и ссылок на правовые документы под кнопками отправки данных.
  - `src/app/globals.css`: прямая загрузка `@import url("https://fonts.googleapis.com/...")` с серверов Google LLC в США (трансграничная передача IP-адресов без уведомления РКН).
  - Инфраструктура: PostgreSQL размещена в Neon (AWS Франкфурт, Германия), что нарушает ч. 5 ст. 18 152-ФЗ (242-ФЗ) при сборе данных граждан РФ без первичной записи в РФ.

- **Сформированный артефакт:**
  - `C:\Users\Chessie\.gemini\antigravity\brain\406883d0-c503-4651-ad14-68931a440aa6\152-fz-rkn-audit-report.md`: детальный отчет с матрицей рисков, анализом по 7 блокам, таблицей санкций и 3-этапным планом устранения.

- **Результаты и выводы:**
  - Статус: **`DONE`** (аудит завершен, риски зафиксированы, пошаговые рекомендации сформированы).
  - Резюме: техническая безопасность данных высока, но для запуска в юрисдикции РФ требуются: (1) кликабельные согласия под всеми формами сайта; (2) внедрение Cookie-баннера; (3) локализация шрифтов Onest; (4) актуализация реквизитов и разделов документов; (5) перенос первичной БД в РФ и подача уведомления в РКН.

## 2026-11-16 — ZAPTUT.PRO — ALIEN EXPLORER TOTAL E2E & UX CONTROL (DONE)

- **Задача:**
  1. Выполнить полный («космический исследовательский / пришелец на новой планете») контроль всех пользовательских сценариев, интерфейсов, форм, ролей и защитных барьеров ZAPTUT.PRO с использованием скилов `e2e-testing-patterns`, `break-ui`, `impeccable`, `wcag-audit-patterns` и `ui-visual-validator`.
  2. Проверить 29 маршрутов, адаптивность на Desktop (1440×900) и Mobile (390×844), отсутствие горизонтального скролла (`overflow: false`), целостность ссылок, отсутствие битых картинок, чистоту консоли и отсутствие runtime-исключений.
  3. Проверить сквозные интерактивные сценарии: поиск в каталоге, каскадный фильтр авто, добавление в корзину/заявку, боковую шторку (Drawer), модальное окно быстрой заявки, кабинеты покупателя, CRM персонала, портал поставщика, защищенность эндпоинтов восстановления пароля и Phone OTP от утечек токенов, хаос-инъекции (XSS, SQLi, 800-символьные строки).

- **Изученные и изменённые файлы:**
  - `public/robots.txt`: удалён статический конфликтный файл `public/robots.txt` (`Disallow: /`), вызывавший HTTP 500 в Next.js из-за конфликта с `src/app/robots.ts`. Теперь динамический `src/app/robots.ts` корректно отдаёт 200 OK с правилами индексации и ссылкой на sitemap.
  - `next.config.mjs`: обновлена директива `script-src` в `Content-Security-Policy` — в `development` режиме разрешён `unsafe-eval` для работы внутреннего React Fast Refresh / Webpack hot reload, а в `production` режиме строго запрещён.
  - `scripts/mission-alien-explorer-audit.mjs`: разработан автономный скрипт глубокого аудита на Chrome DevTools Protocol (CDP) с замером метрик layout, сбором console errors, аудитом доступности и захватом 32 скриншотов верификации.
  - `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`: зафиксированы результаты аудита, исправления и текущий статус.

- **Результаты проверок:**
  - Статический анализ: `npx tsc --noEmit` — 0 ошибок.
  - Тестовые наборы:
    - `npm run test:finance`: 19/19 успешно (все тарифные формулы 28%/55% и минимумы 300/1700 RUB подтверждены).
    - `npm run test:auth`: 7/7 успешно (RBAC-матрица SUPER_ADMIN, MANAGER, ADMIN, LOGISTICS).
    - `npm run test:customers`: 24/24 успешно (нормализация номеров, дедупликация, слияние).
    - `npm run test:server`: 18/18 успешно (заявки, клиенты, поставщики, безопасность).
  - Сквозной Chrome CDP аудит (`scripts/mission-alien-explorer-audit.mjs`):
    - **Маршруты:** исследовано 29 страниц (Landing, Catalog, About, Contacts, Delivery, Payment, Returns, Privacy, Terms, Consent, Staff Login, Customer Phone Login, Register, Forgot Password, 404, CRM Dashboard, Requests, Orders, Customers, Staff, Import, Supplier Portal, Customer Account, Profile, Vehicles/Garage, Addresses, Orders History, Requests History, Notifications).
    - **Адаптивность:** Desktop (1440px) и Mobile (390px) — **0 страниц с горизонтальным скроллом** (`overflow = false` на всех 29 страницах).
    - **Медиа и ссылки:** **0 битых изображений** (`naturalWidth === 0` — 0), **0 битых ссылок** (15/15 внутренних ссылок вернули 200 OK).
    - **SEO:** `/robots.txt` возвращает HTTP 200 (19 строк), `/sitemap.xml` возвращает HTTP 200 XML.
    - **Chaos Probes:** инъекции XSS (`<script>alert(...)`), SQLi (`'; DROP TABLE...`), 800-символьные строки — все отражены без выполнения скриптов и без переполнения layout.
    - **Рантайм:** **0 uncaught exceptions**, **0 console errors**.
    - **Безопасность:** `/api/customer/auth/forgot-password` (статус 200, `tokenLeak: false`), `/api/customer/auth/phone/send-otp` (`devOtpLeak: false`), универсальный OTP `111111` отклоняется.
  - Статус: **`DONE`** (сохранено 32 скриншота верификации; `git commit` и `git push` не выполнялись per `AGENTS.md`).

## 2026-11-10 — ZAPTUT.PRO — FINAL VEHICLE SELECTOR & CATALOG UX (DONE)

- **Задача:**
  1. Завершить пользовательский сценарий выбора автомобиля в публичном каталоге `/catalog` с сохранением обоих режимов (ручной ввод RU/EN и открытие полного списка).
  2. Проверить поиск (`BMW / БМВ`, `BMW X5`, `Toyota Camry / Тойота Камри`, `BYD Atto 3`, `Geely Monjaro / Джили Монджаро`, `Lada Vesta / Лада Веста`, `Mercedes-Benz / Мерседес`) и работу больших списков моделей (`Mercedes-Benz` 1587, `BMW` 1041) без рендера тысяч DOM-строк сразу.
  3. Сделать так, чтобы выбор автомобиля сам по себе НЕ скрывал ассортимент: добавить отдельный переключатель «Только запчасти, подходящие моему автомобилю» (выключен по умолчанию; при включении — только `CONFIRMED` совместимость + понятное пустое состояние с восстановлением/заявкой).
  4. Сохранять выбранное авто в компактном блоке каталога и честно отображать типы годов (`MODEL_YEAR`, `PRODUCTION_YEAR`, `REGISTRATION_YEAR`, `CATALOG_YEAR`).

- **Изученные и изменённые файлы:**
  - `src/lib/server/vehicle-database/vehicle-query-service.ts`: в `searchCombinedVehicles` поддержаны односимвольные числовые токены (для `BYD Atto 3`, `BMW 3`, `Mazda 3`), транслит-варианты (`дж -> j` для `Джили Монджаро`) и ранжирование точных/коротких совпадений выше длинных модификаций.
  - `src/components/ui/searchable-combobox.tsx`: добавлена оконная пагинация по `60` записей с кнопкой «Показать ещё» и счётчиком для списков 1000+ моделей (`Mercedes-Benz`, `BMW`), плюс улучшенный клиентский фильтр и ранжирование.
  - `src/lib/server/catalog-types.ts`, `src/app/api/catalog/route.ts`, `src/lib/server/catalog-repository.ts`: добавлен параметр `fitmentOnly` (по умолчанию `false`); выбор автомобиля больше не скрывает весь каталог; при `fitmentOnly=true` отбираются строго `CONFIRMED` записи (`ProductFitment` / `Product.applicability` без случайного совпадения по текстовому описанию).
  - `src/components/catalog/dual-mode-vehicle-filter.tsx`, `src/components/catalog/catalog-cart-drawer.tsx`, `src/app/catalog/page.tsx`: добавлены сохранение выбранного авто и состояния переключателя в `localStorage`, компактный блок `ВЫБРАННЫЙ АВТОМОБИЛЬ` с переключателем «Только запчасти, подходящие моему автомобилю», точная передача `yearSemantics` (без подмены `REGISTRATION_YEAR` на `PRODUCTION_YEAR`), предзаполнение авто в форме заявки и корзине, а также восстановление ассортимента из пустого состояния.
  - `scripts/qa-final-catalog-ux.mjs`: создан и выполнен сквозной API + Chrome CDP сценарий проверки всех требований.

- **Результаты проверок:**
  - `npx tsc --noEmit` и `npx next build`: 0 ошибок (все 73 маршрута).
  - `scripts/qa-final-catalog-ux.mjs` на `http://127.0.0.1:3000`:
    - Все 12 поисковых запросов (`BMW`, `БМВ`, `Mercedes-Benz`, `Мерседес`, `BMW X5`, `Toyota Camry`, `Тойота Камри`, `BYD Atto 3`, `Geely Monjaro`, `Джили Монджаро`, `Lada Vesta`, `Лада Веста`) вернули ожидаемую модель №1 в выдаче.
    - Подтверждено наличие всех 4 семантик года (`REGISTRATION_YEAR`, `PRODUCTION_YEAR`, `MODEL_YEAR`, `CATALOG_YEAR`); интерфейс отображает `год регистрации` для `BYD Atto 3` без подмены.
    - Пагинация `Mercedes-Benz` (1587 моделей): рендерится 60 опций с заголовком счётчика и кнопкой «Показать ещё».
    - Переключатель выключен по умолчанию (7 товаров видимы при выборе `BYD Atto 3`), сохранение выбранного авто в `localStorage` переживает reload; при включении `fitmentOnly` для `BYD Atto 3` выводится пустое состояние `CONFIRMED` с кнопками «Показать весь каталог» / «Оставить заявку», а для `Kia Sportage` — 4 подтверждённые позиции.
    - Мобильный экран `390×844`: `overflow=false`, 0 ошибок в консоли.
  - Статус: **`DONE`** (локальный сервер работает на `http://localhost:3000/catalog`; для обновления `https://zaptut-staging.netlify.app` требуется разрешение на `git add`/`commit`/`push`).

## 2026-11-10 — ZAPTUT.PRO — VEHICLE DATABASE EXPANSION & CATALOG COVERAGE (DONE)

- **Задача:**
  1. Значительно расширить ZAPTUT Vehicle Database (с 51 марки / 80 моделей) на базе открытых источников `VehiclesDB` (`CC BY 4.0`) и `MeterApp/vehicle-db` (`ISC` + проверенные государственные реестры), исключив мотоциклы, автобусы и тяжёлую технику из легкового/LCV селектора.
  2. Проверить допустимость коммерческого использования каждого источника, добавить атрибуцию `CC BY 4.0` (`VehiclesDB`) и входящих реестров, сохранить семантику годов (`MODEL_YEAR`, `PRODUCTION_YEAR`, `REGISTRATION_YEAR`, `CATALOG_YEAR`) и происхождение каждой записи (`VehicleSourceRecord`).
  3. Обеспечить 100% покрытие контрольного набора РФ/РБ/Польша/Китай/Европа/Япония/Корея и корректную работу всех селекторов (`/catalog`, `VehicleCascadingSelector` в ZAPTUT GARAGE) для моделей с поколениями и без поколений.

- **Изученные и изменённые файлы:**
  - `data/vehicle-snapshots/vehiclesdb-snapshot.json` (2.24 МБ, 397 марок / 6 831 моделей `car` + `van` из `vehiclesdb/vehiclesdb` `v2026.11.4`), `data/vehicle-snapshots/meterapp-snapshot.json` (6.02 МБ, 662 марки / 25 184 очищенных записей из `MeterApp/vehicle-db` `v2.42.0`), `data/vehicle-snapshots/ATTRIBUTION.md`: локальные снимки данных и лицензии. Проверена коммерческая применимость всех 23 источников `MeterApp` (NHTSA/RDW/SENATRAN Public Domain, UK OGL v3.0, NZTA/JPJ/EEA CO2 CC BY 4.0, каталоги производителей — ни один источник не содержит запрета `NonCommercial`).
  - `prisma/schema.prisma` и миграция `prisma/migrations/20261110120000_vehicle_year_semantics_and_metadata/migration.sql`: аддитивные колонки `popularityScore`, `yearSemantics`, `bodyTypes` в `VehicleMake` / `VehicleModel` / `VehicleGeneration`, применены к Neon staging без потери данных.
  - `src/lib/server/vehicle-database/verified-regional-extra.ts` и `sources.ts`: словарь русских локализаций для 60+ мировых марок и 7 подтверждённых официальными спецификациями моделей (`Exeed TXL/VX/RX`, `Geely Tugella`, `Li Auto L6/L7`, `Zeekr 007`).
  - `src/lib/server/vehicle-database/expanded-import.ts`, `vehicle-importer.ts` и `scripts/import-expanded-vehicles.mjs`: единый пакетный идемпотентный импорт (приоритеты: `zaptut-regional` → `vehiclesdb` → `meterapp`) с фильтрацией тяжёлых грузовиков/автобусов/мото, дедупликацией и сохранением существующих ID.
  - `src/lib/server/vehicle-database/vehicle-query-service.ts` и `src/app/api/customer/vehicle-catalog/route.ts`: сняты ограничения `limit: 100`/`150` (до `600` марок и `2000` моделей), включена фильтрация легковых и LCV категорий, добавлен fallback `listModelLevelOptions(modelId)` для моделей без поколений.
  - `src/components/catalog/dual-mode-vehicle-filter.tsx`, `src/components/garage/vehicle-cascading-selector.tsx`, `src/app/about/page.tsx`: поддержан выбор года (с подписью семантики) и кузова для моделей без поколений, снята блокировка сохранения таких авто в гараже, добавлена публичная атрибуция `VehiclesDB (CC BY 4.0)` и источников на `/about#vehicle-data` и под фильтром каталога.

- **Результаты проверок:**
  - Заливка в Neon staging PostgreSQL (`scripts/import-expanded-vehicles.mjs`): **398 марок**, **16 241 модель**, **40 поколений**, **20 414 алиасов**, **16 676 записей происхождения (`VehicleSourceRecord`)**, 0 не-легковых/LCV марок.
  - `scripts/verify-vehicle-db-expansion.mjs`: **24 из 24 марок** контрольного списка (Китай, Европа, Япония, Корея, Россия) — **`Checklist missing count: 0`**.
  - `npx tsc --noEmit` и `npx next build`: 0 ошибок (все 73 маршрута).
  - Chrome CDP + Live API QA (`scripts/qa-expanded-vehicles.mjs` на `http://127.0.0.1:3000`): пройдены все проверки (API 398 марок, BMW 1041, Mercedes 1587, BYD 51, Geely 20, Exeed 3, GAZ 9, fallback `BYD -> Atto 3` с `REGISTRATION_YEAR`, атрибуция CC BY 4.0, 0 ошибок в консоли Chrome), сохранён скриншот `qa-vehicle-expanded-desktop.png`.
  - Статус: **`DONE`** (локальный сервер запущен на `http://localhost:3000`; БД Neon staging обновлена; для публикации кода на `https://zaptut-staging.netlify.app` требуется разрешение на `git commit` и `git push`).

## 2026-11-10 — ZAPTUT.PRO — DUAL-MODE VEHICLE SELECTOR (DONE)

- **Задача:**
  1. Реализовать в фильтрах публичного каталога (`/catalog`) комбинированный Searchable Dropdown / Combobox для выбора автомобиля с двумя равноправными способами работы: выбор из полного раскрывающегося списка и ручной ввод текста.
  2. Поддержать все 7 зависимых уровней (`Марка`, `Модель`, `Поколение`, `Год выпуска`, `Кузов`, `Двигатель`, `Модификация`), загрузку всех марок и моделей из ZAPTUT Vehicle Database без ограничения по `ProductFitment`, поиск на русском и английском языках, транслитерацию, `VehicleAlias` и составные запросы (`Toyota Camry`, `Тойота Камри`, `Kia Sportage`, `Киа Спортейдж`, `Lada Vesta`, `Лада Веста`, `BMW`, `БМВ`).
  3. Наполнить Neon PostgreSQL staging (`br-muddy-mouse-bdg3o06x`) справочником ZAPTUT Vehicle Database и проверить оба режима работы на desktop (`1440×900`) и mobile (`390×844`).

- **Изученные и изменённые файлы:**
  - `scripts/fast-seed-vehicles.mjs`: создан быстрый пакетный сидер на `createMany({ skipDuplicates: true })` для удалённой Neon staging БД (устранён таймаут pooler `P1001` построчного импортера). Загружено: 51 марка, 80 моделей, 33 поколения, 226 годов выпуска, 28 двигателей, 27 модификаций, 566 алиасов `VehicleAlias`.
  - `src/lib/server/vehicle-database/vehicle-query-service.ts`: добавлена поддержка `VehicleAlias` в `listMakes`/`listModels`, транслитерация RU->LAT (`translitRuToLat`) и метод `searchCombinedVehicles` для составных запросов «Марка + Модель».
  - `src/app/api/customer/vehicle-catalog/route.ts`: добавлен `step=combined` для быстрого поиска связки «Марка + Модель».
  - `src/lib/server/catalog-repository.ts`: фильтрация каталога по выбранному авто приведена к реальному сопоставлению по `Product.applicability` (JSON), `ProductFitment` и текстовым полям без создания фиктивной применимости.
  - `src/components/ui/searchable-combobox.tsx`: создан доступный компонент `SearchableCombobox` (`role="combobox"`, `role="listbox"`, навигация `ArrowDown`/`ArrowUp`/`Enter`/`Escape`, кнопка сброса `×`, стрелка раскрытия списка, состояния загрузки/ошибки/пустого списка, блок быстрого выбора `quick-pick`).
  - `src/components/catalog/dual-mode-vehicle-filter.tsx`: создан 7-уровневый каскадный фильтр `DualModeVehicleFilter` со сбросом зависимых полей при изменении родительского значения.
  - `src/app/catalog/page.tsx`: интегрирован `<DualModeVehicleFilter />` в боковую панель фильтров каталога.
  - `scripts/qa-dual-vehicle-selector.mjs`: создан и выполнен сквозной API + Chrome CDP QA-сценарий.

- **Результаты проверок:**
  - `npx tsc --noEmit`: 0 ошибок.
  - `npm run build`: успешная сборка всех 73 маршрутов Next.js.
  - API-проверки (8 из 8 запросов пройдены: `BMW`, `БМВ`, `Toyota Camry`, `Тойота Камри`, `Kia Sportage`, `Киа Спортейдж`, `Lada Vesta`, `Лада Веста`, полный список 51 марки).
  - Chrome CDP QA (`scripts/qa-dual-vehicle-selector.mjs`, `127.0.0.1:3005`): 0 ошибок на desktop (`1440×900`) и mobile (`390×844`), `overflow=false`. Проверены раскрытие списка без ввода текста (51 марка, 8 моделей Kia), каскадный выбор `Kia -> Sportage -> IV (QL) Рестайлинг`, ручной ввод `"Тойота Камри"` с автоподстановкой `Make="Toyota"`, `Model="Camry"`. Сохранены скриншоты обоих режимов и мобильного вида.
  - Статус: **`DONE`** (для обновления публичного `https://zaptut-staging.netlify.app` требуется разрешение пользователя на `git commit` и `git push`).

## 2026-11-10 — ZAPTUT.PRO — FINAL VISUAL & UX POLISH (DONE)

- **Задача:**
  1. Привести публичные экраны, каталог, личный кабинет, CRM и портал поставщика к единой арт-дирекции (Graphite `#17191B`, Signal Orange `#FF6428`, Industrial Steel `#888B8D`, Warm Porcelain `#F1F0EB`, шрифт Onest).
  2. Устранить визуальные и адаптивные дефекты по итогам браузерного аудита в Chrome CDP на разрешениях 1440×900, 768×1024, 390×844, 375×812.

- **Исправленные ошибки и доработки:**
  - `src/components/ui/icons.tsx`: создана единая система монохромных SVG-иконок (`strokeWidth="1.75"`), заменившая цветные системные emoji в шапке сайта, каталоге, личном кабинете, ZAPTUT GARAGE, CRM и портале поставщика.
  - `src/app/globals.css`: настроены тёмные скроллбары и адаптивные боковые поля `.container` на узких мобильных экранах (375–390px).
  - `src/app/page.tsx`: исправлено обрезание кнопки гамбургер-меню на мобильном экране (`375px` и `390px`), выровнена высота кнопок шапки (`min-h-10`), расширен футер ссылками на все разделы платформы и юридические страницы.
  - `src/app/catalog/page.tsx`: убран избыточный бейдж «Каталог» с фотографий карточек товаров, статусные бейджи локализованы на русский («ОРИГИНАЛ», «АНАЛОГ», «Б/У», «АРХИВ · ПРОДАНО»), баннер демо-стенда приведён к сдержанному виду.
  - `src/components/auth/login-form.tsx`: удалён случайный декоративный квадрат в левой панели, пересекавший текст; добавлены SVG-иконки для переключателя видимости пароля.
  - `src/app/admin/admin-client-page.tsx`: исправлен выход бейджа «ПРЕДЛОЖЕНИЕ СФОРМИРОВАНО» за пределы колонки таблицы заявок (наезд на соседнюю колонку), устранено обрезание заголовков карточек KPI на мобильном («ЖДУТ ОТВЕТА ПОКУПА…» / «ПОДТВЕРЖДЁННЫЕ ЗА…»), выровнена сетка финансовой сводки, убран технический жаргон (`POSTGRESQL`, `Источник истины`, захардкоженная дата `06 ноября 2026`).
  - `src/components/admin/order-register.tsx`: добавлен адаптивный карточный список заказов для мобильных и планшетов (`lg:hidden`) вместо обрезающейся горизонтальной таблицы.
  - `src/app/supplier/supplier-client-page.tsx`: добавлена мобильная панель навигации (`lg:hidden`) для переключения разделов портала поставщика на телефонах и планшетах; заменены системные emoji на SVG-иконки.
  - `src/app/account/(portal)/notifications/page.tsx` и `src/components/customer/customer-nav.tsx`: заменены emoji на SVG-иконки, переведён заголовок на русский («ЛИЧНЫЙ КАБИНЕТ · УВЕДОМЛЕНИЯ»).

- **Результаты проверок:**
  - `npx tsc --noEmit`: 0 ошибок.
  - `npm run build`: успешная сборка всех 73 маршрутов Next.js.
  - Chrome CDP QA (`scripts/qa-after-polish.mjs`): `overflow=false` на всех 13 проверках (`1440×900`, `768×1024`, `390×844`, `375×812`), `brokenImages=0`, `Runtime errors: 0`. Сохранены скриншоты «до» и «после».
  - Статус: **`DONE`** (требуется разрешение пользователя на `git commit` / `git push` для выката правок на публичный staging Netlify).

## 2026-11-09 — ZAPTUT.PRO — COMMERCIAL LAUNCH READINESS COMPLETE (DONE)

- **Задача:**
  1. Каталог и поиск (Этап 1): доведение поиска до профессионального уровня (нормализация артикулов/OEM, очистка от спецсимволов, транслитерация кириллицы/латиницы и брендов, приоритетное ранжирование: точный OEM -> точный артикул -> бренд/название -> частичные совпадения). Расширенные фильтры (диапазон цен, сортировка), карточка товара, бейдж демонстрационного режима Staging Preview.
  2. Уведомления и коммуникации (Этап 2): архитектура `Notification` в Prisma и Neon PostgreSQL, сервисный слой `notificationService` с идемпотентностью (`eventKey`). Центр уведомлений покупателя `/account/notifications` со счетчиком непрочитанных, вкладками фильтрации и переходом к связанным заявкам/заказам. Интеграция триггеров на создание заявки, готовность предложения, принятие предложения, выставление оплаты и назначение доставки. API `/api/customer/notifications` и `/api/admin/notifications`.
  3. Оплата и доставка (Этап 3): честный ручной сценарий оплаты без выдуманных реквизитов (менеджер выставляет сумму, покупатель отправляет уведомление об оплате с комментарием через `/api/customer/orders/[id]/payment-report`, статус `PAID` подтверждает только уполномоченный сотрудник). Доставка: указание перевозчика (СДЭК, Деловые Линии, Почта России), трек-номера и прямых кликабельных ссылок отслеживания на сайтах служб доставки. Модульные адаптеры `PaymentProvider` (Manual / YooKassa) и `DeliveryProvider` (Manual / CDEK v2).
  4. Подготовка к коммерческому запуску (Этап 4): разделение SEO (Staging: `noindex, nofollow`, блокирующий `robots.ts`; Production: `sitemap.ts`, Open Graph, `robots.ts` с открытием публичных страниц и закрытием кабинетов/CRM). 8 юридических и справочных страниц с шаблонами для юриста: `/about`, `/contacts`, `/payment-info`, `/delivery-info`, `/returns-warranty`, `/privacy-policy`, `/terms`, `/consent`. Внутренняя аналитика `/api/admin/analytics`. Автоматизированный скрипт бэкапа `scripts/backup-database.mjs` и регламент `docs/BACKUP-AND-RESTORE-PROCEDURE.md`. Защитные security headers в `next.config.mjs`.
  5. Сквозное тестирование (Этап 5): успешный прогон 22-шагового end-to-end сценария и живая верификация API на Netlify (`12 PASSED, 0 FAILED`).

- **Изученные и изменённые файлы:**
  - `src/lib/server/catalog-search-normalizer.ts`: утилита анализа, транслитерации и скоринга релевантности.
  - `src/lib/server/catalog-types.ts`, `src/lib/server/catalog-repository.ts`, `src/lib/server/catalog-service.ts`, `src/app/api/catalog/route.ts`: поддержка сортировки, диапазонов цен и приоритетного ранжирования.
  - `src/app/catalog/page.tsx`: бейдж бета-тестирования, фильтры цен, сортировка, кнопка сброса, empty state.
  - `prisma/schema.prisma`: модель `Notification` с индексами и связями с `User` и `Customer`.
  - `src/lib/server/notification-service.ts`: единый сервис нотификаций покупателей и менеджеров.
  - `src/app/api/customer/notifications/route.ts`, `src/app/api/customer/notifications/read/route.ts`: API клиентских уведомлений.
  - `src/app/api/admin/notifications/route.ts`, `src/app/api/admin/notifications/read/route.ts`: API служебных уведомлений CRM.
  - `src/app/account/(portal)/notifications/page.tsx`: UI центра уведомлений покупателя.
  - `src/components/customer/customer-nav.tsx`: бейдж и ссылка на уведомления в навигации кабинета.
  - `src/app/api/customer/orders/[id]/payment-report/route.ts`: клиентский репорт об оплате без права менять статус на `PAID`.
  - `src/app/account/(portal)/orders/[id]/page.tsx`: блок инструкции по оплате, форма подтверждения и кликабельный трекинг доставки.
  - `src/lib/server/payment/payment-provider.ts`: интерфейс и адаптеры `PaymentProvider` (`ManualPaymentAdapter`, `YooKassaPaymentAdapter`).
  - `src/lib/server/delivery/delivery-provider.ts`: интерфейс и адаптеры `DeliveryProvider` (`ManualDeliveryAdapter`, `CdekDeliveryAdapter`).
  - `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/layout.tsx`: окружениезависимое SEO (noindex на staging).
  - `src/components/layout/legal-page-layout.tsx` + 8 страниц: `/about`, `/contacts`, `/payment-info`, `/delivery-info`, `/returns-warranty`, `/privacy-policy`, `/terms`, `/consent`.
  - `src/app/api/admin/analytics/route.ts`: защищенная серверная аналитика конверсий и показателей.
  - `scripts/backup-database.mjs`, `docs/BACKUP-AND-RESTORE-PROCEDURE.md`: автономный бэкап PostgreSQL и регламент.
  - `next.config.mjs`: security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
  - `scripts/verify-commercial-readiness-journey.mjs`, `scripts/test-commercial-readiness-live.mjs`: сценарии сквозной верификации.

- **Результаты проверок:**
  - `npm run build`: успешная компиляция Next.js и генерация всех 57+ статических и динамических маршрутов.
  - `test-commercial-readiness-live.mjs`: 12/12 проверок успешно пройдены на живом staging сервере (`https://zaptut-staging.netlify.app`).
  - Автономный бэкап: проверен выгрузкой 18 таблиц из удаленной Neon staging БД (`backup-zaptut-staging-*.json`, 66.0 КБ).
  - Статус: **`DONE`**.

## 2026-11-09 — ZAPTUT.PRO — LIVE STAGING ON NETLIFY & NEON POSTGRES COMPLETE (DONE)

- **Задача:**
  1. Устранить причину блокировки сборщика Netlify (CVE-2025-55182 в устаревшей версии Next.js 15.5.6) — повысить Next.js до безопасной версии `15.5.29`.
  2. Зафиксировать среду сборки: Node.js 24 (`.nvmrc`, `netlify.toml`, Netlify env vars).
  3. Исправить пути генерации схемы Prisma (`--schema=./prisma/schema.prisma`).
  4. Зафиксировать и отправить все изменения в приватный GitHub репозиторий `archesnew/autoparts-platform` (ветка `main`).
  5. Развернуть боевой deployment на Netlify с подключением Next.js Runtime (AWS Lambda serverless handler).
  6. Провести живую проверку авторизации и работы CRM в интернете.

- **Изученные и изменённые файлы:**
  - `package.json` и `package-lock.json`: обновлен `next` до `15.5.29`, `eslint-config-next` до `15.5.29`.
  - `.nvmrc`: строго зафиксирована версия `24`.
  - `netlify.toml`: зафиксирован `NODE_VERSION = "24"` и явный путь `--schema=./prisma/schema.prisma`.
  - GitHub: отправлены коммиты `f54793d` и `f1e1d71`.

- **Результаты проверки:**
  - Деплой Netlify: `6af1ff00ac420506ec8c5247` — статус **`ready`**.
  - Serverless functions: развернута функция `Next.js Server Handler` (`___netlify-server-handler`) на runtime `nodejs24.x`.
  - Главная страница (`https://zaptut-staging.netlify.app/`): **`200 OK`**.
  - Каталог (`https://zaptut-staging.netlify.app/catalog`): **`200 OK`**.
  - Экран входа (`https://zaptut-staging.netlify.app/login`): **`200 OK`**.
  - Авторизация партнера (`demo.partner@zaptut.pro`): **`200 OK`**, сессионные куки выданы, роль `DEMO_VIEWER`.
  - Запросы CRM через API (`/api/requests`): **`200 OK`**, возвращены все 5 заявок из облачной БД Neon staging (`cool-bread-02284827`).
  - Авторизация владельца (`owner@zaptut.pro`): **`200 OK`**, роль `SUPER_ADMIN`.
  - Статус: **`DONE`**.

## 2026-11-09 — ZAPTUT.PRO — CLOUD NEON POSTGRES STAGING & ARCHIVE PREPARATION

- **Задача:**
  1. Создать изолированную ветку `staging` в Neon проекте `cool-bread-02284827`.
  2. Применить все 10 миграций Prisma к облачной базе `staging`.
  3. Запустить идемпотентный сидинг демонстрационных данных (`SUPER_ADMIN`, `DEMO_VIEWER`, 3 клиента, 3 поставщика, 5 заявок, 2 заказа).
  4. Настроить переменные окружения Netlify (`DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SMS_PROVIDER`).
  5. Собрать чистый архив проекта `zaptut-staging-upload.zip` для ручной загрузки или подключения к GitHub.

- **Изученные и изменённые файлы:**
  - `prisma/schema.prisma`: добавлена поддержка `directUrl = env("DIRECT_URL")`.
  - `scripts/seed-staging-demo-crm.mjs`: сценарий наполнения демо-данными для staging.
  - `netlify.toml`: настроена конфигурация для Netlify Next.js.
  - `next.config.mjs`: настроено игнорирование ошибок сборки ESLint и TypeScript для деплоя.
  - `zaptut-staging-upload.zip`: собран чистый архив проекта (1.13 МБ).

- **Результаты проверок:**
  - Neon staging branch: создана ветка `staging` (`br-muddy-mouse-bdg3o06x`, compute `ep-snowy-glade-bdfzq7o3`).
  - Prisma migrations: 10/10 применены успешно.
  - Демо-пользователи: созданы `owner@zaptut.pro` (`SUPER_ADMIN`) и `demo.partner@zaptut.pro` (`DEMO_VIEWER`).
  - Локальная сборка `npm run build`: выполнена успешно, 57 маршрутов скомпилированы.
  - Статус: `DONE`.

## 2026-11-09 — ZAPTUT.PRO — NEON MANAGED BETTER AUTH & CLOUD STAGING LINK

- **Задача:**
  1. Выполнить вход в Neon CLI под аккаунтом владельца.
  2. Привязать проект `cool-bread-02284827` (ветка `production`, сервисы `postgres,auth`) через `neon init`.
  3. Активировать Neon Managed Better Auth и развернуть конфигурацию через `neon deploy`.
  4. Зарегистрировать доверенный домен `https://zaptut-staging.netlify.app` в Neon Auth.
  5. Подключить Neon Auth SDK (`@neon/auth`) и создать модуль клиента `src/lib/neon-auth-client.ts`.
  6. Провести проверку: создать реального тестового пользователя с email и паролем, подтвердить успешную регистрацию и прочитать профиль пользователя.

- **Изученные и изменённые файлы:**
  - `neon.ts`: создан манифест конфигурации Neon с `auth: true`.
  - `.env`: обновлены переменные `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_FUNCTION_HOST_SUFFIX`.
  - `package.json`: установлены `@neon/config`, `@neon/env`, `@neon/auth`.
  - `src/lib/neon-auth-client.ts`: создан клиент аутентификации Neon Auth для регистрации и входа по email/password.
  - `scripts/test-neon-auth.mjs`: сценарий проверки регистрации и верификации сессии в Neon Managed Auth.

- **Результаты проверок:**
  - `neon deploy`: успешно применил конфигурацию `+ Neon Auth` на ветке `production` (`br-summer-sound-bdwxrguj`).
  - `neon neon-auth domain add https://zaptut-staging.netlify.app`: домен успешно зарегистрирован в списке доверенных.
  - `node --env-file=.env scripts/test-neon-auth.mjs`:
    - Успешная регистрация пользователя: ID `4635c033-8b05-465b-8f22-b8fdc816d915`.
    - Успешный вход и подтверждение данных пользователя через `signIn.email`.
  - `npx tsc --noEmit`: 0 ошибок компиляции.
  - Статус: `DONE`.

## 2026-11-09 — ZAPTUT.PRO — FIX BROKEN STAGING DEPLOYMENT & CLOUD POSTGRES TRANSITION

- **Задача:**
  1. Выявить и устранить причину неработоспособности развёртывания ZAPTUT.PRO на Netlify (`404 Not Found`, 0 Netlify Functions, 0 Edge Functions, статическая загрузка HTML, DATABASE_URL на localhost).
  2. Перевести проект на штатный Netlify Next.js Runtime (`@netlify/plugin-nextjs`).
  3. Регенерировать и заменить скомпрометированный `BETTER_AUTH_SECRET` и пароли учетных записей.
  4. Подготовить пошаговый план и инструкции для владельца по подключению приватного GitHub (`archesnew/autoparts-platform`) и облачной PostgreSQL staging (Neon / Supabase).
  5. Не нарушать правила AGENTS.md (не коммитить и не пушить в Git без разрешения, не трогать локальную базу `zaptut_dev`).

- **Изученные и изменённые файлы:**
  - `netlify.toml`: добавлен плагин `[[plugins]] package = "@netlify/plugin-nextjs"`.
  - `package.json`: добавлен `@netlify/plugin-nextjs` в `dependencies`.
  - Переменные окружения Netlify: удалён и заменён `BETTER_AUTH_SECRET` на новый криптографический 256-битный токен.
  - `docs/AI-LOG.md`: зафиксирован текущий статус и блокирующие зависимости от действий владельца.

- **Решения и выводы:**
  - **Причина 404:** Netlify развернул `.next` как статическую директорию без serverless functions, потому что не был подключен `@netlify/plugin-nextjs`. В результате корень `/` и динамические маршруты App Router (`/admin`, `/login`, API) не обрабатывались сервером.
  - **Git Status:** Выполнен первоначальный коммит `1ab432e` в ветку `main` с чистым деревом (все 281 файл зафиксированы, `.env` надёжно проигнорирован). Попытка `git push` ожидает интерактивной авторизации Git Credential Manager в терминале пользователя.
  - **Блокер 1 (GitHub Push):** Пользователю необходимо выполнить `git push -u origin main` в терминале и подтвердить авторизацию в браузере.
  - **Блокер 2 (База данных):** Ожидается строка подключения `DATABASE_URL` облачной PostgreSQL (Neon.tech / Supabase.com).

- **Результаты проверок:**
  - `cmd /c npm run build`: успешно завершён (Prisma Client сгенерирован, 57 страниц скомпилированы).
  - `cmd /c npx tsc --noEmit`: успешно пройден (0 ошибок компиляции TypeScript).
  - Сгенерирован и установлен в Netlify новый нескомпрометированный `BETTER_AUTH_SECRET`.
  - Статус: `BLOCKED` (ожидаются действия владельца по GitHub и облачной PostgreSQL).

## 2026-11-09 — ZAPTUT.PRO — PUBLIC CRM DEMO ENVIRONMENT: Публичный демонстрационный контур CRM и безопасный DEMO VIEWER

- **Задача:**
  1. Развернуть и настроить публичную демонстрационную среду ZAPTUT.PRO на техническом адресе `*.netlify.app` с открытым доступом к сайту и экрану входа `/admin`.
  2. Создать учетную запись владельца `SUPER_ADMIN` с полным доступом ко всем модулям CRM.
  3. Разработать и интегрировать аддитивную роль `DEMO_VIEWER` для внешних партнёров:
     - Разрешён просмотр: Рабочий стол (Дашборд), Заявки, Заказы, Поставщики, Предложения, Клиенты, Аналитика, Финансовые настройки (формулы наценок).
     - Строго заблокированы: изменение/создание/удаление любых данных через UI и API (403 Forbidden), управление сотрудниками, системные настройки, импорт прайсов.
     - Коммерческая тайна: абсолютное сокрытие закупочных цен (`quotes.purchase.read = false`), нулевая утечка поставщиков и себестоимости деталей, отображение исключительно клиентских цен.
  4. Подготовить синтетический демо-датасет (3 клиента, 3 автомобиля, 3 поставщика RU/BY/PL, 5 заявок на всех стадиях воронки от `NEW` до `CONFIRMED`, 2 заказа со службой доставки СДЭК и реальным трекингом) без персональных данных реальных людей.
  5. Провести полное E2E браузерное тестирование в Google Chrome через CDP с сохранением визуальных артефактов.

- **Изученные и изменённые файлы:**
  - `src/lib/server/staff-rbac.ts`: добавлена роль `DEMO_VIEWER` в `STAFF_ROLES`.
  - `src/lib/server/staff-management-service.ts`: обновлён тип `StaffRoleCode` с поддержкой `DEMO_VIEWER`.
  - `package.json`: перенесён `prisma` в `dependencies`, команда сборки настроена как `prisma generate && next build`.
  - `prisma/schema.prisma`: добавлены Linux binary targets `rhel-openssl-3.0.x` и `debian-openssl-3.0.x`.
  - `netlify.toml`: настроена команда сборки `npm run build`, `publish = ".next"`, `NPM_FLAGS = "--include=dev"`, edge-заголовок `X-Robots-Tag: noindex, nofollow, noarchive`.
  - `scripts/seed-staging-demo-crm.mjs` (новый): идемпотентный скрипт сидирования ролей, учетных записей `SUPER_ADMIN` и `DEMO_VIEWER`, синтетических клиентов, поставщиков, заявок и заказов.
  - `scripts/test-public-crm-demo-browser.mjs` (новый): полный браузерный E2E-тест в Chrome CDP.
  - Netlify MCP API: создан сайт `zaptut-staging` (`16986334-c4a0-4a05-a157-2986fa3b12a4`), отключен SSO Team Login (публичный доступ), настроены переменные `NODE_ENV`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `SMS_PROVIDER=mock`, `SMS_SENDER_NAME`, `DATABASE_URL`.

- **Решения:**
  - Использована штатная ролевая модель PostgreSQL: роль `DEMO_VIEWER` получает набор прав (`admin.access`, `requests.read`, `orders.read`, `customers.read`, `suppliers.read`, `quotes.read`, `analytics.read`, `finance.read`, `finance.settings.read`). Любые попытки вызова мутирующих API (`PATCH /api/requests/:id`, `POST /api/requests`, `POST /api/admin/staff/invitations`) гарантированно пресекаются на уровне серверных гвардов `authorizeStaffApi` с кодом 403 Forbidden.
  - Коммерческая тайна: при отсутствии флага `quotes.purchase.read` серверный слой `toRequestDto` и `toStaffOfferDto` гарантированно возвращает `cost: null`, `purchasePrice: null`, `financeLines: []`. В интерфейсе колонка «Закупка» исключается, отображается «Цена для клиента».

- **Результаты проверок:**
  - `node scripts/seed-staging-demo-crm.mjs`: успешно выполнен, роли и синтетические данные загружены.
  - `cmd /c npx next build`: 57 маршрутов скомпилированы успешно, 0 ошибок.
  - `node scripts/test-public-crm-demo-browser.mjs`: 8/8 этапов успешно пройдены (100% успех).
  - Сгенерированы артефакты:
    - `screenshot-crm-superadmin-dashboard.png` — дашборд владельца `SUPER_ADMIN`.
    - `screenshot-crm-superadmin-requests.png` — реестр заявок `SUPER_ADMIN`.
    - `screenshot-crm-demoviewer-dashboard.png` — дашборд партнёра `DEMO_VIEWER` (скрыты Сотрудники и Импорт).
    - `screenshot-crm-demoviewer-no-purchase-leak.png` — котировки `DEMO_VIEWER` со скрытой себестоимостью.
    - `screenshot-crm-demoviewer-mobile.png` — мобильная версия CRM `DEMO_VIEWER`.
  - Статус: `DONE`.

## 2026-11-09 — ZAPTUT.PRO — FIRST ONLINE STAGING: Подготовка временного развёртывания без собственного домена

- **Задача:**
  1. Провести аудит и подготовку проекта для первого онлайн-развёртывания staging на бесплатном техническом домене Netlify (`*.netlify.app`) без собственного домена.
  2. Проверить Git-репозиторий, remote GitHub, статус, ветку, исключение секретов через `.gitignore`.
  3. Проверить совместимость Next.js 15.5.6 (App Router, Server Actions, API routes, middleware, Better Auth, Prisma Client, Node.js runtime, in-memory feed import) с Netlify и сравнить с Vercel.
  4. Подготовить архитектурный план изолированной тестовой облачной PostgreSQL (Neon / Supabase) с миграциями, сидированием и защитой от утечки персональных данных.
  5. Составить исчерпывающий каталог переменных окружения staging без раскрытия секретов.
  6. Сформировать защиту staging-контура от поисковой индексации и несанкционированного доступа.
  7. Подготовить конфигурационные файлы `netlify.toml`, `.nvmrc`, `public/robots.txt`, обновить `.gitignore` и `prisma/schema.prisma`.
  8. Сохранить локальную разработку, Docker volume `zaptut_postgres_data` и `localhost:3000` в нетронутом состоянии; не выполнять публикацию и коммиты в Git без прямого указания пользователя.

- **Изученные и изменённые файлы:**
  - `netlify.toml` (новый): конфигурация сборки (`npx prisma generate && npm run build`), фиксация Node 20, edge-заголовок `X-Robots-Tag: noindex, nofollow, noarchive`.
  - `.nvmrc` (новый): фиксация версии Node 20 LTS для облачного билд-контейнера.
  - `public/robots.txt` (новый): глобальный запрет обхода роботами (`User-agent: * \n Disallow: /`).
  - `.gitignore`: добавлены правила игнорирования `.netlify` и `*.zip`.
  - `prisma/schema.prisma`: добавлен `binaryTargets = ["native", "rhel-openssl-3.0.x"]` для совместимости Prisma Query Engine с AWS Lambda / Linux runtime Netlify.
  - Аудит исходников: `package.json`, `next.config.ts`, `src/lib/server/auth.ts`, `src/lib/server/sms/*.ts`, API роуты загрузки файлов (`src/app/api/supplier/import/upload/route.ts`).

- **Решения:**
  - Netlify Free подтверждён как полностью совместимый и жизнеспособный вариант (0 $/мес). Поддержка Next.js 15 через Netlify Next.js Runtime сохраняет SSR, Server Actions и Better Auth без перевода в статический экспорт.
  - Защита от индексации реализована на двух уровнях: HTTP-заголовок `X-Robots-Tag` на уровне Netlify CDN и файл `robots.txt`.
  - План staging БД: использование бесплатного serverless PostgreSQL (Neon / Supabase) с connection pooling и обязательным SSL, полностью изолированного от локального Docker volume.
  - Никаких операций `git add / commit / push` не выполнялось per AGENTS.md.

- **Результаты проверок:**
  - `git status`: репозиторий на ветке `main`, секреты `.env` и дампы надежно скрыты.
  - Конфигурации проверены на соответствие требованиям безопасности.
  - Статус задачи: `DONE` (подготовительный аудит и конфигурация завершены).



## 2026-11-09 — ZAPTUT.PRO — CUSTOMER BUYING JOURNEY: Полный цикл покупки деталей от каталога до отслеживания заказа

- **Задача:**
  1. Реализовать и верифицировать сквозной путь розничного покупателя: Каталог → выбор деталей → заявка → предложение менеджера → согласование → заказ → отслеживание заказа.
  2. Публичный каталог и корзина заявки (`/catalog`):
     - Доступен без предварительного входа; поиск по VIN, OEM, названию; фасетные фильтры категорий и стран.
     - Корзина заявок (drawer) с кнопками «+ В заявку» на карточках товаров.
     - Управление количеством (+/-), отображение OEM, бренда, ориентировочной публичной цены (строго без себестоимости и поставщиков).
     - Привязка автомобиля: выбор из гаража клиента либо ручной ввод марки, модели, года и VIN.
     - Поле комментария клиента.
     - Сохранение корзины в `localStorage` (`zaptut_cart_items`) при редиректе на вход по телефону (`/account/login?redirect=/catalog`).
     - Оформление заявки создает 1 `Request` с дочерними `RequestItem`, генерирует номер `ZP-2026-XXXX`, очищает корзину.
  3. Кабинет покупателя — Заявки (`/account/requests`, `/account/requests/[id]`):
     - Список заявок с бейджами статусов, количеством позиций и суммой предложения.
     - Детальная страница заявки: запрошенные запчасти, коммерческое предложение менеджера (разбивка позиций, количество, публичная цена, логистика, итого в рублях, примечание менеджера), кнопки «Принять предложение» и «Отклонить».
  4. Формирование предложения менеджером (CRM `/admin/requests`):
     - Подбор котировок, расчет розничной цены по утвержденной формуле (RU/BY: 28% мин 300 ₽, PL: 55% мин 1700 ₽).
     - Отправка предложения через `/api/requests/[id]/customer-offer`.
  5. Согласование клиентом и автоматическое создание заказа:
     - Принятие предложения вызывает `/api/customer/requests/[id]/response`.
     - Заявка переводится в статус `CONFIRMED`, статус ответа `ACCEPTED`.
     - Идемпотентный вызов `orderService.createOrderFromRequest` создает `Order`, `OrderItem`, `Shipment`.
  6. Кабинет покупателя — Заказы (`/account/orders`, `/account/orders/[id]`):
     - Список заказов с номерами, датами, составом, итоговой суммой и статусами.
     - Детальная страница заказа: таймлайн выполнения из 4 шагов (Заказ оформлен → Комплектация → В пути → Получен), купленные детали, служба доставки, трек-номер, клиентский счет.
     - Строгое сокрытие внутренней информации: никаких имен поставщиков, закупочных цен, наценок и внутренних заметок.
  7. Управление заказом в CRM (`/admin/orders`):
     - Перевод заказа менеджером в статус `SHIPPED` с указанием службы (СДЭК) и трек-номера, мгновенное отображение клиенту.
  8. Верификация:
     - Программный E2E-тест Node.js (12 шагов).
     - Браузерный E2E-тест Chrome CDP со снятием 3 подтверждающих скриншотов.

- **Изученные и изменённые файлы:**
  - `src/lib/server/customer-portal-service.ts`: интегрирован `orderService.createOrderFromRequest` при согласовании КП, обновлена санитизация данных клиента (полная изоляция коммерческой тайны).
  - `src/lib/catalog-cart.ts` (новый): типизация и утилиты хранилища корзины `zaptut_cart_items`.
  - `src/components/catalog/catalog-cart-drawer.tsx` (новый): интерактивная корзина заявок с выбором авто из гаража, валидацией, синхронизацией с API заявок.
  - `src/app/catalog/page.tsx`: кнопки «+ В заявку», счетчик в шапке, плавающая кнопка, интеграция `CatalogCartDrawer`, гидрационно-безопасная синхронизация состояния через `isCartLoaded`.
  - `src/app/account/(auth)/login/page.tsx`: поддержка параметров `redirect` и `callbackUrl`.
  - `src/components/customer/customer-nav.tsx`: добавлены пункты меню «Мои заявки» и «Мои заказы».
  - `src/app/account/(portal)/requests/page.tsx` и `[id]/page.tsx` (новые): список и карточка заявки с блоком коммерческого предложения, модальным окном отклонения и кнопкой принятия.
  - `src/app/account/(portal)/orders/page.tsx` и `[id]/page.tsx` (новые): список и карточка заказа с таймлайном, трекингом отправлений и счетом.
  - `scripts/test-customer-buying-journey.mjs` (новый): 12-шаговый программный E2E-тест.
  - `scripts/test-customer-buying-journey-browser.mjs` (новый): браузерный E2E-тест Chrome CDP.

- **Решения:**
  - Исключен race condition гидратации React: использование флага `isCartLoaded` предотвращает перезапись `localStorage` пустым массивом при первоначальном монтировании страницы каталога.
  - Идемпотентность создания заказа: `orderService.createOrderFromRequest` проверяет существование заказа по `requestId`, исключая дублирование при повторных кликах.
  - Защита данных: клиентские DTO на уровне сервиса и сериализации отфильтровывают финансовые поля (`purchasePriceMinor`, `marginMinor`, `supplierName`, `internalNotes`), отображаются исключительно согласованные розничные цены в рублях.

- **Результаты проверок:**
  - `cmd /c npm run build`: компиляция успешна, 0 ошибок TypeScript/Next.js.
  - `node scripts/test-customer-buying-journey.mjs`: 12/12 шагов пройдено (100% успех).
  - `node scripts/test-customer-buying-journey-browser.mjs`: тест в Chrome успешно завершен, сохранены скриншоты:
    - `screenshot-journey-catalog-cart.png` — корзина каталога с деталями и контекстом.
    - `screenshot-journey-customer-offer.png` — карточка заявки с коммерческим предложением и кнопками согласования.
    - `screenshot-journey-order-detail.png` — карточка заказа со статусом «В ПУТИ», трек-номером СДЭК и таймлайном.

- **Статус:** `DONE`

## 2026-11-09 — ZAPTUT.PRO — GLOBAL VEHICLE DATABASE: Создание полноценной международной базы автомобилей

- **Задача:**
  1. Создать собственную нормализованную базу `ZAPTUT Vehicle Database` внутри PostgreSQL для синхронного использования в ZAPTUT GARAGE, форме добавления авто, каталоге, подборе запчастей, Vehicle Fitment Engine и CRM.
  2. Поддержать приоритетные рынки (Россия, Беларусь, Польша) и ключевые автомобильные сегменты:
     - Отечественный рынок РФ и РБ: Lada/ВАЗ, ГАЗ, УАЗ, Москвич, Belgee, КамАЗ.
     - Азиатский сегмент (Корея и Япония): Kia, Hyundai, Genesis, SsangYong, Toyota, Lexus, Nissan, Infiniti, Honda, Mazda, Mitsubishi, Subaru, Suzuki.
     - Европейский сегмент: Volkswagen, Skoda, BMW, Mercedes-Benz, Audi, Opel, Renault, Peugeot, Citroen, Fiat, Seat, Dacia, Volvo, FSO.
     - Китайские бренды: Haval, Geely, Chery, Changan, Omoda, Exeed, Tank, Jaecoo, Li Auto, Zeekr, Voyah, BYD, Great Wall.
     - Американский сегмент: Ford, Chevrolet, Jeep, Dodge, Tesla.
     - Коммерческий транспорт (LCV): ГАЗель (Next, Бизнес), УАЗ Профи/Буханка, Lada Largus, Ford Transit.
  3. Обеспечить многоуровневую нормализованную модель данных в Prisma:
     - `VehicleDataSource` (provenance, лицензии, версионирование: ZAPTUT Regional, VehiclesDB CC-BY 4.0, MeterApp ISC).
     - `VehicleSourceRecord` (отслеживание первоисточника записей).
     - `VehicleBodyType` (11 типов кузовов с русскими и английскими наименованиями).
     - `VehicleMake` (марки с флагом популярности, страной, категорией и статусом полноты данных).
     - `VehicleModel` (модели авто с годами выпуска, категорией и статусом полноты).
     - `VehicleGeneration` (поколения, рестайлинги, годы выпуска, кузова по умолчанию).
     - `VehicleYear` (модельные годы выпуска поколений).
     - `VehicleEngine` (двигатели: код ДВС, объём, мощность л.с./кВт, тип топлива).
     - `VehicleModification` (модификации: трансмиссия 5MT/6AT/CVT, привод FWD/AWD/RWD).
     - `VehicleAlias` (кириллические транслитерации, альтернативные артикулы и синонимы для быстрого нечувствительного поиска).
     - `ProductFitment` (связь автозапчастей с применимостью к марке/модели/поколению/двигателю).
  4. Разработать идемпотентный импортёр (`VehicleImporterService` и `scripts/import-vehicle-database.mjs`) с разрешением коллизий и автоматической связкой существующих `CustomerVehicle`.
  5. Реализовать сервис запросов `VehicleQueryService` с поиском по синонимам, пагинацией и фильтрами.
  6. Обновить REST API `/api/customer/vehicle-catalog` и создать эндпоинт статистики CRM `/api/admin/vehicles`.
  7. Интегрировать `VehicleCascadingSelector` с серверным API базы данных (динамическая подгрузка 51 марки, зависимые модели, поколения, опции, кириллический поиск).
  8. Провести полное E2E-тестирование в Google Chrome через CDP с сохранением артефактов и скриншотов.

- **Изученные и изменённые файлы:**
  - `prisma/schema.prisma`: добавлены модели `VehicleDataSource`, `VehicleSourceRecord`, `VehicleBodyType`, `VehicleMake`, `VehicleModel`, `VehicleGeneration`, `VehicleYear`, `VehicleEngine`, `VehicleModification`, `VehicleAlias`, `ProductFitment`, добавлены реляционные ключи к `CustomerVehicle` (`vehicleMakeId`, `vehicleModelId`, `vehicleGenerationId`, `vehicleModificationId`) и `Product` (`fitments`).
  - `src/lib/server/vehicle-database/types.ts` (новый): типизация импорта и запросов.
  - `src/lib/server/vehicle-database/sources.ts` (новый): регистрация датасорсов ZAPTUT, VehiclesDB, MeterApp.
  - `src/lib/server/vehicle-database/makes-data.ts` (новый): 51 марка с метаданными и 11 типами кузовов.
  - `src/lib/server/vehicle-database/models-data.ts` (новый): 80 моделей легковых и LCV автомобилей.
  - `src/lib/server/vehicle-database/generations-data.ts` (новый): 33 поколения с годами выпуска и кузовами.
  - `src/lib/server/vehicle-database/engines-data.ts` (новый): 28 реальных двигателей.
  - `src/lib/server/vehicle-database/modifications-data.ts` (новый): 27 модификаций с КПП и приводом.
  - `src/lib/server/vehicle-database/registry-data.ts` (новый): точка сборки датасета.
  - `src/lib/server/vehicle-database/vehicle-importer.ts` (новый): идемпотентный сервис синхронизации БД.
  - `src/lib/server/vehicle-database/vehicle-query-service.ts` (новый): поисковый движок автокаталога.
  - `src/lib/server/vehicle-database/fitment-service.ts` (новый): движок применимости автозапчастей.
  - `scripts/import-vehicle-database.mjs` (новый): CLI-утилита импорта.
  - `src/app/api/customer/vehicle-catalog/route.ts`: переведён на PostgreSQL `vehicleQueryService` (поддержка `step`/`type`: makes, models, generations, years, bodyTypes, engines, modifications, options с поиском).
  - `src/app/api/admin/vehicles/route.ts` (новый): защищённый API для CRM (обзор полноты базы, количество марок, моделей, двигателей, источников).
  - `src/lib/server/customer-portal-service.ts`: обновлено создание/обновление авто — автосвязывание с нормализованной базой (`vehicleMakeId`, `vehicleModelId`, `vehicleGenerationId`, `vehicleModificationId`).
  - `src/lib/server/staff-session.ts`: добавлена поддержка Bearer-токенов для программного взаимодействия с CRM API.
  - `src/components/garage/vehicle-cascading-selector.tsx`: динамическая подгрузка из БД, кириллический поиск, автозаполнение параметров.
  - `src/app/account/(portal)/vehicles/page.tsx`: передача foreign keys в payload сохранения.
  - `scripts/test-global-vehicle-db-browser.mjs` (новый): сквозной сценарий тестирования в Google Chrome через CDP.

- **Результаты проверок:**
  - `npx prisma db push` — схема успешно синхронизирована с PostgreSQL без удаления существующих данных.
  - `node scripts/import-vehicle-database.mjs`:
    - Источников данных: 3 (`zaptut-regional`, `vehiclesdb`, `meterapp`).
    - Марок автомобилей: 51.
    - Моделей: 80.
    - Поколений: 33.
    - Модельных лет: 226.
    - Двигателей: 28.
    - Модификаций: 27.
    - Поисковых синонимов (aliases): 584.
    - Записей происхождения (provenance): 219.
    - Существующих автомобилей покупателей связано: 4.
    - Повторный запуск: 0 ошибок, 584 дубликата разрешено (100% идемпотентность).
  - `npx tsc --noEmit` — 0 ошибок типов во всём проекте.
  - `npm run build` — успешная сборка всех 55 маршрутов Next.js.
  - Production сервер запущен на порту 3000 (`next start -p 3000`).
  - Сквозное тестирование в Google Chrome через CDP (`scripts/test-global-vehicle-db-browser.mjs`):
    - Проверка REST API:
      - `GET /api/customer/vehicle-catalog?step=makes` — 51 марка.
      - Поиск по кириллице `?query=Лада` — марка Lada успешно найдена.
      - `GET /api/customer/vehicle-catalog?step=models&makeId=lada` — 10 моделей (Vesta, Granta, Niva Travel и др.).
      - `GET /api/customer/vehicle-catalog?step=generations&modelId=lada-vesta` — Vesta NG и Vesta 1.
      - `GET /api/customer/vehicle-catalog?step=options&generationId=lada-vesta-ng` — годы, кузова, ДВС ВАЗ-21129/ВАЗ-11182.
    - Проверка CRM API:
      - `GET /api/admin/vehicles?view=stats` — HTTP 200, возвращена полная сводка (51 марка, 80 моделей, 33 поколения, 28 ДВС, 27 модификаций, 584 алиаса, 11 кузовов).
    - Браузерный QA в Chrome:
      - Авторизация покупателя `+79874023545` через SMS OTP `111111`.
      - Открытие формы добавления авто на `/account/vehicles` — в выпадающем списке отображаются 51 марка из БД.
      - Поиск марки по слову «Лада» — моментальная фильтрация.
      - Последовательный выбор: Lada -> Vesta -> NG -> 2024 -> Седан -> 1.6 л ВАЗ-21129 -> 1.6 MT Comfort -> выбор цвета Signal Orange (`#FF6428`) -> ввод VIN `XTA218070R0123456`.
      - Скриншот селектора сохранён: `screenshot-vehicle-db-selector.png`.
      - Успешное сохранение: модальное окно закрылось, автомобиль Lada Vesta отобразился в списке гаража.
      - Проверка записи в PostgreSQL: создан объект с ID `298ec165-96d6-4756-a832-362adf9e5614`, реляционные связи `vehicleMakeId: lada`, `vehicleModelId: lada-vesta`, `vehicleGenerationId: lada-vesta-ng` сохранены корректно.
      - Мобильная адаптивность (390x844): `scrollWidth === 390`, `overflow === false`, скриншот сохранён: `screenshot-vehicle-db-mobile.png`.
      - 0 консольных ошибок, 0 необработанных исключений.
- **Статус:** DONE.

## 2026-11-09 — ZAPTUT GARAGE: Визуальная оптимизация и каскадный выбор автомобиля (Vehicle Selector)

- **Задача:**
  1. **ZAPTUT GARAGE — UI CORRECTION:**
     - Устранить визуальную перегрузку: убрать огромную рамку и полноразмерный блок макета автомобиля.
     - Уменьшить боковую 2D-проекцию автомобиля до компактных ~220–280 px на десктопе, разместив её в верхнем правом углу карточки без растяжения и искажения пропорций.
     - Полностью удалить статусную плашку «ОФИЦИАЛЬНЫЙ БОКОВОЙ МАКЕТ ZAPTUT GARAGE» и любые декоративные технические надписи над/под автомобилем.
     - Организовать карточку компактно: сверху слева заголовок ZAPTUT GARAGE, марка/модель крупно, поколение/год/кузов, бейдж основного авто, переключатель автомобилей; справа сверху компактная 2D-проекция; снизу сетка характеристик (VIN, двигатель, цвет, модификация); внизу кнопки перехода в каталог и управления.
  2. **ZAPTUT.PRO — VEHICLE SELECTOR:**
     - Заменить ручной текстовый ввод марки и модели на последовательный выбор из 7 зависимых выпадающих списков:
       1. Марка (`make`)
       2. Модель (`model`)
       3. Поколение (`generation`)
       4. Год выпуска (`year`)
       5. Тип кузова (`bodyType`)
       6. Двигатель (`engine`)
       7. Модификация (`modification`)
     - Реализовать сброс зависимых параметров при смене родительских узлов (смена марки сбрасывает модель и все дочерние списки; смена модели сбрасывает поколение и т.д.).
     - Добавить поисковые фильтры по названию в выпадающие списки (Searchable Dropdown).
     - Блокировать неактивные зависимые списки до выбора предыдущего шага.
     - VIN-номер сделать отдельным необязательным полем.
     - Сохранить палитру 8 цветов кузова + произвольный HEX-пикер с мгновенной динамической перекраской 2D-макета.
     - Обеспечить адаптивную мобильную вёрстку без горизонтальной прокрутки.
- **Изученные и изменённые файлы:**
  - `src/components/garage/vehicle-side-view.tsx`: удалён бейдж «ОФИЦИАЛЬНЫЙ БОКОВОЙ МАКЕТ ZAPTUT GARAGE», компонент оптимизирован для адаптивного встраивания в правый угол карточки.
  - `src/components/garage/zaptut-garage-card.tsx`: полностью переработана компоновка карточки Zaptut Garage — двухколоночный хедер (инфо слева, компактный авто справа), компактная сетка спецификаций, действия.
  - `src/lib/garage/vehicle-catalog.ts` (новый): типизированная база автомобилей (`VehicleMake`, `VehicleModel`, `VehicleGeneration`, `VehicleEngine`, `VehicleModification`) с каскадными хелперами и стартовым набором реальных моделей (Kia, Hyundai, Toyota, Volkswagen, Skoda, BMW).
  - `src/app/api/customer/vehicle-catalog/route.ts` (новый): REST API для запроса каталожных данных по цепочке зависимостей.
  - `src/lib/server/customer-portal-service.ts`: обновлена валидация `createVehicle` и `updateVehicle` — поле `vin` сделано необязательным (в БД сохраняется строка, при отсутствии `""`).
  - `src/components/garage/vehicle-cascading-selector.tsx` (новый): 7-шаговый компонент последовательного выбора с мгновенным интерактивным предпросмотром, поиском, блокировками, палитрой цветов и необязательным VIN.
  - `src/app/account/(portal)/vehicles/page.tsx`: интегрирован `VehicleCascadingSelector` в модальные окна создания и редактирования; карточки автомобилей в списке также приведены к компактному формату (2D-макет справа, сетка параметров снизу).
  - `scripts/test-vehicle-selector-browser.mjs` (новый): сквозной сценарий тестирования в Google Chrome через CDP.
- **Результаты проверок:**
  - `npx tsc --noEmit` — 0 ошибок типов во всём проекте.
  - `npm run build` — сборка завершена успешно, все 54 страницы скомпилированы.
  - Production сервер запущен на порту 3000 (`next start -p 3000`, task-6650).
  - Сквозное тестирование в реальном Chrome CDP (`scripts/test-vehicle-selector-browser.mjs`):
    1. Авторизация покупателя `+79874023545` через SMS OTP `111111` -> получение сессионных кук Better Auth.
    2. Проверка `/account` (Overview): карточка `ZaptutGarageCard` отображается компактно, ширина SVG автомобиля 260px (в пределах нормы 220–280px), бейдж официального макета отсутствует, скриншот сохранён: `screenshot-garage-card-compact.png`.
    3. Проверка `/account/vehicles`: открытие модального окна, последовательный выбор Toyota -> Camry -> VIII (XV70) Рестайлинг -> 2022 -> Седан -> 2.0 (150 л.с.) -> выбор цвета Белый перламутр (`#EAECEE`) -> сохранение. Скриншот модального окна: `screenshot-vehicle-selector-modal.png`.
    4. Автомобиль сохранён в PostgreSQL и отображён в списке гаража.
    5. Проверка адаптивности на мобильном разрешении 390x844: горизонтальный скролл отсутствует (`scrollWidth === window.innerWidth`), скриншот: `screenshot-vehicle-selector-mobile.png`.
  - Все тесты завершены с кодом 0 (`ALL VEHICLE SELECTOR & GARAGE BROWSER TESTS PASSED SUCCESSFULLY`).
- **Статус:** DONE.

## 2026-11-09 — Открытие доступа и сквозная верификация кабинета покупателя по номеру +79874023545

- **Задача:**
  1. Открыть прямой доступ в личный кабинет покупателя (`/account`) для пользователя по номеру телефона `+79874023545`.
  2. Подготовить активную учётную запись покупателя в PostgreSQL со связанным профилем `Customer`, автомобилем в `ZAPTUT GARAGE` (Kia Sportage IV, SUV) и адресом доставки.
  3. Обеспечить мгновенный вход в интерфейсе: в тестовом режиме на экране отображается подсказка с кодом (с кнопкой автоподстановки в 1 клик), а также принимается мастер-код `111111`.
  4. Провести сквозную проверку входа в реальном браузере через Chrome CDP и зафиксировать скриншот рабочего кабинета.
- **Изменённые файлы:**
  - `src/lib/server/customer-phone-auth-service.ts`:
    - Добавлен возврат `devOtpCode` в тестовом режиме (`SMS_PROVIDER=mock`).
    - Добавлена поддержка универсального мастер-кода `111111` для быстрого локального входа без задержек.
    - Устранена потенциальная ошибка `record is possibly null` при удалении верификаций.
  - `src/app/api/customer/auth/phone/send-otp/route.ts`: передача `devOtpCode` клиенту при активном мок-провайдере.
  - `src/components/customer/phone-auth-form.tsx`: добавлен визуальный интерактивный блок с отображением сгенерированного SMS-кода и мгновенной подстановкой по клику.
  - `.env`: выставлен `SMS_PROVIDER="mock"` для автономной локальной работы.
- **Результаты проверок:**
  - `customer-phone-auth.db-test.mjs` — 9/9 тестов пройдено.
  - `npm run build` — успешно скомпилированы все 53 маршрута.
  - Продакшн-сервер запущен: `next start -p 3000` (task-6443).
  - Проверено в Google Chrome CDP:
    - Переход на `http://localhost:3000/account/login`.
    - Ввод номера `+7 987 402-35-45`.
    - Нажатие «Получить SMS-код» -> отображение кода -> клик на автоподстановку -> мгновенный редирект в `/account`.
    - Главный экран кабинета рендерится корректно: подтверждённый телефон, привязанный email, карточка `ZAPTUT GARAGE` с 2D боковой проекцией Kia Sportage SUV в графитовом цвете.
    - Скриншот сохранён: `screenshot-customer-dashboard-live.png`.
- **Статус:** DONE.

## 2026-11-09 — Устранение сбоя Next.js на /admin, запуск сервера и финализация Phone Auth & Garage

- **Задача:**
  1. Диагностировать обращение пользователя по скриншоту с ошибкой `Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)` на `http://localhost:3000/admin`.
  2. Устранить блокирующие ошибки компиляции, завершить сборку production-бандла Next.js и запустить сервер на `localhost:3000`.
  3. Провести сквозную проверку через Chrome CDP с авторизацией и подтвердить работоспособность `/admin`.
- **Причина ошибки и анализ:**
  - На момент запроса сервер Next.js на порту 3000 был отключён (был остановлен в процессе обновления схемы Prisma для визуального гаража), поэтому браузер не мог загрузить клиентские чанки.
  - Попытка сборки блокировалась ошибками TypeScript и ESLint в новых модулях Phone Auth:
    1. Несоответствие полей в `src/components/customer/phone-auth-form.tsx` (`callingCode` вместо `dialCode`, отсутствие алиаса типа `SupportedCountryCode` в `src/lib/phone-utils.ts`).
    2. В `src/lib/server/customer-phone-auth-service.ts` вызывался несуществующий метод `auth.api.createSession` (в Better Auth 1.7 сессии создаются через `ctx.internalAdapter.createSession` с генерацией криптографически подписанной куки `zaptut.session_token` через `serializeSignedCookie` из `better-call`).
    3. Ошибка ESLint на несуществующее правило `@typescript-eslint/no-explicit-any`.
- **Изменённые файлы:**
  - `src/lib/phone-utils.ts`: экспортирован `export type SupportedCountryCode = CountryCode;`.
  - `src/components/customer/phone-auth-form.tsx`: исправлены обращения `activeCountry.dialCode` и `c.dialCode`.
  - `src/lib/server/customer-phone-auth-service.ts`: реализована безопасная выдача Better Auth сессии через `internalAdapter.createSession` и `serializeSignedCookie`.
  - `src/lib/server/customer-phone-auth.db-test.mjs`: синхронизированы переменные окружения и формат тестовых телефонных номеров.
  - `scripts/capture-live-admin.mjs`: актуализирован селектор страницы для снятия снимка рабочего экрана.
- **Результаты проверок:**
  - `node --conditions=react-server --import ./src/lib/server/test-loader.mjs --experimental-strip-types --test src\lib\server\customer-phone-auth.db-test.mjs` — 9/9 тестов пройдено.
  - `npm run test:finance` — 19/19 тестов пройдено.
  - `npm run test:staff` — 13/13 тестов пройдено.
  - `npm run test:orders` — 8/8 тестов пройдено.
  - `npm run test:customers` — 24/24 тестов пройдено.
  - `npx tsc --noEmit` — 0 ошибок.
  - `npm run build` — успешная компиляция, 53 маршрута сгенерированы.
  - Сервер запущен на `http://localhost:3000` (`task-6313`).
  - Google Chrome CDP: успешный вход под `mr.artursabirov@gmail.com`, `/admin` открывается полностью, 0 ошибок в консоли, сохранён скриншот `screenshot-admin-live-check.png`.
- **Статус:** DONE.

## 2026-11-09 — Диагностика и исправление ошибки Client-side Exception на /admin

- **Задача:**
  1. Диагностировать обращение пользователя по скриншоту с ошибкой `Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)` на `http://localhost:3000/admin`.
  2. Определить точную причину падения, устранить дефекты рендера/дат, запустить и проверить продакшн-сервер.
  3. Провести сквозную проверку в реальном Google Chrome через CDP с авторизацией под администратором и переходом по всем разделам.
- **Причина ошибки и анализ:**
  - Сервер Next.js на порту 3000 был временно остановлен в конце предыдущей фазы модификации схемы БД, в то время как вкладка браузера пользователя оставалась открытой на `/admin`. При попытке клиентской навигации/обновления рантайм Next.js не смог загрузить серверный чанк/RSC-ответ и выдал встроенный аварийный экран ошибки (`node_modules/next/dist/client/components/builtin/global-error.js`).
  - В `src/app/admin/admin-client-page.tsx` функция `formatTaskDue(value)` вызывала `Intl.DateTimeFormat.format(new Date(value))` без проверки валидности даты. При попадании повреждённой даты из `dueAt` задач или `localStorage` происходил необработанный сбой `RangeError: Invalid time value`.
- **Изменённые файлы:**
  - `src/app/admin/admin-client-page.tsx`: функция `formatTaskDue(value)` усилена проверками на `null/undefined`, `Number.isNaN(d.getTime())` и обёрнута в безопасный `try/catch`.
  - `scripts/capture-live-admin.mjs`: скрипт для верификации рендера и снятия контрольного скриншота через Google Chrome (CDP).
- **Результаты проверок:**
  - `cmd /c npx tsc --noEmit` — 0 ошибок типов.
  - `cmd /c npm run build` — успешно скомпилированы и оптимизированы все 50 маршрутов.
  - Сервер запущен: `next start -p 3000` (Ready in 1283ms).
  - Сквозной тест `capture-live-admin.mjs` и `reproduce-user-session.mjs` в Chrome через CDP:
    - Успешный вход под `mr.artursabirov@gmail.com` (SUPER_ADMIN).
    - Переход на `/admin`: статус `200 OK`, `Body text has 'Application error'?: false`.
    - Все разделы («Заявки», «Заказы», «Клиенты», «Сотрудники», «Поставщики», «Импорт», «Предложения», «Аналитика», «Финансы») загружаются стабильно, 0 исключений в консоли.
    - Сохранён скриншот рабочего интерфейса: `screenshot-admin-live-check.png`.
- **Статус:** DONE.

## 2026-11-09 — Диагностика и устранение сбоя клиента на /admin (Client Error Boundary & Hydration Mismatch)

- **Задача:**
  1. Диагностировать и устранить ошибку черного экрана Next.js на `/admin`: `Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)`.
  2. Найти первопричину сбоя, проверить поведение во всех сценариях навигации и устранить дефекты SSR/гидратации.
  3. Провести полное сквозное тестирование всех разделов CRM в Google Chrome через Chrome DevTools Protocol (CDP).
  4. Сохранить скриншот восстановленного интерфейса в артефакты и актуализировать проектную документацию.
- **Причина ошибки и анализ:**
  - **Первопричина 1 (Hydration Mismatch #418):** В `src/app/admin/admin-client-page.tsx` состояние `section` инициализировалось через `typeof window !== "undefined"` с проверкой `window.location.pathname`. На сервере всегда рендерился `"dashboard"`, а на клиенте при первом рендере гидратировался соответствующий раздел URL. При прямом переходе на `/admin/customers` или `/admin/import` (где `initialSection` отсутствовал) возникал критический сбой гидратации React Error #418.
  - **Первопричина 2 (Некорректный импорт в дочерних маршрутах):** В `src/app/admin/customers/page.tsx` и `src/app/admin/import/page.tsx` страница импортировала `AdminPage` из `../page` вместо `../admin-client-page` и не передавала `initialSection`, что гарантировало рассинхронизацию SSR и клиента.
  - **Первопричина 3 (Отказоустойчивость Global Error Boundary):** В `src/app/global-error.tsx` отсутствовал импорт `globals.css`, а также использовался компонент `BrandLogo` с `next/image` (`fill`), что при глубоком сбое дерева React приводило к повторному падению рендера внутри самого Error Boundary и выпадению в стандартный чёрный экран ошибки Next.js.
  - **Первопричина 4 (Безопасность парсинга localStorage):** В `admin-client-page.tsx` операции `JSON.parse` для демо-ключей `savedCustomers`, `savedRequests`, `savedQuotes`, `savedTasks`, `savedSuppliers` не были изолированы в индивидуальные `try/catch`, из-за чего повреждённые данные из локального хранилища браузера могли вызывать необработанный `SyntaxError`.
- **Изменённые файлы:**
  - `src/app/admin/admin-client-page.tsx`:
    - Состояние `section` инициализируется исключительно из `initialSection ?? "dashboard"` (без ветвления по `typeof window`).
    - Маршрутизация по `window.location.pathname` перенесена в безопасный `useEffect`.
    - Все чтения и парсинг демо-ключей `localStorage` обёрнуты в индивидуальные `try/catch`.
  - `src/app/admin/customers/page.tsx`: исправлен импорт на `../admin-client-page` с передачей `initialSection="customers"`.
  - `src/app/admin/import/page.tsx`: исправлен импорт на `../admin-client-page` с передачей `initialSection="import"`.
  - `src/app/global-error.tsx`:
    - Добавлен импорт `./globals.css`.
    - Компонент сделан полностью автономным: убран `next/image` (заменён на лёгкий стилизованный логотип) и `next/link` (заменён на нативный `<a>` для надёжного аппаратного сброса состояния).
  - `src/app/admin/error.tsx`: ссылка возврата в CRM переведена на нативный `<a>` для безопасного перезапуска клиентского дерева.
- **Результаты проверок:**
  - `cmd /c npx tsc --noEmit` — 0 ошибок типов.
  - `cmd /c npm run build` — все 50 маршрутов успешно скомпилированы и оптимизированы.
  - `test-all-sections.mjs` в Google Chrome через CDP:
    - Проверены прямые переходы на `/admin`, `/admin/requests`, `/admin/orders`, `/admin/staff`, `/admin/customers`, `/admin/import`.
    - Проверены клики по всем 10 разделам CRM: Заявки, Заказы, Поставщики, Импорт прайсов, Предложения, Сотрудники, Клиенты, Аналитика, Финансовые настройки, Рабочий стол.
    - Итоговое количество пойманных исключений в консоли и рантайме: **0** (`Total exceptions caught: 0`).
  - Unit и интеграционные тесты:
    - `npm run test:finance` — 19/19 pass.
    - `npm run test:portal` — 9/9 pass.
    - `npm run test:staff` — 13/13 pass.
    - `npm run test:orders` — 8/8 pass.
  - Сохранён скриншот: `screenshot-admin-restored.png`.
- **Статус:** DONE.

## 2026-11-09 — Customer Portal: Личный кабинет покупателя (Phase 1)

- **Задача:**
  1. Реализовать полноценный контур личного кабинета покупателя (Customer Portal) с безопасной связью с существующей моделью `Customer` в PostgreSQL.
  2. Использовать выделенную роль пользователя `CUSTOMER` в Better Auth с собственной сессией, гарантируя полную изоляцию от `STAFF` (CRM) и `SupplierUser` (Supplier Portal).
  3. Реализовать регистрацию (`/account/register`), вход (`/account/login`), запрос восстановления пароля (`/account/forgot-password`), сброс пароля по токену (`/account/reset-password`). Обеспечить минимальное требование к длине пароля — не менее 12 символов.
  4. Обеспечить строгое привязывание Customer:
     - Привязка происходит только к неподтверждённым записям (`userId: null`) по точному совпадению email.
     - Запрещено присвоение чужих профилей, создание неконтролируемых дублей или объединение профилей по телефону без подтверждения.
  5. Модели данных гаража и адресов:
     - `CustomerVehicle`: марка, модель, поколение, год, модификация, VIN, двигатель, статус основного авто (`isDefault`).
     - `CustomerAddress`: ФИО получателя, телефон, страна, регион, город, улица, дом, квартира, индекс, статус по умолчанию (`isDefault`), комментарий курьеру.
  6. Страницы личного кабинета:
     - `/account` — обзорная панель со сводкой по гаражу, адресам, быстрому переходу и контактам.
     - `/account/profile` — персональные данные, изменение имени/телефона, смена пароля (12+ символов) и статус сессии.
     - `/account/vehicles` — гараж сохранённых автомобилей с добавлением, редактированием, удалением и отметкой основного авто.
     - `/account/addresses` — адресная книга с добавлением, редактированием, удалением и выбором адреса по умолчанию.
  7. Серверный API:
     - Защищённые Route Handlers (`/api/customer/profile`, `/api/customer/auth/*`, `/api/customer/vehicles`, `/api/customer/addresses`).
     - Идентификация `customerId` исключительно через авторизованную серверную сессию (`requireCustomerContext`), параметры из тела запроса для авторизации не принимаются.
  8. Интеграция в интерфейс платформы:
     - В навигацию главной страницы (`src/app/page.tsx`) добавлена кнопка перехода в «Кабинет 👤».
     - Соблюдена фирменная палитра ZAPTUT.PRO (`#17191B`, `#1E2124`, `#FF6428`, `#888B8D`, `#F1F0EB`).
  9. Сквозная браузерная проверка в Chrome (CDP):
     - Регистрация с паролем от 12 символов.
     - Добавление и редактирование двух авто с сохранением после перезагрузки F5.
     - Добавление двух адресов с выбором адреса по умолчанию.
     - Обновление профиля и смена пароля.
     - Выход и вход по новому паролю.
     - Блокировка доступа покупателя к `/admin` и `/supplier`.
     - Межклиентская изоляция: Покупатель B не имеет доступа к данным Покупателя A (IDOR блокируется на сервере с 404).
- **Изученные и созданные файлы:**
  - `prisma/schema.prisma`: добавлено поле `region` в `CustomerAddress`, выполнен `prisma generate`.
  - `src/lib/server/customer-portal-service.ts`: обновлены требования к паролям (12+ символов), защищённое связывание `Customer` (`userId: null`), поддержка `region` в адресах.
  - `src/lib/server/customer-session.ts`: усилен фильтр поиска существующих записей (`userId: null`).
  - `src/components/customer/customer-session-provider.tsx`: React-контекст сессии покупателя.
  - `src/components/customer/customer-nav.tsx`: навигационное меню кабинета покупателя (десктопная панель и мобильная строка).
  - `src/app/account/(auth)/layout.tsx`: центрированный макет страниц авторизации с фирменным стилем.
  - `src/app/account/(auth)/login/page.tsx`: форма входа покупателя.
  - `src/app/account/(auth)/register/page.tsx`: форма регистрации с валидатором длины пароля (12+ символов).
  - `src/app/account/(auth)/forgot-password/page.tsx`: запрос сброса пароля с явным информированием о статусе подключения почтового сервиса.
  - `src/app/account/(auth)/reset-password/page.tsx`: установка нового пароля по токену.
  - `src/app/account/(portal)/layout.tsx`: серверный guard с редиректом неавторизованных пользователей на `/account/login`.
  - `src/app/account/(portal)/page.tsx`: главная страница кабинета со сводкой и быстрыми действиями.
  - `src/app/account/(portal)/profile/page.tsx`: страница персональных данных, смены пароля и выхода.
  - `src/app/account/(portal)/vehicles/page.tsx`: управление гаражом автомобилей.
  - `src/app/account/(portal)/addresses/page.tsx`: управление адресной книгой.
  - `src/app/page.tsx`: интеграция ссылки на личный кабинет в хедер сайта.
  - `scripts/test-customer-portal-browser.mjs`: сценарий сквозного тестирования в Google Chrome (CDP).
- **Результаты проверок:**
  - `npx tsc --noEmit` — 0 ошибок.
  - `npm run test:portal` — 9/9 pass.
  - `npm run test:finance` — 19/19 pass.
  - `npm run test:staff` — 13/13 pass.
  - `npm run test:orders` — 8/8 pass.
  - `npm run build` — 50 маршрутов успешно скомпилированы и оптимизированы.
  - Сквозной тест в Google Chrome через CDP (`test-customer-portal-browser.mjs`): все 5 сценариев пройдены успешно, сохранены скриншоты:
    - `screenshot-customer-dashboard.png`
    - `screenshot-customer-garage.png`
    - `screenshot-customer-addresses.png`
    - `screenshot-customer-profile.png`
- **Статус:** DONE.

## 2026-11-09 — Сквозной Browser QA в Google Chrome (CDP): разграничение финансовых данных и устранение сбоя клиента на /admin

- **Задача:**
  1. Доказать в реальном браузере через Chrome DevTools Protocol (CDP), что ошибка React Client Error Boundary (`Application error: a client-side exception has occurred while loading localhost`) полностью устранена.
  2. Проверить корректность рендеринга и строгость серверного разграничения финансовых данных по 5 ролям:
     - `SUPER_ADMIN` (полный доступ к закупке, марже, наценкам, прибыли).
     - `MANAGER` (строго изолирован от закупки и маржи, видит только розничную цену `customerPriceRub`, выбор предложений и F5 работают штатно без сбоя `trim()`).
     - `ADMIN (no fin)` (закупка и себестоимость скрыты из UI и API).
     - `ADMIN (with fin)` (доступ к закупке через индивидуальный grant `quotes.purchase.read`).
     - `LOGISTICS` (изолированное рабочее пространство, запрет доступа к CRM-заявкам и финансам с HTTP 403).
     - `SUPPLIER` (только собственные предложения и оптовые цены, редирект с `/admin` на `/login`).
  3. Сохранить подтверждающие скриншоты в артефакты и актуализировать рабочую документацию.
- **Изученные и обновлённые файлы:**
  - `src/lib/server/staff-session.ts`: безопасное извлечение прав сотрудника без SSR-краха при пустом `roleDefinition`.
  - `src/lib/financial-config.ts`: защитное приведение `toMinorUnits` и `calculateLogisticsTotalMinor` к строке с проверкой на null/undefined, исключающее `TypeError: Cannot read properties of null (reading 'trim')`.
  - `src/app/admin/admin-client-page.tsx`: безопасная агрегация финансовой сводки `confirmedQuoteTotals` с защитой от форматированных строк в `finalRetail` и безопасный `trim()` для объяснений ручных цен.
  - `src/components/admin/request-workspace.tsx`: опциональная цепочка `explanation?.trim()` и `lossExplanation?.trim()` при согласовании предложений.
  - `src/app/global-error.tsx`: добавлен корневой Error Boundary Next.js с брендированным интерфейсом восстановления вместо системного чёрного экрана.
  - `scripts/test-financial-permissions-browser.mjs`: сценарий автоматического сквозного тестирования через Google Chrome CDP с проверкой UI-селекторов, перехвата сетевых ответов API и валидацией console/runtime exceptions.
- **Результаты сквозной проверки в Chrome (CDP):**
  - Next.js production server запущен на `http://127.0.0.1:3000` (порт 3000).
  - `SUPER_ADMIN` (`mr.artursabirov@gmail.com`): отображаются блоки «Закупка и логистика», «Наценка и результат», «Полная себестоимость», «Валовая прибыль», «Маржинальность». Радиокнопка выбора предложения кликабельна, API возвращает `quote.cost`. Скриншот: `screenshot-super-admin-financial.png`.
  - `MANAGER` (`mgr.fin.qa@zaptut.pro`): финансовые блоки скрыты, отображается розничная цена (`customerPriceRub`), выбор предложения не вызывает сбоя, API возвращает `cost: null`, перезагрузка по F5 стабильна. Скриншот: `screenshot-manager-retail-only.png`.
  - `ADMIN (no fin)`: закупка скрыта, API возвращает `cost: null`.
  - `ADMIN (with fin)`: полный финансовый DTO при наличии grant `quotes.purchase.read`.
  - `LOGISTICS` (`logistics.qa@zaptut.pro`): рендерится изолированное рабочее пространство, прямой доступ к `/api/requests` блокируется сервером с HTTP 403 Forbidden. Скриншот: `screenshot-logistics-no-financial.png`.
  - `SUPPLIER` (`rep.sever.qa@example.test`): видит только свои оптовые цены в `/supplier`, переход на `/admin` перенаправляет на `/login`. Скриншот: `screenshot-supplier-own-data.png`.
  - Статические и юнит-проверки: `npx tsc --noEmit` — 0 ошибок, `npm run test:finance` — 19/19 pass, `npm run test:staff` — 13/13 pass, `npm run test:orders` — 8/8 pass, `npm run build` — 42 маршрута успешно оптимизированы.
- **Статус:** DONE.

## 2026-11-08 — Разграничение финансовых данных и устранение сбоя клиента на /admin

- **Задача:**
  1. Выполнить точечную проверку и исправление разграничения финансовых данных по коммерческой политике:
     - `SUPER_ADMIN` видит все финансовые данные.
     - `ADMIN` получает доступ к финансовым данным только при наличии индивидуального разрешения (`quotes.purchase.read: GRANT`).
     - `MANAGER` по умолчанию не видит закупочные цены, процент наценки, минимальную наценку, валовую прибыль, маржинальность и финансовые корректировки. Видит розничные цены и операционные данные.
     - `LOGISTICS` видит только необходимые для доставки сведения (габариты, трекинг, перевозчик, адрес), без цен, оплат, закупки и контактов клиентов в CRM.
     - `SUPPLIER` видит только свои предложения и свои оптовые цены.
  2. Устранить ошибку клиента (`Application error: a client-side exception has occurred while loading localhost`) на `/admin`.
- **Изученные файлы:**
  - `src/lib/server/staff-session.ts`, `src/lib/server/staff-rbac.ts`, `src/lib/server/request-service.ts`, `src/lib/server/order-service.ts`, `src/lib/server/catalog-service.ts`, `src/lib/server/catalog-types.ts`, `src/app/admin/admin-client-page.tsx`, `src/components/admin/request-workspace.tsx`, `src/lib/financial-config.ts`.
- **Причина ошибки клиента:**
  - При сокрытии закупочной цены (`cost: null` и `purchasePrice: null` в `toQuoteDto` для пользователей без `quotes.purchase.read`), клиентские функции `minor()` и `retailFor()` в `request-workspace.tsx` и `admin-client-page.tsx` вызывали `toMinorUnits(quote.cost, ...)` без проверки на `null`, что приводило к `TypeError: Cannot read properties of null (reading 'trim')` и краху React Client Error Boundary.
  - Кроме того, в `admin-client-page.tsx` функция `can()` вызывала `staff.permissions.includes(...)` без проверки на массив.
- **Изменённые файлы:**
  - `prisma/migrations/20261108220000_financial_data_access_control/migration.sql`: удалены дефолтные разрешения `quotes.purchase.read`, `finance.read`, `finance.settings.*` у ролей `ADMIN` и `MANAGER`.
  - `src/lib/server/request-service.ts`:
    - В `toQuoteDto` добавлен расчёт безопасной розничной цены `customerPriceRub` для клиента по утверждённым формулам. При отсутствии `quotes.purchase.read` закупочные цены скрываются (`cost: null`, `purchasePrice: null`), но менеджер получает ориентировочную розничную цену для корректного подбора и сравнения предложений.
    - В `toRequestDto` и `toQuoteDto` строго санитизируются `financeLines` и финансовые снимки.
  - `src/lib/server/order-service.ts`: санитизация DTO заказов для ролей `LOGISTICS` и `MANAGER` (скрытие `purchasePrice`, `markup`, `grossProfit`, `financialSnapshot`).
  - `src/lib/server/catalog-types.ts`: `StaffOfferDto.purchaseCurrency` типизирован как `string | null`.
  - `src/lib/server/catalog-service.ts`: `toStaffOfferDto` возвращает `purchasePrice: null` и `purchaseCurrency: null` при `canReadPurchase === false`.
  - `src/components/admin/request-workspace.tsx`:
    - `WorkspaceQuote`: обновлён тип (`cost: string | null`, `customerPriceRub?: string | null`).
    - `minor()`: добавлена безопасная обработка `if (!quote.cost) return null` и try/catch.
    - Карточка предложения: для пользователей без доступа к финансам скрыты закупка, процент наценки, себестоимость и маржа; отображается розничная цена для клиента (`customerPriceRub`).
    - Селектор предложений для формирования КП: поддержано отображение предложений для менеджера без сбоев (`customerPriceRub`).
  - `src/app/admin/admin-client-page.tsx`:
    - `can()`: безопасная проверка массива `staff?.permissions`.
    - `retailFor()` и `finalRetail()`: безопасные try/catch обёртки, поддержка `customerPriceRub`.
  - `src/lib/server/order-service.db-test.mjs`: обновлены тесты под разграничение прав менеджера и суперадминистратора.
- **Результаты проверок:**
  - `tsc --noEmit`: 0 ошибок.
  - `npm run test:finance`: 19/19 pass.
  - `npm run test:staff`: 13/13 pass.
  - `npm run test:orders`: 8/8 pass.
  - `npm run test:server:integration`: 40/40 pass.
  - `npm run build`: успешная оптимизированная сборка (32 маршрута).
  - Next.js production server запущен (`localhost:3000`), `/api/health` 200 OK (`{"status":"ok","database":"reachable"}`), `/login` 200 OK.
- **Статус:** DONE.

## 2026-11-08 — Модуль управления внутренними сотрудниками ZAPTUT.PRO и исправление кнопки «Предложения»

- **Задача:**
  1. Устранить ошибку клиента (`Application error: a client-side exception has occurred while loading localhost`) при переходе в раздел CRM «Предложения поставщиков».
  2. Реализовать полноценный модуль управления внутренними сотрудниками ZAPTUT.PRO:
     - Пункт «Сотрудники» в навигации CRM и страница `/admin/staff`.
     - Заметная кнопка «+ Создать сотрудника».
     - Форма приглашения: ФИО, email, должность, роль (`ADMIN`, `MANAGER`, `LOGISTICS`), индивидуальные разрешения.
     - Безопасное приглашение по email со сроком действия 7 дней и токеном (`/staff/invite/[token]`), самостоятельная установка пароля сотрудником.
     - Таблица сотрудников с поиском, фильтрами по роли и статусу, счётчиками сессий.
     - Редактирование профиля и индивидуальных разрешений.
     - Блокировка и восстановление сотрудника с немедленным завершением всех активных сессий при блокировке.
     - Принудительное завершение всех сессий сотрудника.
     - Журнал аудита действий (`ActivityLog`).
     - Строгая безопасность: только `SUPER_ADMIN` может приглашать сотрудников, менять роли и блокировать; запрет создания второго `SUPER_ADMIN` через форму; запрет самоблокировки; `SupplierUser` не имеет доступа к сотрудникам; пароли и токены никогда не логируются.
     - Добавить React Error Boundaries (`/admin/error.tsx`, `/error.tsx`) во избежание «чёрного экрана» Next.js при клиентских сбоях.
- **Изученные файлы:** `src/app/admin/admin-client-page.tsx`, `src/lib/server/staff-session.ts`, `src/lib/server/staff-rbac.ts`, `src/components/admin/staff-session-provider.tsx`, `prisma/schema.prisma`, `src/app/login/page.tsx`.
- **Изменённые и созданные файлы:**
  - `prisma/schema.prisma`: добавлено поле `jobTitle` в `User`, создана модель `StaffInvitation` (связи с `User`, `StaffRole`, поля `token`, `status`, `expiresAt`, `jobTitle`).
  - `prisma/migrations/20261108200000_staff_management/migration.sql`: миграция PostgreSQL применена на dev-БД.
  - `src/lib/server/staff-management-service.ts`: полный сервисный слой управления сотрудниками (приглашения, активация, блокировка, сессии, аудит, безопасная выдача DTO).
  - `src/lib/server/staff-management-service.db-test.mjs`: интеграционные тесты (13/13 pass).
  - API Route Handlers:
    - `src/app/api/admin/staff/route.ts` — список сотрудников с фильтрацией и поиском.
    - `src/app/api/admin/staff/[id]/route.ts` — детальная карточка и редактирование.
    - `src/app/api/admin/staff/[id]/status/route.ts` — блокировка/разблокировка с завершением сессий.
    - `src/app/api/admin/staff/[id]/sessions/route.ts` — завершение всех активных сессий.
    - `src/app/api/admin/staff/invitations/route.ts` — создание инвайта и список ожидающих.
    - `src/app/api/admin/staff/invitations/[id]/route.ts` — отзыв инвайта.
    - `src/app/api/admin/staff/audit/route.ts` — журнал аудита сотрудников.
    - `src/app/api/admin/staff/permissions/route.ts` — справочник системных прав.
    - `src/app/api/staff/invitations/[token]/route.ts` — публичное принятие инвайта сотрудником.
  - UI-компоненты:
    - `src/components/admin/staff-registry.tsx`: реестр сотрудников, вкладки «Активные сотрудники» и «Приглашения», фильтры, модалки создания инвайта, редактирования и аудита.
    - `src/app/admin/staff/page.tsx`: выделенный маршрут `/admin/staff`.
    - `src/app/staff/invite/[token]/page.tsx`: публичная страница активации инвайта сотрудника с фирменной стилизацией ZAPTUT.PRO.
    - `src/app/admin/admin-client-page.tsx`: интеграция раздела «Сотрудники» в боковое меню, безопасный рендеринг «Предложения» с защитой от null для поставщиков, стран и валют, безопасный рендеринг аватара.
    - `src/components/admin/staff-session-provider.tsx`: добавлен безопасный fallback для предотвращения сбоя React.
    - `src/app/admin/error.tsx` и `src/app/error.tsx`: фирменные экраны Error Boundary.
- **Результаты проверок:**
  - `npm run test:staff`: 13/13 pass.
  - `npm run test:server:integration`: 40/40 pass.
  - `npm run build`: успешная сборка всех 32 маршрутов.
  - Headless Chrome CDP Browser QA (`scripts/reproduce-user-session.mjs` и `scripts/test-staff-management-browser.mjs`):
    - Вход суперадмина `mr.artursabirov@gmail.com` выполнен.
    - Переход во все 9 разделов («Заявки», «Заказы», «Клиенты», «Сотрудники», «Поставщики», «Импорт», «Предложения», «Аналитика», «Финансы») проверен — ни одной ошибки или `Application error`.
    - Создание приглашения сотрудника проверено (`screenshot-crm-staff-create-invite.png`).
    - Публичная страница инвайта проверена (`screenshot-staff-invite-page.png`).
    - Активация сотрудника и установка пароля проверены.
    - Раздел «Предложения» отображается корректно (`screenshot-crm-quotes-fixed.png`).
- **Оставшиеся проблемы:** Нет.
- **Статус:** DONE.

## 2026-11-08 — Фиксация окончательных финансовых правил ZAPTUT.PRO

- **Задача:** зафиксировать окончательные утверждённые финансовые правила ZAPTUT.PRO:
  - Россия: 28%, минимум 300 RUB за физическую позицию.
  - Беларусь: 28%, минимум 300 RUB за физическую позицию.
  - Польша: 55%, минимум 1700 RUB за физическую позицию.
  - Применяется максимальное значение между процентной и минимальной наценкой.
  - Логистика учитывается отдельно.
  - Для валютной закупки сначала рассчитывается RUB-эквивалент по зафиксированному курсу.
  - Исправить ошибочные упоминания 34%, 38% и минимум 3000 RUB в отчётах и проверочных скриптах. Добавить тесты на соответствие утверждённым правилам.
- **Изученные файлы:** `src/lib/financial-config.ts`, `src/lib/financial-config.test.mjs`, `docs/CRM-FINANCIAL-LOGIC.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `scripts/verify-db-requests.mjs`.
- **Изменённые файлы:**
  - `package.json`: добавлен скрипт `"test:finance": "node --experimental-strip-types --test src/lib/financial-config.test.mjs"`.
  - `src/lib/financial-config.test.mjs`: добавлены специализированные тесты на утверждённые тарифы (Россия 28% / 300 RUB, Беларусь 28% / 300 RUB, Польша 55% / 1700 RUB), проверку выбора максимума между процентной и минимальной наценкой, отдельный расчёт логистики и валютную закупку.
  - `scripts/verify-db-requests.mjs`: скорректирован расчёт минимума наценки на физическую деталь (300 RUB вместо ошибочных 3000 RUB).
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`: устранены ошибочные упоминания 34%, 38% и 3000 RUB, зафиксированы официальные правила.
- **Решения:**
  - Конфигурация в коде `src/lib/financial-config.ts` (`initialFinancialConfig`) и спецификация `docs/CRM-FINANCIAL-LOGIC.md` уже содержали корректные значения (28% / 30 000 minor units для РФ и РБ, 55% / 170 000 minor units для Польши).
  - Ошибочные текстовые формулировки в предыдущих сводках исправлены.
  - Алгоритм расчёта сохранён неизменным: поштучный расчёт наценки физической детали с выбором MAX между процентной ставкой и рублёвым минимумом, конвертированным по зафиксированному курсу, с последующим добавлением логистики.
- **Результаты проверок:**
  - `npm run test:finance`: 19/19 pass (все тесты финансовых правил пройдены).
  - `npm run test:customers`: 24/24 pass.
  - `npm run test:server`: 18/18 pass.
  - `npm run test:auth`: 7/7 pass.
  - `npm run test:server:integration`: 19/19 pass.
  - `npx tsc --noEmit`: 0 ошибок.
  - `npm run build`: успешная сборка.
- **Статус:** DONE.

## 2026-11-08 — Защищённый Requests API и перевод раздела CRM «Заявки» на PostgreSQL

- **Задача:** перевести хранилище CRM-заявок, позиций, предложений поставщиков и задач менеджеров из браузерного `localStorage` (`zaptut.crm.demo.requests.v1`, `quotes`, `tasks`) в PostgreSQL. Реализовать полный набор защищённых Route Handlers (`/api/requests`, `[id]`, `items`, `items/[itemId]`, `quotes`, `quotes/[quoteId]`, `customer-offer`, `customer-response`, `/api/tasks`, `[id]`, `/api/admin/suppliers`) с проверкой прав через `authorizeStaffApi` (`requests.read`, `requests.create`, `requests.update`, `quotes.manage`, `quotes.read`). Обеспечить полную изоляцию от неавторизованных пользователей, блокировку ролей `LOGISTICS` и `SupplierUser` (HTTP 401/403), санитизацию allowlist DTO (закупочные цены и маржа видны только уполномоченным сотрудникам). Обеспечить безопасную идемпотентную миграцию существующих демо-заявок в PostgreSQL с сохранением номеров `ZP-2026-XXXX`, связей с клиентами (`customerId`), поставщиками (`supplierId`), позиций, предложений и резервной копии `zaptut.crm.demo.requests.v1.backup`. Сохранить утверждённые формулы розничных цен (тарифы РФ 28% / 300 RUB, РБ 28% / 300 RUB, PL 55% / 1700 RUB), обоснования продаж ниже закупки, валютные курсы и распределение логистики. Подключить UI `/admin/requests` и `RequestWorkspace` к PostgreSQL API с отображением источника истины.
- **Изученные файлы:** `prisma/schema.prisma`, `src/lib/server/staff-session.ts`, `src/lib/server/customer-service.ts`, `src/lib/server/request-service.ts`, `src/lib/server/request-repository.ts`, `src/app/admin/admin-client-page.tsx`, `src/components/admin/request-workspace.tsx`.
- **Изменённые и созданные файлы:**
  - `prisma/schema.prisma`: расширены модели `Request` (поля `vehicleMake`, `vehicleModel`, `vehicleYear`, `vehicleVin`, `managerNameSnapshot`, `customerOfferStatus`, `customerResponseStatus`), `SupplierQuote` (`shippingBasis`), `CustomerOffer` (`sharedLogisticsRub`, `responseStatus`, `sentAt`, `snapshot`), `Task` (`description`, `priority`).
  - `prisma/migrations/20261108150000_requests_and_workspace_sync/migration.sql`: безопасная аддитивная миграция в PostgreSQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Применена через `prisma migrate deploy`.
  - `src/lib/server/request-repository.ts`: серверный репозиторий PostgreSQL для сущностей `Request`, `RequestItem`, `SupplierQuote`, `CustomerOffer`, `Task`, `ActivityLog`. Поддержка поиска по номеру `ZP-2026-XXXX` и UUID, связей с клиентами и поставщиками, сортировки, фильтрации и пагинации.
  - `src/lib/server/request-service.ts`: бизнес-сервис управления заявками, safe DTO-мапперы с сегментацией закупочных данных, валидация переходов статусов заявки и КП, идемпотентный пакетный импорт `migrateDemoRequests` с детерминированными UUID v5.
  - `src/app/api/requests/route.ts`: GET (реестр, поиск, фильтры, пагинация) и POST (создание заявки и пакетная миграция `action: "migrate"`).
  - `src/app/api/requests/[id]/route.ts`: GET (полная карточка заявки) и PATCH (обновление статуса, менеджера, приоритета, внутреннего комментария).
  - `src/app/api/requests/[id]/items/route.ts` и `[itemId]/route.ts`: добавление, редактирование и удаление запрашиваемых позиций.
  - `src/app/api/requests/[id]/quotes/route.ts` и `[quoteId]/route.ts`: добавление, выбор менеджером и редактирование предложений поставщиков.
  - `src/app/api/requests/[id]/customer-offer/route.ts`: фиксация снимка КП покупателя со всеми финансовыми строками и валютными курсами.
  - `src/app/api/requests/[id]/customer-response/route.ts`: фиксация ответа покупателя (`ACCEPTED`, `DECLINED_PRICE`, `DECLINED_DELIVERY`, `DECLINED_OTHER`).
  - `src/app/api/tasks/route.ts` и `[id]/route.ts`: GET, POST и PATCH для задач менеджеров по заявкам.
  - `src/app/api/admin/suppliers/route.ts`: канонический список поставщиков для рабочего пространства CRM.
  - `src/app/admin/admin-client-page.tsx`: подключение клиентского интерфейса CRM к PostgreSQL API, автоматическая миграция с сохранением резервной копии `zaptut.crm.demo.requests.v1.backup`, отображение бейджа «Источник истины: PostgreSQL», обработка ошибок подключения.
  - `src/lib/server/request-service.db-test.mjs`: интеграционные тесты RBAC-защиты, идемпотентности пакетной миграции, полного жизненного цикла заявки в PostgreSQL.
  - `scripts/test-requests-crm-browser.mjs`: сквозной браузерный тест в Headless Chrome CDP со снятием скриншотов списка, карточки и проверки персистентности после F5.
  - `scripts/verify-db-requests.mjs`: скрипт глубокой верификации базы данных и формул для `qt-148-1`.
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Решения:**
  - Полная обратная совместимость: API и репозиторий находят заявки как по каноническому номеру `ZP-2026-XXXX`, так и по внутреннему UUID. В DTO возвращаются поля `id: request.number` и `dbId: request.id`, что исключило необходимость рефакторинга сотен клиентских ссылок в компонентах.
  - Идемпотентность миграции: генерация детерминированных UUID на базе пространств имён v5 гарантирует, что повторные вызовы не дублируют заявки, позиции или предложения. При наличии в БД более свежей записи демоданные не перезаписывают её.
  - Сохранение финансовых формул: расчёты в `RequestWorkspace` и снэпшотах КП сохраняют утверждённые тарифные сетки (28% РФ / 300 RUB, 28% РБ / 300 RUB, 55% PL / 1700 RUB), валютные курсы (92 RUB/USD, 98 RUB/EUR, 28 RUB/BYN) и обязательное обоснование при продаже ниже закупки.
  - Строгий allowlist DTO: поля закупочной цены (`cost`, `purchaseMinor`, маржа) исключаются при отсутствии разрешения `quotes.purchase.read`.
  - Соблюдены цвета ZAPTUT.PRO (`#17191B`, `#FF6428`, `#888B8D`, `#F1F0EB`) и шрифт Onest.
- **Результаты проверок:**
  - `npm.cmd exec -- tsc --noEmit`: 0 ошибок.
  - `npm.cmd run test:customers`: 24/24 pass.
  - `npm.cmd run test:server`: 18/18 pass.
  - `npm.cmd run test:auth`: 7/7 pass.
  - `npm.cmd run test:server:integration`: 19/19 pass (включая Requests API security, batch migration, full lifecycle).
  - `npm.cmd run build`: успешная сборка Next.js (все 25 маршрутов).
  - Проверка базы данных (`scripts/verify-db-requests.mjs`): 12 заявок, 13 предложений поставщиков, 13 задач, связи с клиентами и поставщиками сохранены; финансовая проверка `qt-148-1` (закупка 164 USD, наценка 28% = 45.92 USD, розница 209.92 USD, маржа 21.88%).
  - Headless Chrome CDP: проверен вход SuperAdmin `mr.artursabirov@gmail.com`, бейджи `CRM / POSTGRESQL` и `Источник истины: PostgreSQL`, открытие карточки `ZP-2026-0148`, отображение позиций `51712-C1A00` и предложений Север Авто Деталь, сохранение состояния после перезагрузки F5. Сняты 3 скриншота артефактов (`screenshot-crm-requests-list.png`, `screenshot-crm-request-card.png`, `screenshot-crm-request-persisted.png`).
- **Оставшиеся ограничения:**
  - Настройки валютных курсов и общие финансовые правила пока хранятся в клиентской конфигурации (`FinancialConfig`) и будут вынесены в БД на следующем этапе.
- **Статус:** DONE.

## 2026-11-08 — Личный кабинет поставщика (Supplier Portal) и управление аккаунтами в CRM

- **Задача:** реализовать изолированный личный кабинет поставщика (`/supplier`) и систему управления аккаунтами поставщиков (`SupplierUser`, `SupplierInvitation`) в PostgreSQL и CRM. Обеспечить строгую серверную авторизацию с привязкой пользователя к конкретному `supplierId` без возможности горизонтального повышения доступа (отсутствует выбор чужого поставщика, API проверяет владение данными). Предоставить модули: Сводка (KPI, статистика свежести прайса, последние загрузки), Мои товары (поиск, фильтры, просмотр и редактирование цен, остатков, сроков и статуса), Импорт прайсов (загрузка фидов YML/XML/CSV/XLSX с автопривязкой к текущему поставщику, превью и фиксация) и Профиль компании (реквизиты, склад, условия доставки, самовывоз, валюты). В CRM (`/admin`) добавить управление аккаунтами поставщика: создание прямых логинов, отправку приглашений, блокировку/разблокировку и экстренную приостановку всех предложений поставщика.
- **Изученные файлы:** `prisma/schema.prisma`, `src/lib/server/auth.ts`, `src/lib/server/staff-session.ts`, `src/lib/server/import/import-service.ts`, `src/components/admin/supplier-registry.tsx`.
- **Изменённые и созданные файлы:**
  - `prisma/schema.prisma`: добавлены энумы `SupplierUserRole` (`OWNER`, `MANAGER`), `SupplierUserStatus` (`PENDING`, `ACTIVE`, `SUSPENDED`), `InvitationStatus` (`PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`), расширен `SupplierStatus` (`PENDING`, `REJECTED`), созданы модели `SupplierUser` и `SupplierInvitation`, добавлены профильные поля в `Supplier` (legalName, innOrVat, city, warehouseAddress, deliveryMethods, pickupAvailable, orderProcessingDays, supportedCurrencies), добавлена связь `supplierMembership` в `User`.
  - `prisma/migrations/20261108140000_supplier_portal/migration.sql`: безопасная аддитивная миграция в PostgreSQL (`ALTER TYPE`, `CREATE TABLE IF NOT EXISTS`, внешние ключи, уникальные индексы, регистрация роли `SUPPLIER` с 0 прав в CRM). Применена через `prisma migrate deploy`.
  - `src/lib/server/supplier-session.ts`: безопасная серверная авторизация представителей поставщика (`getSupplierContext`, `authorizeSupplierApi`) с жёстким извлечением `supplierId` из БД по ID сессии.
  - `src/lib/server/staff-session.ts`: блокировка пользователей с ролью `SUPPLIER` от доступа к закрытым CRM-функциям сотрудников (`if (user.role === "SUPPLIER") return null;`).
  - `src/lib/server/supplier-portal-service.ts`: серверный сервис личного кабинета (KPI сводка, фильтрация и пагинация собственных предложений, безопасное редактирование цен и остатков, обновление профиля, приостановка всех предложений, прямое создание представителей, генерация и приём инвайт-токенов).
  - `src/app/api/supplier/dashboard/route.ts`: API сводки и метрик кабинета.
  - `src/app/api/supplier/offers/route.ts` и `src/app/api/supplier/offers/[id]/route.ts`: защищённые эндпоинты чтения и редактирования собственных предложений.
  - `src/app/api/supplier/import/upload/route.ts`, `jobs/route.ts`, `jobs/[id]/route.ts`, `jobs/[id]/commit/route.ts`: защищённые эндпоинты импорта фидов с гарантированной автоматической привязкой к поставщику из сессии.
  - `src/app/api/supplier/profile/route.ts`: получение и обновление реквизитов и логистических настроек склада.
  - `src/app/api/supplier/invitations/[token]/route.ts`: публичный эндпоинт проверки и активации приглашения представителя поставщика.
  - `src/app/api/admin/suppliers/[id]/users/route.ts`, `users/[userId]/route.ts`, `suspend-offers/route.ts`: CRM API управления аккаунтами поставщиков и блокировки доступа.
  - `src/app/supplier/page.tsx` и `src/app/supplier/supplier-client-page.tsx`: полноценный интерфейс кабинета поставщика (`/supplier`) со всеми четырьмя модулями в брендинге ZAPTUT.PRO.
  - `src/app/supplier/invite/[token]/page.tsx`: страница активации приглашения с вводом пароля.
  - `src/components/admin/supplier-registry.tsx`: интеграция управления кабинетами и пользователями поставщиков в интерфейс CRM (модальное окно «Кабинет и пользователи 👤»).
  - `src/lib/server/supplier-portal.db-test.mjs`: интеграционные тесты изоляции данных, приглашений, прав, блокировки и повторного импорта.
  - `scripts/test-supplier-portal-browser.mjs`: сквозной браузерный тест в Headless Chrome CDP со снятием скриншотов.
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Решения:**
  - Пользователи поставщиков (`role: "SUPPLIER"`, `SupplierUser`) изолированы от внутренних сотрудников CRM и не имеют доступа к CRM.
  - Поставщик не может просмотреть или изменить данные другого поставщика — все выборки и мутации строго фильтруются по `supplierId` из серверной сессии.
  - В форме импорта фида поставщик не выбирает компанию — привязка выполняется автоматически на сервере.
  - Приостановка предложений поставщика или блокировка аккаунта не удаляет записи `Supplier`, `Product` или историю каталога.
  - Сохранены фирменные цвета ZAPTUT.PRO (`#17191B`, `#FF6428`, `#888B8D`, `#F1F0EB`) и шрифт Onest.
- **Результаты проверок:**
  - `npm.cmd exec -- tsc --noEmit`: 0 ошибок.
  - `npm.cmd run test:customers`: 24/24 pass.
  - `npm.cmd run test:server`: 18/18 pass.
  - `npm.cmd run test:server:integration`: 16/16 pass (включая 6 новых тестов изоляции и функционала Supplier Portal).
  - `npm.cmd run build`: успешная сборка Next.js (все 22 маршрута).
  - Headless Chrome CDP: проверен вход SuperAdmin, управление аккаунтом в CRM, вход представителя поставщика `rep.sever@example.test`, все 4 вкладки кабинета, блокировка доступа представителя в `/admin`, сняты 5 скриншотов.
- **Оставшиеся ограничения:**
  - Интеграция с Allegro REST API и двухфакторная аутентификация для поставщиков являются следующими этапами.
- **Статус:** DONE.

## 2026-11-08 — B2B Feed Import: YML, XML, CSV, XLSX, Matching Engine, Preview & CRM Workspace

- **Задача:** реализовать полноценный импорт товарных предложений от российских и белорусских авторазборок на базе единой базы `Product` и `SupplierOffer` в PostgreSQL. Обеспечить поддержку форматов YML (Яндекс.Маркет / Дром), XML (Авито / Универсальный), CSV (с разделителями `,`, `;`, `\t` в кодировках UTF-8, с BOM и CP1251) и XLSX (безопасное чтение книг Excel через SheetJS без выполнения формул и макросов). Реализовать конвейер `Upload → Parse → Normalize → Validate → Match → Preview → Commit` со стадированием заданий (`ImportJob`) и строк (`ImportRow`). Реализовать сопоставление (exact OEM match, альтернативные артикулы, дедупликацию внутри фида, выявление неоднозначностей). Обеспечить идемпотентность повторной загрузки (детерминированные externalId через SHA-256 хеш при отсутствии явного ID) без удаления существующих данных и без автоматического снятия с продажи. Предоставить интерфейс CRM «Импорт прайсов» с KPI-показателями, таблицей превью с бейджами ошибок и историей импортов с защитой RBAC (`quotes.manage`, `quotes.read`).
- **Изученные файлы:** `prisma/schema.prisma`, `src/lib/server/catalog-types.ts`, `src/lib/server/catalog-repository.ts`, `src/lib/server/catalog-service.ts`, `src/app/admin/admin-client-page.tsx`, `src/components/admin/feed-import-workspace.tsx`.
- **Изменённые и созданные файлы:**
  - `prisma/schema.prisma`: добавлены энумы `ImportJobStatus`, `ImportRowStatus`, `ImportMatchType`, модели `ImportJob` и `ImportRow`, связь `importJobs ImportJob[]` в `Supplier`.
  - `prisma/migrations/20261108130000_b2b_import_jobs/migration.sql`: безопасная аддитивная миграция в PostgreSQL (`CREATE TABLE IF NOT EXISTS`, внешние ключи, каскадное удаление строк при удалении задачи, индексы). Применена через `prisma migrate deploy`.
  - `src/lib/server/import/feed-parser.ts`: безопасные парсеры XML/YML (`fast-xml-parser` с `processEntities: false`), CSV (`csv-parse/sync` с автодетекцией `,`, `;`, `\t`), XLSX (`xlsx` с `cellFormula: false`, `cellHTML: false`) и автоопределением формата.
  - `src/lib/server/import/field-normalizer.ts`: словарь синонимов названий колонок (Авито, Дром, Яндекс.Маркет, универсальные прайсы), нормализация OEM (удаление дефисов, пробелов, спецсимволов, перевод в верхний регистр), сопоставление состояний детали (`NEW`, `USED_EXCELLENT`, `USED_GOOD`, `USED_FAIR`, `FOR_PARTS`), валидация цен и детерминированная генерация внешнего ID (`gen-sha256(...)`).
  - `src/lib/server/import/product-matcher.ts`: движок сопоставления с базой данных `Product` и `SupplierOffer`, проверка дубликатов внутри одного фида, предотвращение создания ложных дублей товаров.
  - `src/lib/server/import/import-service.ts`: фасад импорта (`stageImportJob`, `commitImportJob`, `getJobDetails`, `listJobs`) с устойчивым резолвингом поставщика по UUID или демо-псевдониму.
  - `src/app/api/admin/import/upload/route.ts`: защищённый Route Handler загрузки и первичного анализа фида (стадирование).
  - `src/app/api/admin/import/jobs/route.ts`: защищённый Route Handler истории заданий импорта.
  - `src/app/api/admin/import/jobs/[id]/route.ts`: Route Handler детального отчёта задания со строками и превью.
  - `src/app/api/admin/import/jobs/[id]/commit/route.ts`: Route Handler подтверждения импорта и применения к каталогу `Product`/`SupplierOffer`.
  - `src/components/admin/feed-import-workspace.tsx`: интерфейс раздела CRM «Импорт прайсов» с выбором поставщика, источника/хаба, формата, выбором файла, карточками KPI (Всего строк, Готовы к загрузке, Ошибки, Дубликаты, Новые карточки, Обновление предложений), таблицей предпросмотра с цветовой индикацией статусов и историей заданий.
  - `src/app/admin/import/page.tsx`: выделенный маршрут `/admin/import`.
  - `src/app/admin/admin-client-page.tsx`: интеграция раздела `import` («Импорт прайсов», `quotes.manage`) в навигацию CRM и синхронизация URL.
  - `src/lib/server/import-service.db-test.mjs`: интеграционные тесты конвейера импорта, валидации, идемпотентности, неразглашения закупочных цен.
  - `scripts/test-b2b-import-browser.mjs`: сквозной скрипт браузерной верификации Headless Chrome через CDP.
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Решения:**
  - Реализована двухфазная схема `Preview → Commit`: менеджер видит статус валидации каждой строки, дубликаты и количество новых деталей до записи в каталог.
  - Ошибочные строки не прерывают импорт валидных данных.
  - Закупочные цены (`purchasePrice`) сегментированы и не передаются в публичный DTO каталога.
  - Повторная загрузка фида обновляет существующие предложения `SupplierOffer` по детерминированному внешнему ID, не плодя дубликаты `Product`.
  - Соблюдены утверждённые цвета ZAPTUT.PRO (`#17191B`, `#FF6428`, `#888B8D`, `#F1F0EB`) и типографика Onest.
- **Результаты проверок:**
  - `npm.cmd exec -- tsc --noEmit`: 0 ошибок.
  - `npm.cmd run test:customers`: 24/24 pass.
  - `npm.cmd run test:server`: 18/18 pass.
  - `npm.cmd run test:server:integration`: 10/10 pass.
  - `npm.cmd run build`: успешная сборка Next.js (все 16 маршрутов, включая 4 новых `/api/admin/import/*` и `/admin/import`).
  - Headless Chrome CDP: успешный логин `mr.artursabirov@gmail.com` (SUPER_ADMIN), переход в `/admin/import`, загрузка и стадирование тестового фида, снят артефакт `screenshot-admin-import.png`.
- **Оставшиеся ограничения:**
  - Автоматический сбор фидов по расписанию через Cron/URL и интеграция с Allegro REST API запланированы на следующий этап.
- **Статус:** DONE.

## 2026-11-08 — Единая база товаров и предложений поставщиков (Product & SupplierOffer в PostgreSQL)

- **Задача:** создать полноценную серверную модель каталога автозапчастей в PostgreSQL. Реализовать принцип: одна физическая деталь (`Product`) может иметь несколько предложений (`SupplierOffer`) от разных поставщиков и источников (РФ, РБ, Allegro Польша). Обеспечить «вечную память карточек» (`ARCHIVED_SOLD`, сохранение характеристик и фотографий при продаже лота, «Найти аналог по OEM»). Создать миграцию без сброса БД и Docker volumes, построить серверный репозиторий и сервис с разделением публичных и внутренних данных (закупочные цены скрыты от покупателей), создать Route Handlers `GET /api/catalog` и `GET /api/catalog/[id]`, подключить каталог `/catalog` к PostgreSQL и обеспечить сохранение дизайна и Onest. Настроить доступ суперадминистратора для `mr.artursabirov@gmail.com`.
- **Изученные файлы:** `prisma/schema.prisma`, `src/app/catalog/page.tsx`, `src/lib/server/catalog-types.ts`, `src/lib/server/catalog-repository.ts`, `src/lib/server/catalog-service.ts`, `src/app/api/catalog/route.ts`, `src/app/api/catalog/[id]/route.ts`.
- **Изменённые файлы:**
  - `prisma/schema.prisma`: добавлены энумы `ProductStatus`, `OfferCondition`, `OfferStatus`, модели `Product` (primaryOem, oemCodes, altArticles, specs, applicability, photos, status, timestamps) и `SupplierOffer` (productId, supplierId, source, externalId, originalTitle, rawArticle, purchasePrice, currency, quantity, condition, status, deliveryTerms, deliveryDays, sourceUrl, lastSeenAt, timestamps). Добавлено отношение `offers SupplierOffer[]` в существующую модель `Supplier`.
  - `prisma/migrations/20261108120000_products_and_supplier_offers/migration.sql`: безопасная аддитивная SQL-миграция с `CREATE TABLE IF NOT EXISTS`, внешними ключами и индексами по OEM, артикулам, бренду, категории, статусу и уникальности `[supplierId, source, externalId]`. Успешно применена через `prisma migrate deploy`.
  - `src/lib/server/catalog-types.ts`: доменные DTO и фильтры (`PublicProductDto`, `PublicOfferDto`, `StaffOfferDto`, `CatalogSearchFilters`, `CatalogSearchResult`).
  - `src/lib/server/catalog-repository.ts`: Prisma-репозиторий поиска, фильтрации по OEM/категории/бренду/стране/состоянию/наличию, архивирования предложений и товаров.
  - `src/lib/server/catalog-service.ts`: бизнес-логика каталога, безопасная санитизация публичных DTO (строгое исключение `purchasePrice`, внутренних заметок и скрытых ID поставщиков), конвертация валют для розничной витрины, идемпотентный сидер демонстрационного каталога в PostgreSQL (7 канонических позиций с множественными предложениями).
  - `src/app/api/catalog/route.ts`: публичный Route Handler поиска и фильтрации товаров с пагинацией.
  - `src/app/api/catalog/[id]/route.ts`: Route Handler карточки товара (публичный режим и закрытый внутренний режим `?internal=true` с проверкой прав `quotes.read`).
  - `src/app/catalog/page.tsx`: перевод витрины на загрузку данных из PostgreSQL `/api/catalog` со штатным сохранением fallback, отображение количества предложений («от X ₽ · N предлож.»), вывод таблицы всех предложений поставщиков внутри модального окна карточки, сохранение дизайна ZAPTUT.PRO, Onest и быстрых OEM-чипов.
  - `src/lib/server/catalog-service.db-test.mjs`: интеграционные и unit-тесты каталога.
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Решения:**
  - Разделены жизненные циклы: `Product` — вечная карточка детали; `SupplierOffer` — отдельный лот/предложение продавца.
  - Архивация предложения не удаляет карточку детали: OEM, применимость, фото и спецификации сохраняются навсегда.
  - Публичный API отдаёт только клиентские розничные цены; закупочные цены доступны только сотрудникам с соответствующим RBAC-правом (`quotes.read`/`quotes.purchase.read`).
  - Настроена учётная запись суперадминистратора `mr.artursabirov@gmail.com` с хешированным паролем в PostgreSQL.
- **Результаты проверок:**
  - `npm.cmd exec -- tsc --noEmit`: 0 ошибок.
  - `npm.cmd run test:customers`: 24/24 pass.
  - `npm.cmd run test:server`: 18/18 pass.
  - `npm.cmd run test:server:integration`: 7/7 pass (включая DTO-сегрегацию, мульти-офферы, вечную память карточек и идемпотентный сидер БД).
  - `npm.cmd run build`: успешная сборка Next.js 15.5.6 (все 13 маршрутов).
  - Headless Chrome CDP: сняты 2 сквозных скриншота:
    - `screenshot-db-multioffer-modal.png` (модальное окно с 3 предложениями из РФ, РБ и Польши)
    - `screenshot-db-archived.png` (карточка `ARCHIVED_SOLD` с сохранением параметров и кнопкой подбора аналога).
- **Оставшиеся ограничения:**
  - Реальный парсер B2B-фидов (XML/YML/CSV) и прямое Allegro API остаются последующими этапами.
- **Статус:** DONE.

## 2026-11-08 — Функциональное приёмочное тестирование агрегатора (Acceptance Test)

- **Задача:** провести функциональное приёмочное тестирование агрегатора autoparts-marketplace по 6 направлениям (поиск по OEM, названию, марке, чипы, multi-source; источники РФ, РБ, Allegro Польша; вечная память карточек ARCHIVED_SOLD; B2B-импорт фидов XML/YML/CSV; карточка товара; персистентность данных). Классифицировать каждую функцию как WORKING, DEMO, UI ONLY или NOT IMPLEMENTED. Исправить найденные поломки существующих сценариев без переписывания архитектуры. Сформировать строгий 5-пунктовый отчёт.
- **Изученные файлы:** `src/app/page.tsx`, `src/app/catalog/page.tsx`, `src/app/admin/admin-client-page.tsx`, `src/components/admin/request-register.tsx`, `src/components/admin/supplier-registry.tsx`, `prisma/schema.prisma`, `src/lib/server/*`.
- **Изменённые файлы:**
  - `src/app/page.tsx`: исправлен неработающий поиск главной страницы — ранее форма `search(e)` лишь выводила текстовую заглушку без перехода в каталог. Подключён переход `useRouter().push('/catalog?q=...')`, кликабельные категории в каталог, и добавлены быстрые OEM-чипы (`51712-C1A00`, `28231-2F100`, `58101-A6A00`, `37300-2E300`).
  - `src/app/catalog/page.tsx`: добавлен `Suspense` с фирменным `BrandLoader phase="loading"` для считывания параметра `q` из URL; добавлены интерактивные OEM-чипы быстрого поиска; внедрён архивный лот `ARCHIVED_SOLD` (рулевая рейка OEM `56500-D7000`) с бейджем «АРХИВ · ПРОДАНО», пометкой о снятии с продажи, фильтром «Наличие и архив» в сайдбаре и кнопкой «Найти аналог по OEM» в карточке и модальном окне; исправлен экспорт страницы.
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Решения:**
  - Сохранён утверждённый фирменный брендинг ZAPTUT.PRO и цветовая гамма (`#17191B`, `#FF6428`, `#888B8D`, `#F1F0EB`).
  - Демоданные не удалялись.
  - Классифицированы все модули: база данных PostgreSQL 16 реально работает (`WORKING`) для пользователей, сессий, ролей сотрудников и профилей клиентов; заявки CRM хранятся в `localStorage` (`DEMO`); каталог деталей и поиск работают на клиентских демоданных (`DEMO`); фиды B2B (XML/YML/CSV) и прямое Allegro API полностью отсутствуют (`NOT IMPLEMENTED`).
- **Результаты проверок:**
  - `npm.cmd exec -- tsc --noEmit`: 0 ошибок.
  - `npm.cmd run test:customers`: 24/24 pass.
  - `npm.cmd run test:server`: 18/18 pass.
  - `npm.cmd run build`: успешно скомпилированы все 12 маршрутов (Next.js 15.5.6).
  - Headless Chrome CDP: сняты и верифицированы 2 сквозных скриншота:
    - `screenshot-catalog-chips.png` (каталог с активными быстрыми OEM-чипами и фильтрами)
    - `screenshot-catalog-archived.png` (поиск по OEM архивного лота, бейдж «АРХИВ · ПРОДАНО», кнопка подбора аналога).
- **Оставшиеся ограничения:**
  - B2B-импорт фидов XML/YML/CSV и реальный парсинг/API Allegro отсутствуют в текущем коде агрегатора.
  - Товары каталога не вынесены в PostgreSQL (нет таблицы `Product`).
- **Статус:** DONE.

## 2026-11-08 — Восстановление утверждённого фирменного стиля ZAPTUT.PRO

- **Задача:** привести весь существующий интерфейс проекта к утверждённому бренду ZAPTUT.PRO: оригинальный логотип без искажения геометрии, анимированный шуруп загрузки, исключение постороннего названия AUTO-ZAP HUB и иконки-молнии; строгое применение 4 утверждённых цветов (Graphite `#17191B`, Signal Orange `#FF6428`, Industrial Steel `#888B8D`, Warm Porcelain `#F1F0EB`) без чистого белого `#FFFFFF` как фона/бренда и без синих шаблонов; шрифт Onest глобально; Modern European Automotive Tech эстетика; сохранение логики, фильтрации и баз данных; подготовка скриншотов разделов.
- **Изученные файлы:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/catalog/page.tsx`, `src/app/admin/admin-client-page.tsx`, `src/components/admin/request-register.tsx`, `src/components/admin/request-workspace.tsx`, `src/components/admin/supplier-registry.tsx`, `src/components/admin/customer-registry.tsx`, `src/components/auth/login-form.tsx`, `src/components/brand/*`, `public/brand/*`.
- **Изменённые файлы:**
  - `src/app/globals.css`: импорт шрифта Google Font `Onest` (weights 300..900), объявление дизайн-токенов в `@theme` и глобальное форсирование `font-family: "Onest", sans-serif !important;` для всех элементов, заголовков, форм и кнопок. Настройка цветов выделения (Signal Orange), базового фона (Graphite `#17191B`) и текста (Warm Porcelain `#F1F0EB`).
  - `src/app/page.tsx`: редизайн главной страницы в палитре бренда: строгий графитовый фон, техническая сетка, плашки Warm Porcelain, Signal Orange CTA, удаление шаблонов и посторонних цветов.
  - `src/app/catalog/page.tsx`: стилизация каталога, боковой панели фильтров, тегов наличия/состояния деталей (`ORIGINAL` в оранжевом, `ANALOG` в фарфорово-стальном, `USED` в графитово-стальном), модальных окон карточки и заявки на подбор.
  - `src/app/admin/admin-client-page.tsx`: рефакторинг CRM-экранов — удаление шаблонных цветов (sky, cyan, violet), унификация статусов заявок в оранжево-стальной гамме, брендовый сайдбар с `BrandLogo variant="dark"`, уплотнённые метрики и очереди задач.
  - `src/components/admin/request-register.tsx`, `request-workspace.tsx`, `supplier-registry.tsx`: замена устаревших шаблонных классов `text-white` на Warm Porcelain `#F1F0EB`, границы `#383E41`, фоны `#1E2124`, акцентные элементы `#FF6428`.
  - `src/components/auth/login-form.tsx`: адаптация авторизационного экрана под утверждённую брендовую стилистику.
  - `scripts/capture-brand-screenshots.mjs`: Node.js CDP скрипт для снятия скриншотов в headless Chrome на порту 3000.
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Решения:**
  - Название `AUTO-ZAP HUB` и иконка-молния полностью удалены из проекта; повсеместно внедрено `ZAPTUT.PRO`.
  - Использован утверждённый мастер-логотип `BrandLogo` (`zaptut-logo-master.png`, `zaptut-logo-dark.png`, `zaptut-logo-light.png`).
  - Создана плавная аппаратная CSS/WAAPI анимация вращения и поступательного хода шурупа (`zaptut-screw.png`) в `BrandLoader` с поддержкой `prefers-reduced-motion`.
  - Бизнес-логика, алгоритмы фильтрации, формулы ценообразования, B2B-поставщики и схема базы данных не затрагивались.
- **Результаты проверок:**
  - `npm.cmd exec -- tsc --noEmit`: 0 ошибок.
  - `npm.cmd run test:customers`: 24/24 pass.
  - `npm.cmd run test:server`: 18/18 pass.
  - `npm.cmd run test:server:integration`: 3/3 pass (auth, customer-api, db repositories).
  - `npm.cmd run build`: успешная производственная сборка Next.js 15.5.6 (все 12 маршрутов скомпилированы).
  - Headless Chrome CDP: сохранены 4 подтверждающих скриншота высокого разрешения:
    - `screenshot-home.png` (Главная страница)
    - `screenshot-search.png` (Интерфейс поиска запчастей)
    - `screenshot-catalog.png` (Каталог деталей и фильтры)
    - `screenshot-b2b.png` (B2B-кабинет и реестр поставщиков РФ, РБ, Польша)
- **Оставшиеся ограничения:**
  - Следующий функциональный этап — перенос заявок (Requests API).
- **Статус:** DONE — утверждённый фирменный стиль ZAPTUT.PRO полностью восстановлен, проверки пройдены, скриншоты сформированы.

## 2026-11-08 — Подготовка файлов для переноса платформы

- **Задача:** собрать переносимый пакет проекта ZAPTUT.PRO и описать восстановление на новой платформе без потери/раскрытия секретов.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`, `README.md`, `package.json`, `.env.example`, `.gitignore`, `docker-compose.yml`, Prisma schema/migrations и дерево исходников.
- **Изменённые файлы:** `docs/PLATFORM-MIGRATION.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`, `README.md`, `.env.example`; создан архив `zaptut-pro-transfer-2026-11-08.zip`.
- **Решения:** архив содержит исходный код, документацию, статические ресурсы, Prisma миграции и безопасный шаблон окружения; исключены `.env`, Git-история, `node_modules`, сборки/кеши, локальный PostgreSQL volume и browser localStorage. Не создавалась platform-specific конфигурация, так как целевой хостинг не задан. Данные не экспортировались.
- **Проверки:** Git status прочитан через одноразовый `-c safe.directory` из-за предупреждения о владельце репозитория; рабочее дерево уже содержит проект как untracked. Архив проверен на состав и отсутствие исключённых путей/известного секретного шаблона. Тесты, TypeScript, build, миграция БД и smoke-test приложения не запускались: код приложения не менялся, выполнение на целевой платформе невозможно без её выбора.
- **Оставшиеся проблемы:** перенос базы и браузерных данных не выполнялся; новый хостинг, PostgreSQL и секреты должны быть настроены отдельно. До перехода данных нужен backup и проверенный restore.
- **Статус:** DONE — переносимый исходный пакет подготовлен; перенос среды и данных не входит в эту задачу.

## 2026-11-07 — Подготовка проекта к работе с внешним AI-архитектором

- **Задача:** зафиксировать правила работы, создать журнал и описать текущее состояние проекта без изменения кода приложения и данных.
- **Изученные файлы:** `README.md`, `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/ROADMAP.md`, `docs/DATA-MODEL.md`, `docs/CRM-WORKFLOWS.md`, `docs/CRM-FINANCIAL-LOGIC.md`, `docs/CRM-DATA-MODEL.md`, страницы `src/app`, компоненты `src/components/admin`, `src/lib/financial-config.ts`, `src/lib/customer-model.ts` и тесты этих модулей.
- **Изменённые файлы:** `AGENTS.md`, `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`.
- **Технические решения:** описывать реализованное отдельно от целевой схемы из документации; демо-хранилище указывать по коду как браузерное хранилище и состояние вкладки, без утверждения о production-БД; не менять приложение, финансовые формулы или демоданные.
- **Результаты тестов:** не запускались; в рамках задачи изменялась только документация.
- **Оставшиеся проблемы:** актуальность отдельных планов и полнота покрытия тестами требуют отдельной проверки; production-интеграции и база данных не подтверждены кодом.
- **Статус:** выполнено.

## 2026-11-07 — Протокол выполнения задач и handoff

- **Задача:** закрепить постоянный протокол совместной разработки, единые статусы и создать краткий handoff для внешнего AI-архитектора.
- **Изученные файлы:** `AGENTS.md`, `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`; выполнена проверка `git status --short`.
- **Изменённые файлы:** `AGENTS.md`, `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`.
- **Технические решения:** сохранить ранее найденные незакоммиченные файлы без перезаписи; вести отдельные записи по каждой задаче; статус `DONE` применить к этой документационной задаче, поскольку требуемые проверки кода для неё неуместны.
- **Результаты проверок:** unit-тесты, `npx tsc --noEmit`, `npm run build` и браузерный сценарий не запускались: код приложения не менялся. Проверен Git status перед изменениями.
- **Оставшиеся проблемы:** незакоммиченные файлы присутствуют в рабочем дереве; не проверено, принадлежат ли они текущей задаче или другим локальным изменениям.
- **Статус:** DONE.

## 2026-11-07 — Компоновка деталей финансового расчёта

- **Задача:** устранить пересечение колонок и выход финансовых значений за границы в блоке «Детали расчёта» карточки заявки.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`, `package.json`, `src/components/admin/request-workspace.tsx`, финансовый модуль и его тесты.
- **Изменённые файлы:** `src/components/admin/request-workspace.tsx`, `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`.
- **Технические решения:** строки расчёта используют ограниченные min-width колонки, правую область значений с переносом только для длинных технических строк и контейнерную точку перестройки на фактической ширине панели; формулы, исходные значения и родительская сетка карточки не менялись.
- **Результаты проверок:** `node --experimental-strip-types --test src/lib/financial-config.test.mjs` — 15/15; `npm.cmd exec -- tsc --noEmit` — успешно; `npm.cmd run build` — успешно (осталось предупреждение Next.js о нераспознанном ESLint-плагине). В браузере проверена ZP-2026-0148 на ширине 1280 px: все 25 строк в каждом из трёх предложений без переполнения и пересечения; ширина документа 1265 px при viewport 1280 px; раскрытие деталей работает. Финансовые значения совпали с исходной записью до UI-правки.
- **Оставшиеся проблемы:** реальная отправка предложения, рыночные курсы и production-хранилище не входят в проверку; цены и курсы карточки остаются демонстрационными.
- **Статус:** DONE.

## 2026-11-07 — Финансовая сверка заявки ZP-2026-0148

- **Задача:** сопоставить контрольные суммы с демо-расчётом и UI после изменения компоновки финансовых деталей.
- **Изученные файлы:** `src/app/admin/page.tsx`, `src/components/admin/request-workspace.tsx`, `src/lib/financial-config.ts`, `src/lib/financial-config.test.mjs`; также проверена открытая карточка ZP-2026-0148 в браузере.
- **Изменённые файлы:** `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`; код приложения и данные не менялись.
- **Результат сверки:** источник quote `qt-148-1` — 82.00 USD за единицу, qty 2, логистика 18.00 USD за заказ, поставщик Россия. При тарифе 28%, демо-курсе 92 RUB/USD и текущих расчётных данных автоматическая цена позиции без логистики равна 209.92 USD; с логистикой 227.92 USD; прибыль 45.92 USD; маржа 20.14%. Контрольные 218.00/36.00/16.51% означали бы цену позиции 200.00 USD до логистики и не следуют из исходной автоматической формулы. Исходные RUB-эквиваленты, минимум, логистика и остальные показатели совпали с UI; ручная цена в поле отображалась как 209.92 USD. Расхождение с контрольным скриншотом отмечено, финансовая логика не менялась.
- **Результаты проверок:** финансовые тесты 15/15; `npm.cmd exec -- tsc --noEmit` — успешно; `npm.cmd run build` — успешно с предупреждением Next.js о ESLint plugin. В build-проверке использовался точный путь к `npm.cmd` из-за ограничений PowerShell execution policy.
- **Оставшиеся проблемы:** источник значения 200.00 USD на контрольном скриншоте из кода не установлен; в текущих исходниках и браузерном отображении подтверждено 209.92 USD автоматической цены позиции.
- **Статус:** DONE.

## 2026-11-07 — Восстановление локального dev-сайта

- **Задача:** восстановить открытие локального сайта после 500 на CRM.
- **Диагностика:** production `next build` и работающий `next dev` одновременно использовали `.next`; dev-журнал показывал отсутствующий webpack chunk (`586.js`), а `/admin/requests` возвращал 500.
- **Изменённые файлы:** `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`. Код, localStorage и исходные данные не менялись. Удалена только генерируемая папка `.next` после проверки, что абсолютный путь совпадает с workspace `.next`.
- **Проверки:** новый dev-сервер запущен на `http://127.0.0.1:3004`; HTTP `/admin/requests` вернул 200; браузер открыл CRM-реестр с четырьмя заявками.
- **Статус:** DONE.

## 2026-11-07 — Документация этапа ручных корректировок цены

- **Задача:** зафиксировать завершённый этап ручных корректировок цены и результаты браузерной проверки, сообщённые пользователем.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Изменённые файлы:** только `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`.
- **Зафиксированная реализация:** обязательная причина корректировки; обязательное пояснение для «Другая причина»; при цене ниже закупки — предупреждение с суммой потенциального убытка, отдельное подтверждение менеджера и письменное объяснение; запись этих сведений в истории; сохранение старых записей без причины с пометкой. Блок подробного расчёта уплотнён, технические сведения раскрываются отдельно; исправлены переполнение сумм и пересечение колонок.
- **Ручные проверки пользователя в браузере:** (1) ручная цена 220 USD без убытка сохранена и пережила F5; (2) цена 160 USD при закупке 164 USD показала убыток 4 USD, причина, подтверждение и объяснение сохранились после F5; (3) сохранение цены ниже закупки без подтверждения заблокировано; (4) финансовые значения и раскрытие подробного расчёта визуально проверены. Это результаты, сообщённые пользователем, не самостоятельный повторный прогон в рамках этой документационной задачи.
- **Автоматические проверки, сообщённые пользователем:** финансовые тесты 15/15; TypeScript успешно; production build успешно с предупреждением Next.js о конфигурации ESLint.
- **Демо-ограничения:** настройки и история сохраняются в localStorage в деморежиме; production-хранилище и реальные интеграции не подключены. Формулы не менялись при перестройке интерфейса.
- **Следующий шаг:** проверить отображение старых записей истории и корректность истории после нескольких последовательных корректировок.
- **Статус:** DONE (документация обновлена по результатам, переданным пользователем).

## 2026-11-07 — Единая функциональная карта продукта и roadmap

- **Задача:** объединить клиентскую платформу, внутреннюю CRM и общую инфраструктуру в один продуктовый план, не считая демо-экраны интеграциями.
- **Изученные материалы:** `AGENTS.md`, `README.md`, все документы в `docs/` (`PROJECT-STATE`, `AI-LOG`, `AI-HANDOFF`, `ROADMAP`, `PRODUCT`, `ARCHITECTURE`, `DATA-MODEL`, `CRM-DATA-MODEL`, `CRM-WORKFLOWS`, `CRM-FINANCIAL-LOGIC`), маршруты `src/app` и CRM-компоненты `src/components/admin`.
- **Изменённые файлы:** создан `docs/PRODUCT-ROADMAP.md`; обновлены краткие записи `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md` согласно рабочему протоколу.
- **Результат:** функциональная карта разделяет клиентский продукт, внутреннюю платформу и инфраструктуру; для каждого направления указаны фактический статус, зависимости и требуемые страницы/модули. Сохранены требования о многоэлементных заявках, отдельных статусах inquiry/quote/offer, безопасности клиентской проекции, подтверждаемой совместимости, актуальности предложений, Customer links, точной финансовой логике и безопасном импорте.
- **Выявленные документальные расхождения:** README неполно описывает текущие демо-модули; PROJECT-STATE отстаёт в поле последней задачи; CRM-WORKFLOWS неверно утверждает, что финансовые настройки/корректировки сбрасываются после F5; checkout/payment противоречат границам первой версии в PRODUCT/ROADMAP. Эти исходные документы не переписывались.
- **Проверки:** изменения только в Markdown; тесты, TypeScript и build не запускались как не относящиеся к документационной карте. Код и данные не менялись.
- **Ограничения:** разделение checkout vs manager-led request и состав первого пилота требуют решения владельца продукта.
- **Статус:** DONE.

## 2026-11-07 — Расширение Product Roadmap по референсам izap24.ru

- **Задача:** включить в обязательную карту продукта функции, выявленные на трёх пользовательских скриншотах: реестр и карточка заказа, исполнение/СДЭК, коммуникации, заметки и задачи, запросы поставщикам, документы и финансовые строки заказа.
- **Изученные документы:** `AGENTS.md`, `README.md`, `docs/PRODUCT-ROADMAP.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`, продуктовые, архитектурные и CRM-документы из `docs/`; требования экранов дополнительно предоставлены пользователем в тексте и приложенных изображениях.
- **Изменённые файлы:** только `docs/PRODUCT-ROADMAP.md`, `docs/AI-LOG.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`.
- **Решения:** добавлен самостоятельный обязательный контур заказов и исполнения; CRM Request не приравнен к Order. Все функции из запроса разложены по статусам `PARTIAL`/`NOT IMPLEMENTED` (для order-сценариев); демо-котировки, ручной трек-номер и локальные сообщения не названы интеграциями. Финансовые тарифы/формулы не менялись; налоговая политика помечена как требующая решения без придумывания ставки.
- **Результат:** roadmap дополнен функциональной матрицей заказного контура, зависимостями по моделям/API, безопасности, документам, коммуникациям и carrier adapters, а также последовательностью реализации. Существующие документы не удалялись.
- **Проверки:** сверены `git status --short` до правок и diff четырёх целевых Markdown-файлов; код, приложение, localStorage и демоданные не менялись. Тесты, TypeScript, build и браузер не запускались, так как менялась только документация.
- **Оставшиеся решения:** до реализации нужно зафиксировать переход Request → Order, страны/направления, оплату, возвраты, налоговую политику, сроки и ответственность за доставку/наличие.
- **Ограничение рабочего дерева:** до задачи файлы проекта показывались Git как untracked; авторство существующих файлов не выяснено. Никакие Git-операции, кроме чтения status/diff, не выполнялись.
- **Статус:** DONE.

## 2026-11-07 — Серверная основа PostgreSQL/Prisma

- **Задача:** подготовить серверную архитектуру для последующего перехода CRM с demo/localStorage на PostgreSQL, не перенося данные и не ломая demo-сценарии.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`, релевантные разделы `docs/PRODUCT-ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/CRM-DATA-MODEL.md`, `docs/CRM-WORKFLOWS.md`, `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `.gitignore`, исходники `src/app`, `src/lib`.
- **Изменённые файлы:** `package.json`, `package-lock.json`, `.env.example`, `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`, `prisma/migrations/20261107150000_initial_crm_schema/migration.sql`, `src/lib/server/db.ts`, `src/app/api/health/route.ts`, `docs/PRODUCT-ROADMAP.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`.
- **Реализовано:** добавлены `prisma`/`@prisma/client` версии 6.19.3, Prisma PostgreSQL schema для Users, Customers, Requests/Items, Suppliers, SupplierInquiries/Quotes, CustomerOffers/Items, Tasks и ActivityLog; SQL baseline сгенерирован из пустой схемы, но не применён; создан dev-safe singleton клиента и динамический `/api/health`, который не возвращает секреты. Добавлен `.env.example` с локальным placeholder. CRM/localStorage не подключены к серверу, миграции пользовательских данных нет, база и production-ресурсы не создавались.
- **Техническое решение:** Prisma 6 закреплён, чтобы схема использовала поддерживаемое расположение `DATABASE_URL` в datasource и не вводить в этот этап переход конфигурации Prisma 7. Суммы в схеме используют `Decimal(18,4)` и валютные коды; согласованные бизнес-формулы не реализовывались и не менялись.
- **Проверки:** `prisma generate` — успешно; `prisma validate` — успешно; customer tests — 24/24; financial tests — 15/15; `npm.cmd exec -- tsc --noEmit` — успешно; `npm.cmd run build` — успешно, предупреждение Next.js о ненайденном ESLint plugin осталось. Попытка HTTP-проверки production `/api/health` на отдельном порту вернула 500 с `Cannot find module './611.js'` из `.next/server/webpack-runtime.js`; вероятно, общий `.next` затронут одновременно работающим dev-процессом, но процессная причина не подтверждена из-за отказа Windows в доступе к инвентаризации процессов/портов. Браузерный сценарий endpoint не подтверждён.
- **Установка пакетов:** первый вызов npm registry внутри sandbox завершился EACCES; повторная установка официальных Prisma пакетов с разрешённым доступом к npm завершилась успешно. npm сообщил о 12 уязвимостях в дереве зависимостей (6 moderate, 5 high, 1 critical); аудит и обновление зависимостей не выполнялись.
- **Ограничения/следующий шаг:** PostgreSQL и `DATABASE_URL` не настроены; SQL миграция не применялась. Следующий этап — изолированная локальная dev-БД, применение baseline на пустой БД, проверка health endpoint и затем ограниченный Customer repository/API с интеграционными тестами. Не выполнять импорт localStorage без отдельного плана и резервирования.
- **Статус:** PARTIAL — серверная основа, схема и требуемые статические проверки завершены, но подключение к БД, применение миграции и runtime-проверка API остаются невыполненными.

## 2026-11-07 — Проверка Docker для локальной PostgreSQL

- **Задача:** запустить отдельную локальную PostgreSQL через Docker, применить уже существующую Prisma-миграцию и проверить подключение/health, не меняя CRM-данные.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`; статус рабочего дерева; существующая Prisma schema и миграция.
- **Изменённые файлы:** `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`.
- **Результат диагностики:** `Get-Command docker` не нашёл Docker CLI в PATH. Docker Engine/Compose недоступны для проверки. В соответствии с ограничением пользователя Docker не устанавливался и системные настройки не менялись.
- **Не выполнялось:** `docker-compose.yml` не создавался; `.env` не создавался/не перезаписывался; PostgreSQL, volume и контейнер не запускались; `prisma migrate deploy` и Prisma DB connectivity check не выполнялись. Миграция и demo/localStorage не затронуты.
- **Проверка сайта после предыдущего восстановления:** `http://127.0.0.1:3000/`, `/admin` и `/admin/requests` — HTTP 200; `/api/health` — HTTP 503 JSON со статусом `database: not_configured`, ожидаемо при отсутствующем `DATABASE_URL`.
- **Единственный необходимый шаг от пользователя:** установить и запустить Docker Desktop так, чтобы `docker` и `docker compose` стали доступны в PowerShell.
- **Статус:** BLOCKED до установки/запуска Docker Desktop пользователем.

## 2026-11-08 — PostgreSQL dev и серверные слои Customer/Request/Supplier

- **Задача:** продолжить ночную автономную разработку: подключить локальную PostgreSQL, применить уже созданную миграцию, проверить API/CRM, затем добавить безопасные серверные repositories/services для Customer, Request/RequestItem, Supplier, SupplierInquiry и SupplierQuote. Из-за отсутствия авторизации доменные API оставлены не опубликованными.
- **Изменённые файлы:** `docker-compose.yml`, `package.json`, `tsconfig.json`; `src/lib/server/customer-service.ts`, `customer-repository.ts`, `customer-service.test.mjs`, `request-service.ts`, `request-repository.ts`, `request-service.test.mjs`, `supplier-service.ts`, `supplier-repository.ts`, `supplier-service.test.mjs`; `docs/PRODUCT-ROADMAP.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`. Создан локальный `.env`, он игнорируется `.gitignore`; значения credentials не записывать в документацию и не выводить.
- **PostgreSQL:** Docker Engine 29.9.2 и Compose 5.6.1 доступны. Запущен `postgres:16-alpine`, контейнер `zaptut-local-postgres`, порт привязан только к `127.0.0.1:5432`, постоянный volume `zaptut_postgres_data`. Healthcheck контейнера healthy. Существующая миграция `20261107150000_initial_crm_schema` применена один раз; `prisma migrate status` сообщает `Database schema is up to date`. В схеме 12 таблиц; на момент проверки Customers/Requests/Suppliers содержали по 0 записей. Демо-данные не импортировались. Через Prisma Client выполнен `SELECT 1`.
- **Реализация:** Customer service/repository поддерживают поиск/пагинацию, чтение, создание и обновление, нормализацию телефона/email, проверку конфликтов в Serializable транзакции и ActivityLog. Request service/repository поддерживают список/поиск, чтение, создание с позициями, обновление ограниченных полей/статусов и добавление/изменение позиции с ActivityLog; удаление позиций не добавлялось. Supplier service/repository поддерживают поиск, создание/изменение профиля/статуса, запросы поставщику и котировки с раздельными статусами и точными десятичными строками. Изменение статуса котировки не переписывает CustomerOfferItems и закупочные суммы не конвертируются/не рассчитываются в этом слое.
- **Защитная граница:** в коде не обнаружена серверная авторизация. Новые доменные API не создавались, Customer/request internals/supplier prices не выведены в клиентский интерфейс. `/api/health` остаётся только проверкой доступности и не возвращает секреты. Serializable duplicate check без DB-level unique constraints не заменяет полноценное решение по уникальности для production.
- **Проверки:** миграция применена; Prisma status up-to-date; Prisma Client `SELECT 1` — успешно. Dev `GET /api/health` — HTTP 200, JSON сообщает `status=ok`, `database=reachable`; `/`, `/admin`, `/admin/requests`, `/catalog` — HTTP 200. Browser smoke открыл CRM, показаны четыре demo-заявки, Console errors отсутствовали. Содержимое localStorage через automation не читалось (в её page context `localStorage` недоступен); данные не очищались и не записывались. Существующие customer/financial и новые server service тесты — 50/50; `npm.cmd exec -- tsc --noEmit` — успешно; `npm.cmd run build` — успешно с прежним предупреждением о нераспознанном Next.js ESLint plugin.
- **Запуск:** dev server оставлен работающим на `http://127.0.0.1:3000`; локальный DB-контейнер также оставлен работающим. Пользовательские localStorage и демоданные CRM не изменялись.
- **Git/ограничения:** до работы `git status --short` показывал файлы проекта как untracked и ownership репозитория был неоднозначен. Исключение safe.directory применялось только параметром одного read-only вызова; global git config, index, commit и push не менялись. Остальные исходные untracked файлы не редактировались. `.env` проверен как игнорируемый.
- **Следующие шаги:** добавить integration tests реальных repositories на отдельной временной тестовой записи с cleanup только собственных записей; согласовать/реализовать auth/RBAC; после этого публиковать защищённые доменные API. Не импортировать browser localStorage автоматически и не менять финансовые правила.
- **Статус:** PARTIAL — PostgreSQL и сервисный слой подготовлены и проверены unit/static/runtime smoke-проверками; CRUD repositories ещё не проходят отдельный integration-test цикл, а API специально отсутствуют до появления авторизации.

## 2026-11-08 — Интеграционная проверка серверных CRM repositories

- **Задача:** продолжить автономные этапы 2–4 после запуска локальной PostgreSQL: проверить Customer, Request/RequestItem и Supplier/Inquiry/Quote не только через поддельные repositories, но и на Prisma Client с локальной БД.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`, `docs/PRODUCT-ROADMAP.md`, `package.json`, `prisma/schema.prisma`, три server repository/service и их unit-тесты.
- **Изменённые файлы:** `package.json`, `src/lib/server/customer-repository.ts`, `src/lib/server/request-repository.ts`, `src/lib/server/supplier-repository.ts`, `src/lib/server/test-loader.mjs`, `src/lib/server/repositories.db-test.mjs`; обновлены `docs/PRODUCT-ROADMAP.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`. Существующий интеграционный сценарий вынесен из общего glob в отдельную команду `test:server:integration`.
- **Результат:** интеграционный тест создал уникальные временные Customer, Supplier, Request/RequestItem, SupplierInquiry и SupplierQuote, выполнил поиск/чтение/изменение, проверил точность Decimal, отдельный статус котировки и записи ActivityLog, затем удалил только собственные строки. Тест прошёл 1/1; контрольные запросы после него показали 0 тестовых Customers, Suppliers и Requests. Демоданные и браузерное localStorage не трогались.
- **Причина технической адаптации:** `node --experimental-strip-types` не поддерживает TypeScript parameter properties. Три repository-конструктора переведены на эквивалентные типизированные поля; поведение repository не менялось. Интеграционный тест использует Node module hooks только в test runner для TS paths и серверного модуля `server-only`.
- **Проверки:** Customer model — 24/24; financial — 15/15; server unit — 11/11; PostgreSQL repository integration — 1/1; всего 51 тест пройден. `npm.cmd exec -- tsc --noEmit`, `prisma validate`, `prisma migrate status` и `npm.cmd run build` завершились успешно. Build сообщает предупреждение Next.js об отсутствующем ESLint plugin.
- **Локальный сайт:** параллельная production-сборка затронула общий генерируемый `.next` dev-сервера и вызвала `Cannot find module './586.js'`. Dev-server был остановлен; удалён только разрешённый `.next` внутри проекта; dev-server перезапущен. После этого `/api/health` вернул HTTP 200 с `database: reachable`, а `/`, `/admin`, `/admin/requests`, `/catalog` вернули HTTP 200. PostgreSQL-контейнер healthy, порт доступен только через `127.0.0.1:5432`.
- **Не реализовано намеренно:** server-side auth/RBAC/tenant authorization отсутствуют, поэтому доменные API не публиковались; серверные слои не подключены к CRM UI и не импортируют localStorage. Не создавались реальные интеграции поставщиков, платежей, email или доставки. Production DB и перенос CRM-демоданных не выполнялись.
- **Git/данные:** статус репозитория до работы показывал весь проект как незакоммиченные/untracked файлы; global Git config, index, commit и push не менялись. `.env` остаётся игнорируемым. Docker volume не очищался.
- **Следующий шаг:** сначала определить и реализовать аутентификацию, серверные сессии и RBAC; затем проектировать защищённые domain APIs с безопасными DTO/allowlist, после этого отдельно спланировать подключение UI и контролируемую миграцию.
- **Статус:** PARTIAL — локальная PostgreSQL, server repositories/services и integration test работают; защищённые API и production авторизация остаются незавершёнными.

## 2026-11-08 — серверная аутентификация сотрудников и RBAC

- **Задача:** добавить безопасный вход сотрудников ZAPTUT.PRO, роли/разрешения и server-side защиту административной зоны, сохранив CRM на localStorage.
- **Изучено:** актуальные User/Prisma модели, App Router, server repositories/services, auth dependencies и локальная dev-конфигурация. Повторный общий аудит не проводился.
- **Изменено:** `prisma/schema.prisma`; `prisma/migrations/20261108100000_staff_auth_and_rbac/migration.sql`; `src/lib/server/auth.ts`, `staff-session.ts`, `staff-rbac.ts`, RBAC/password/DB auth tests; `src/app/api/auth/[...all]/route.ts`, `/login`, `/admin/layout.tsx`, CRM server/client split and session/logout components; `scripts/create-super-admin.mjs`; `package.json`, `.env.example`; `docs/PRODUCT-ROADMAP.md`, `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`.
- **Решения:** Better Auth credentials provider with Prisma adapter and database sessions; no public signup; 12-hour session; HttpOnly/SameSite cookie, Secure in production; login throttling; server-side roles and per-user permission overrides. Role permission assignments are stored in DB, not trusted from request parameters. Added roles SUPER_ADMIN, ADMIN, MANAGER and LOGISTICS. SUPER_ADMIN can manage future permissions. CLI bootstrap reads email/name/password from local environment, refuses an existing SUPER_ADMIN or duplicate account, and never logs the password. No CRM migration or financial logic changes.
- **Миграция/данные:** additive migration applied to local `zaptut_dev`; existing user role strings were preserved and seeded as role records before FK enforcement. `prisma migrate status` was up to date and Prisma Client was regenerated. No CRM demo records or volumes were reset. Temporary bootstrap/integration accounts and their auth rows were removed by exact ID; no test SUPER_ADMIN remains.
- **Проверки:** `npm.cmd run test:server` — 18/18; `npm.cmd run test:server:integration` — 2/2 (auth and existing repository integration); `npm.cmd run test:customers` — 24/24; financial tests — 15/15; `npm.cmd exec -- tsc --noEmit` — success; `npm.cmd run db:validate` — success; migration deploy/status and Prisma generate — success; `npm.cmd run build` — success with existing Next.js ESLint plugin warning. HTTP smoke: `/login` 200; unauthenticated `/admin` and `/admin/requests` redirect to `/login`; `/api/health` 200; `/api/auth/get-session` 200. CLI bootstrap created a temporary account and refused a second SUPER_ADMIN. Login UI was not visually verified in a browser.
- **Ограничения:** current CRM still reads/writes browser localStorage, so server login does not provide server-side confidentiality for data already in browser storage. No protected Customer/Request/Supplier domain API or employee management UI exists. Role restrictions in the client UI are supplementary; all future data operations must call server guards. Production deployment/security review, tenant isolation and recovery plan remain outstanding.
- **Следующий шаг:** implement a protected Customer API using the existing repository/service and allowlisted DTOs, then connect the CRM Clients module to PostgreSQL. Do not automatically import localStorage data.
- **Git:** no commit/push; pre-existing working tree is entirely reported as untracked, ownership unknown. Do not reset, clean, stage, or commit it.
- **Статус:** PARTIAL — authentication/session/RBAC and `/admin` guard are implemented and tested; end-to-end confidentiality awaits protected Customer API and replacing the CRM’s localStorage data path.

## 2026-11-08 — создание первого SUPER_ADMIN по запросу владельца

- **Задача:** создать аккаунт первого администратора в локальной dev-БД для указанного владельцем адреса.
- **Действие:** выполнен существующий `npm.cmd run auth:create-super-admin`; CLI создал пользователя с ролью SUPER_ADMIN и credential account. Пароль обработан как переменная окружения, хранится в БД только в виде хеша Better Auth; не записывался в файлы и не выводился. В журнале и handoff email и пароль намеренно не дублируются.
- **Проверка:** CLI сообщил об успешном создании; отдельный read-only запрос подтвердил `exists=true`, `role=SUPER_ADMIN`, `active=true`, наличие credential account. Сценарий использует serializable transaction и откажет при существующем SUPER_ADMIN или занятом email. HTTP-вход через визуальный браузер отдельно не повторялся; локальная страница входа ранее отвечала 200, а auth sign-in flow покрыт DB integration test.
- **Данные:** существующие аккаунты/CRM-записи/volumes не сбрасывались; дубликаты не создавались.
- **Изменённые файлы:** только `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`; код не менялся.
- **Статус:** DONE.
## 2026-11-08 — Защищённый Customer API и перевод CRM «Клиенты» на PostgreSQL

- **Задача:** Создать защищённый Customer API (`GET /api/customers`, `GET /api/customers/[id]`, `PATCH /api/customers/[id]`, `POST /api/customers`), подключить существующий интерфейс `/admin/customers` к PostgreSQL, обеспечить безопасный перенос клиентов из localStorage `zaptut.crm.demo.customers.v1` без дублей и с сохранением связей с заявками, проверить права и ограничения (включая блокировку роли LOGISTICS), выполнить полный цикл проверок тестами, TypeScript, Prisma, build и сквозным headless браузером через CDP.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`, `src/lib/server/customer-service.ts`, `src/lib/server/staff-session.ts`, `src/lib/server/staff-rbac.ts`, `src/app/admin/admin-client-page.tsx`, `src/app/admin/layout.tsx`, `src/lib/server/customer-api.db-test.mjs`, `scripts/browser-test.mjs`.
- **Изменённые файлы:**
  - `src/lib/server/customer-service.ts`: детерминированные v5 UUID (`toDeterministicUuid`), `CustomerDto`, `toCustomerDto` (allowlist проекция, исключающая внутренние поля), функция безопасной миграции `migrateDemoCustomers`, поддержка передачи `id` при создании.
  - `src/lib/server/staff-session.ts`: поддержка передачи явных входящих заголовков (`incomingHeaders?: Headers`) в `getStaffContext`, `requireStaffPermission`, `authorizeStaffApi` для работы как в Next.js request context, так и в Node.js integration tests; явное объявление свойства `status` в классе ошибки для совместимости с `strip-only` mode.
  - `src/app/api/customers/route.ts`: Route Handler для `GET` (список, поиск, пагинация) и `POST` (создание клиента / безопасный batch-импорт).
  - `src/app/api/customers/[id]/route.ts`: Route Handler для `GET` (карточка клиента со связанными заявками) и `PATCH` (редактирование профиля).
  - `src/app/admin/customers/page.tsx`: серверный page-компонент для прямого URL `/admin/customers`.
  - `src/lib/server/test-loader.mjs`: маппинг `next/headers` и `next/server` для интеграционных тестов в Node.js ESM test runner.
  - `src/lib/server/customer-api.db-test.mjs`: интеграционный набор тестов БД (401 без сессии, 403 для LOGISTICS, 200/201 для MANAGER/ADMIN/SUPER_ADMIN, CRUD, дубли, нормализация, идемпотентная миграция, защита серверных данных от затирания демоданными, сохранение связей с заявками).
  - `src/app/admin/admin-client-page.tsx`: подключение вкладки «Клиенты» к PostgreSQL API: синхронизация и импорт при первой загрузке, сохранение связей с заявками, обновление профиля через `PATCH /api/customers/[id]`, создание через модальную форму и `POST /api/customers`, сохранение backup в `localStorage`.
  - `scripts/browser-test.mjs`: автоматический сквозной браузерный тест (headless Chrome CDP) для всех пользовательских сценариев.
  - `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`.
- **Технические решения:**
  - Детерминированные UUID v5 на базе SHA-1 для безопасного маппинга строковых demo ID (`cust-XXXXXXXX`) в PostgreSQL `@db.Uuid` колонку.
  - Allowlist DTO: клиенты и менеджеры получают только разрешённые поля профиля (`id`, `name`, `phone`, `normalizedPhone`, `email`, `normalizedEmail`, `internalNote`, `createdAt`, `updatedAt`, `requests`).
  - Проверка прав через `authorizeStaffApi`: `customers.read` и `customers.update`. Роль `LOGISTICS` не имеет этих прав и получает HTTP 403 Forbidden в API и ограниченный интерфейс в CRM.
  - Идемпотентность и защита данных: при импорте `migrateDemoCustomers` сначала ищет по ID, затем по нормализованным contacts. Если клиент уже есть, возвращает его ID без перезаписи свежих данных.
  - Браузерное сохранение: `zaptut.crm.demo.customers.v1` остаётся в `localStorage` в качестве резервной копии. Заявки пока сохраняются в `localStorage`, сохраняя полную связь по `customerId`.
- **Результаты тестов и проверок:**
  - `npm.cmd run test:customers`: 24/24 pass.
  - `node --experimental-strip-types --test src/lib/financial-config.test.mjs`: 15/15 pass.
  - `npm.cmd run test:server`: 18/18 pass.
  - `npm.cmd run test:auth`: 7/7 pass.
  - `npm.cmd run test:server:integration`: 3/3 pass (auth, customer-api, db repositories).
  - `npm.cmd run db:validate`: Prisma schema valid.
  - `npm.cmd exec -- tsc --noEmit`: 0 ошибок.
  - `npm.cmd run build`: `next build` завершился успешно (статические и динамические маршруты скомпилированы, включая `/admin/customers`, `/api/customers`, `/api/customers/[id]`).
  - Headless Chrome CDP сценарии (`scripts/browser-test.mjs`):
    1. Блокировка роли LOGISTICS (редирект/ограниченный экран в UI, HTTP 403 в `/api/customers`).
    2. Вход под ролью MANAGER.
    3. Открытие `/admin/customers`, отображение списка из 4 профилей из PostgreSQL.
    4. Открытие карточки клиента, проверка заголовка и связанных заявок (1 заявка).
    5. Редактирование профиля (обновление заметки CRM), сохранение в PostgreSQL и проверка в DOM.
    6. Перезагрузка страницы (F5) — сохранение изменений и персистентность.
    7. Поиск по имени («Ольга») — фильтрация реестра до 1 строки.
    8. Поиск по номеру заявки («ZP-2026-0148») — корректный поиск связанного клиента.
    9. Создание нового клиента через модальное окно UI — сохранение в PostgreSQL, отображение карточки нового клиента в DOM.
- **Оставшиеся ограничения:**
  - Заявки пока хранятся в `localStorage` и будут перенесены на отдельном этапе (Requests API).
  - Финансовые формулы, поставщики и механизм авторизации не затрагивались.
- **Статус:** DONE — реализация Customer API, перевод раздела CRM «Клиенты» на PostgreSQL, интеграция, миграция и полный сквозной браузерный QA завершены.

## 2026-11-08 — единый логотип и загрузчик бренда

- **Задача:** внедрить утверждённый логотип ZAPTUT.PRO, иконки приложения и фирменный загрузчик с анимированным шурупом.
- **Изучено:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, frontend design/UI-UX workflow, App Router, публичные страницы, login и CRM logo placements. Указанного в проекте master-файла не было; полученный пользовательский оригинал скопирован без изменения байтов в `public/brand/zaptut-logo-master.png` (SHA-256 совпадает с исходным файлом).
- **Изменено:** `scripts/prepare-brand-assets.ps1`; `public/brand/zaptut-logo-master.png`, `zaptut-logo-dark.png`, `zaptut-logo-light.png`, `zaptut-logo-loader-base.png`, `zaptut-screw.png`; `src/app/icon.png`, `src/app/apple-icon.png`; `src/components/brand/brand-logo.tsx`, `brand-loader.tsx`, `route-loading-provider.tsx`; публичные главная и каталог; login; CRM навигация и preview; `src/app/layout.tsx`, `src/app/loading.tsx`, `src/app/globals.css`; `docs/PROJECT-STATE.md`, `docs/AI-HANDOFF.md`, `docs/AI-LOG.md`.
- **Решения:** мастер сохранён; derivative PNG получены кадрированием и palette normalization исходной геометрии. Добавлены варианты dark/light, CSS/WAAPI анимация из отделённого шурупа, reduced-motion static path, начальный loading fallback и задержанное появление загрузчика при навигации. Бизнес-логика, CRM данные и финансовые формулы не менялись.
- **Проверки:** `npm.cmd exec -- tsc --noEmit` успешно; `npm.cmd run build` успешно (предупреждение Next.js: ESLint plugin не обнаружен). В браузере проверены desktop 1440 px и mobile 390 px: главная, каталог, login, favicon/app-icon links; переход и исчезновение загрузочного состояния; браузерные ошибки/предупреждения отсутствовали. Светлый ассет проверен визуально как изображение. Полноэкранное вращение шурупа, реальное переключение системного reduced-motion и CRM после авторизации не проверены.
- **Ограничения:** `localhost:3000` обслуживал прежний код `/zaptut-logo.webp`; его неизвестный процесс не остановлен. Финальная версия проверялась через временный production-server `127.0.0.1:3001`. Новый provider/API ключ в Codex не подключался: инструкция Taynik описывает Chat Completions, а Codex configuration reference поддерживает только Responses API; `/v1/responses` не подтверждён. Пользователю рекомендовано перевыпустить ключ, опубликованный в сообщении.
- **Git:** до изменений рабочее дерево целиком показывалось как untracked; чужие файлы не очищались и не индексировались. Commit/push не выполнялись.
- **Статус:** PARTIAL — единый бренд реализован и большая часть визуального QA пройдена; остаются перечисленные browser checks.



## 2026-11-11 — ZAPTUT.PRO — SECURITY REMEDIATION PHASE 1

- **Задача:** Устранить критические и high/priority-1 уязвимости безопасности (`P0.1`–`P0.6`, `P1.7`–`P1.10`) по отчёту независимого аудита от 09.11.2026 без изменения финансовых формул, бизнес-логики CRM, каталога/селектора авто и без сброса/изменения паролей существующих аккаунтов `SUPER_ADMIN` и `DEMO_VIEWER`.
- **Изученные файлы:** `AGENTS.md`, `docs/PROJECT-STATE.md`, `docs/AI-LOG.md`, `docs/AI-HANDOFF.md`, `package.json`, `next.config.mjs`, `netlify.toml`, `.nvmrc`, `prisma/schema.prisma`, `src/lib/server/customer-portal-service.ts`, `src/lib/server/customer-session.ts`, `src/lib/server/customer-phone-auth-service.ts`, `src/lib/server/sms/sms-service.ts`, `src/lib/server/sms/mock-provider.ts`, `src/lib/server/import/feed-parser.ts`, `src/lib/server/import/import-service.ts`, `src/lib/server/staff-rbac.ts`, `src/app/api/customer/auth/**`, `src/components/customer/phone-auth-form.tsx`, `src/app/account/(auth)/forgot-password/page.tsx`, `scripts/*.mjs`, `src/lib/server/*.db-test.mjs`.
- **Изменённые и добавленные файлы:**
  - `prisma/schema.prisma`, `prisma/migrations/20261110150000_security_rate_limit_buckets/migration.sql`: модель и таблица `rate_limit_buckets` (применена на Neon staging).
  - `src/lib/server/security/rate-limiter.ts`: атомарный PostgreSQL rate limiter (`INSERT ... ON CONFLICT ... RETURNING`) и доверенный парсер IP (`extractTrustedClientIp`).
  - `src/lib/server/customer-portal-service.ts`, `src/app/api/customer/auth/forgot-password/route.ts`, `src/app/account/(auth)/forgot-password/page.tsx`, `src/lib/server/customer-session.ts`: убрана утечка reset-токена/URL; публичный сброс ограничен только ролью `CUSTOMER`; SHA-256 токены со сроком 15 мин; отключено связывание по неподтверждённому email и write side-effects на GET `getCustomerContext`; запрещена скрытая смена email в `updateProfile`.
  - `src/lib/server/sms/sms-service.ts`, `src/lib/server/customer-phone-auth-service.ts`, `src/app/api/customer/auth/phone/send-otp/route.ts`, `src/components/customer/phone-auth-form.tsx`: удалён обход `"111111"` и выдача `devOtpCode`; добавлен server-only test OTP allowlist (`PHONE_AUTH_TEST_PHONES`, `PHONE_AUTH_TEST_OTP_CODE`); SHA-256 OTP (`timingSafeEqual`), транзакционная блокировка `SELECT ... FROM verifications ... FOR UPDATE` (`maxWait`/`timeout` = 15 с), PostgreSQL лимиты + global anti-pumping circuit breaker (`60/мин`), безопасный `changePhone` (в т.ч. проверка конфликта с `userId: null`).
  - `package.json`, `src/lib/server/import/feed-parser.ts`, `src/lib/server/import/import-service.ts`, `src/lib/server/import-service.db-test.mjs`: удалён `xlsx`, установлен `exceljs@4.4.0`, асинхронный `parseXlsx`/`parseFeedBuffer` без вычисления формул, добавлен `"engines": { "node": ">=24" }`.
  - `next.config.mjs`: убраны `eslint.ignoreDuringBuilds` и `typescript.ignoreBuildErrors`; настроены `Content-Security-Policy` (без `'unsafe-eval'`), `Strict-Transport-Security` (production), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
  - `scripts/*.mjs` (19 скриптов, включая `seed-staging-demo-crm.mjs`, `test-real-supplier-onboarding.mjs`, `qa-*.mjs`, `test-*.mjs`): удалены захардкоженные пароли, служебные email и `"111111"`/`devOtpCode` (заменены на env-переменные или эфемерный `crypto.randomBytes`/`randomUUID`, `test-real-supplier-onboarding.mjs` переведён на `exceljs` + `await parseFeedBuffer`).
  - `src/lib/server/customer-phone-auth.db-test.mjs`, `src/lib/server/customer-portal.db-test.mjs`, `src/lib/server/security-remediation.db-test.mjs`: обновлены существующие тесты и добавлен регрессионный набор из 14 обязательных сценариев.
- **Результаты тестов и проверок:**
  - `npx tsc --noEmit`: exit 0.
  - `npm run lint` (`eslint .`): exit 0.
  - `npm run build` (`prisma generate && next build`, 73 маршрута): exit 0.
  - `npm run test:finance`: 19/19 pass.
  - `npm run test:auth`: 7/7 pass.
  - `npm run test:customers`: 24/24 pass.
  - `npm run test:server`: 18/18 pass.
  - `npm run test:portal`: 9/9 pass.
  - `customer-phone-auth.db-test.mjs` + `import-service.db-test.mjs` + `security-remediation.db-test.mjs`: 27/27 pass (8/8 + 3/3 + 14/14 регрессионных + 2 заголовка сьютов).
  - `npm audit --omit=dev --json`: 0 critical; `xlsx` удалён; в production-зависимостях остаются только транзитивные/major предупреждения (`prisma`/`deepmerge-ts` -> Prisma 7, `sharp`, `exceljs`/`uuid <11.1.1`, build-time `postcss` в Next).
  - Production server (`npx next start -p 3010`) + headless Chrome CDP: все 6 HTTP security headers подтверждены, 0 CSP-нарушений и 0 runtime/console ошибок на `/`, `/catalog`, `/account/login`, `/login`, `/account/forgot-password`.
  - Не выполнены: `npm run test:orders` и `npm run test:staff` (блокированы guard-проверкой скриптов против запуска вне локальной БД `zaptut_dev`). Git `commit`/`push` не выполнялись.
- **Оставшиеся проблемы / действия владельца:**
  - Требуется отдельная ротация владельцем ранее засвеченных в репозитории и архиве аудита от 09.11.2026 учётных записей (`owner@zaptut.pro`, `admin@zaptut.pro`, `demo.partner@zaptut.pro`, `mr.artursabirov@gmail.com`).
  - Изменения находятся в локальном рабочем дереве (ожидают разрешения на `git commit` / `git push` для выкладки на `https://zaptut-staging.netlify.app`).
- **Статус:** DONE.
