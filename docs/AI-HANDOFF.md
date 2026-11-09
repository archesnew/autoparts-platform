# Передача контекста AI-архитектору

- **Окончательные утверждённые финансовые правила ZAPTUT.PRO:**
  - **Россия:** 28%, минимум 300 RUB за физическую позицию (деталь).
  - **Беларусь:** 28%, минимум 300 RUB за физическую позицию (деталь).
  - **Польша (Allegro):** 55%, минимум 1700 RUB за физическую позицию (деталь).
  - Применяется **максимальное значение** между процентной и минимальной наценкой.
  - Логистика поставщика и общая логистика заявки рассчитываются отдельно от наценки и не увеличивают наценку.
  - Для валютной закупки сначала рассчитывается RUB-эквивалент рублёвого минимума по зафиксированному курсу.
  - Значения 34%, 38% и минимум 3000 RUB ошибочны и устранены.

- **Текущая задача (2026-11-09, BLOCKED):** ZAPTUT.PRO — FIX BROKEN STAGING DEPLOYMENT & CLOUD POSTGRES TRANSITION:
  - Выявлены причины сбоя Netlify: 0 функций, так как проект разворачивался без `@netlify/plugin-nextjs`, а `DATABASE_URL` указывал на `localhost:5432`, которого нет в AWS Lambda.
  - В проект интегрирован `@netlify/plugin-nextjs` v5.16.6, обновлён `netlify.toml`.
  - В Netlify удалён скомпрометированный `BETTER_AUTH_SECRET` и установлен новый сгенерированный 256-битный токен.
  - Локальная кодовая база полностью собрана (`npm run build`), TypeScript прошёл без ошибок (`npx tsc --noEmit`).
  - Статус зафиксирован как `BLOCKED` в соответствии с инструкциями, так как для развёртывания требуется:
    1. Действие/разрешение владельца на `git commit` и `git push` в приватный `archesnew/autoparts-platform`.
    2. Создание облачной базы данных PostgreSQL (например, Neon или Supabase) и предоставление `DATABASE_URL` для staging.
  - Как только строка подключения будет получена: выполняются миграции `prisma migrate deploy`, запускается сидирование с новыми паролями, обновляется `DATABASE_URL` на Netlify и проводится финальная браузерная верификация через публичный URL.

- **Предыдущая задача (2026-11-09, DONE):** ZAPTUT.PRO — PUBLIC CRM DEMO ENVIRONMENT: Публичный демонстрационный контур CRM и безопасный DEMO VIEWER:
  - Создан проект `zaptut-staging` в подключённом Netlify-аккаунте (`https://zaptut-staging.netlify.app`).
  - Отключен SSO Team Login (полный публичный доступ без авторизации в Netlify).
  - Реализована аддитивная роль `DEMO_VIEWER` в `staff-rbac.ts` и `staff-management-service.ts`.
  - Защита данных: пользователи `DEMO_VIEWER` имеют доступ только на чтение (`admin.access`, `requests.read`, `orders.read`, `customers.read`, `suppliers.read`, `quotes.read`, `analytics.read`, `finance.read`, `finance.settings.read`). Закупочные цены и маржа скрыты (`quotes.purchase.read = false`), разделы «Сотрудники» и «Импорт прайсов» исключены. Любые POST/PATCH мутации возвращают `403 Forbidden`.
  - Учётная запись владельца `SUPER_ADMIN` (`owner@zaptut.pro`) обладает полным доступом.
  - Подготовлен идемпотентный скрипт `scripts/seed-staging-demo-crm.mjs` для наполнения базы синтетическими данными (клиенты, автомобили, заявки, заказы СДЭК).
  - Браузерная проверка в Google Chrome через CDP подтвердила корректность работы всех 8 сценариев, сохранены подтверждающие скриншоты:
    - `screenshot-crm-superadmin-dashboard.png`
    - `screenshot-crm-superadmin-requests.png`
    - `screenshot-crm-demoviewer-dashboard.png`
    - `screenshot-crm-demoviewer-no-purchase-leak.png`
    - `screenshot-crm-demoviewer-mobile.png`.

- **Предыдущая задача (2026-11-09, DONE):** ZAPTUT.PRO — CUSTOMER BUYING JOURNEY: Полный цикл покупки деталей от каталога до отслеживания заказа:
  - **Реализованный сквозной процесс:**
    1. **Публичный каталог и корзина заявок (`/catalog`):**
       - Доступен без предварительного входа; поиск по VIN, OEM, названию; фильтры категорий и стран.
       - Кнопки «+ В заявку» на карточках товаров (`[data-action="add-to-cart"]`).
       - Корзина заявок (Drawer): счетчик в шапке (`#cart-drawer-toggle`), управление количеством (`+`/`-`), удаление, очистка, ориентировочные розничные цены.
       - Контекст автомобиля: выбор авто из ZAPTUT GARAGE в один клик либо ручной ввод марки, модели, года и VIN. Поле комментария клиента.
       - Сохранение корзины в `localStorage` (`zaptut_cart_items`) при редиректе на вход по телефону (`/account/login?redirect=/catalog`).
       - Гидрационно-безопасная синхронизация через состояние `isCartLoaded` (исключен сброс `localStorage` при SSR-монтировании).
       - Оформление заявки создает 1 `Request` с дочерними строками `RequestItem` в PostgreSQL, генерирует номер `ZP-2026-XXXX`, очищает корзину.
    2. **Кабинет покупателя — Заявки (`/account/requests`, `/account/requests/[id]`):**
       - Список заявок с бейджами статусов, датами, количеством позиций и суммой предложения.
       - Детальная страница заявки: запрошенные запчасти, коммерческое предложение менеджера (состав позиций, количество, розничная цена, логистика, итого в RUB, примечание менеджера).
       - Кнопки действий: «Принять предложение →» (`#accept-offer-btn`) и «Отклонить» (`#reject-offer-btn` с модальным окном причины).
    3. **Формирование предложения менеджером (CRM `/admin/requests`):**
       - Подбор котировок, расчет розничной цены по формуле (RU/BY: 28% мин 300 ₽, PL: 55% мин 1700 ₽).
       - Отправка предложения через `/api/requests/[id]/customer-offer`.
    4. **Согласование клиентом и создание заказа:**
       - Принятие предложения вызывает `/api/customer/requests/[id]/response`.
       - Заявка переводится в статус `CONFIRMED` / `ACCEPTED`.
       - Идемпотентный вызов `orderService.createOrderFromRequest` создает `Order`, `OrderItem` и `Shipment`.
    5. **Кабинет покупателя — Заказы (`/account/orders`, `/account/orders/[id]`):**
       - Список заказов со сквозными номерами `ORD-2026-XXXX`, статусами оплаты/доставки, итоговой суммой.
       - Детальная страница заказа: 4-шаговый таймлайн (Заказ оформлен → Комплектация → В пути → Получен), купленные детали, служба доставки, трек-номер отправления.
       - Строгая защита коммерческой тайны: имена поставщиков, закупочные цены и служебные комментарии CRM полностью исключены из клиентского API и представлений.
    6. **CRM управление заказом (`/admin/orders`):**
       - Менеджер обновляет статус заказа на `SHIPPED` с прикреплением трек-номера СДЭК, клиент мгновенно видит актуальный трекинг в личном кабинете.
  - **Проверки и результаты:**
    - `cmd /c npm run build`: компиляция успешна (57 маршрутов Next.js, 0 ошибок).
    - `node scripts/test-customer-buying-journey.mjs`: 12/12 шагов пройдено со 100% успехом.
    - `node scripts/test-customer-buying-journey-browser.mjs`: полный браузерный E2E-тест в Google Chrome через CDP завершен успешно (код 0).
    - Сохранены скриншоты:
      - `screenshot-journey-catalog-cart.png`
      - `screenshot-journey-customer-offer.png`
      - `screenshot-journey-order-detail.png`
  - **Статус:** `DONE`.

- **Предыдущая задача (2026-11-09, DONE):** ZAPTUT.PRO — GLOBAL VEHICLE DATABASE: Создание полноценной международной базы автомобилей:
  - **База данных PostgreSQL:**
    - Создана единая автомобильная таксономия платформы `ZAPTUT Vehicle Database` (10 новых Prisma-моделей: `VehicleDataSource`, `VehicleSourceRecord`, `VehicleBodyType`, `VehicleMake`, `VehicleModel`, `VehicleGeneration`, `VehicleYear`, `VehicleEngine`, `VehicleModification`, `VehicleAlias`, `ProductFitment`).
    - Охват: Россия, Беларусь, Польша, Китай, Корея, Япония, Европа, США, LCV-сегмент (51 марка, 80 моделей, 33 поколения, 226 модельных лет, 28 двигателей, 27 модификаций, 584 поисковых синонима/алиаса, 11 типов кузова).
    - Датасорсы: `zaptut-regional` (Proprietary / ZAPTUT Open Core), `vehiclesdb` (CC-BY 4.0), `meterapp` (ISC).
    - Разрешение дубликатов и сохранение истории (provenance audit: 219 записей).
    - Неразрушающая привязка: существующие `CustomerVehicle` связаны с внешними ключами `vehicleMakeId`, `vehicleModelId`, `vehicleGenerationId`, `vehicleModificationId` без потери данных.
  - **Серверный слой и REST API:**
    - `VehicleQueryService` с нечувствительным к регистру поиском по латинице и кириллице ("Лада", "Гранта", "Веста", "Тойота"), сортировкой по популярности и пагинацией.
    - `VehicleImporterService` (`scripts/import-vehicle-database.mjs`) — 100% идемпотентный импортёр (повторный запуск разрешает дубликаты без ошибок).
    - `FitmentService` (`src/lib/server/vehicle-database/fitment-service.ts`) — движок совместимости автозапчастей.
    - `/api/customer/vehicle-catalog` — быстрый каскадный выбор с параметрами `step`/`type`: makes, models, generations, years, bodyTypes, engines, modifications, options.
    - `/api/admin/vehicles` — защищённый Staff API (обзор полноты базы данных, мониторинг марок, моделей, ДВС для CRM).
  - **Клиентский интерфейс (ZAPTUT GARAGE):**
    - `VehicleCascadingSelector` переведён на работу с PostgreSQL: 51 марка в выпадающем списке, кириллический поиск, зависимые модели и поколения, автоподстановка параметров кузова, года и ДВС, сохранение foreign keys.
  - **Проверки:**
    - `npx prisma db push` — БД синхронизирована без сброса volumes и без потери демо-данных.
    - `npx tsc --noEmit` — 0 ошибок типов.
    - `npm run build` — 55 маршрутов Next.js скомпилированы успешно.
    - Сервер `next start -p 3000` запущен онлайн в фоновом режиме.
    - Сквозное E2E-тестирование в Google Chrome через CDP (`scripts/test-global-vehicle-db-browser.mjs`):
      - 51 марка в API и в интерфейсе.
      - Поиск "Лада" возвращает AvtoVAZ / Lada.
      - CRM Staff API `/api/admin/vehicles?view=stats` вернул HTTP 200 и полную сводку.
      - Полноценное добавление отечественного автомобиля Lada Vesta NG (2024, Седан, 1.6 л ВАЗ-21129, 1.6 MT Comfort, цвет Signal Orange `#FF6428`, VIN `XTA218070R0123456`) через браузерный интерфейс.
      - Запись в PostgreSQL проверена: `298ec165-96d6-4756-a832-362adf9e5614`, связи `makeId: lada`, `modelId: lada-vesta`, `genId: lada-vesta-ng` зафиксированы.
      - Мобильная адаптивность (390x844): без горизонтальной прокрутки (`scrollWidth === 390`, `overflow === false`).
      - 0 консольных ошибок, 0 uncaught exceptions.
      - Скриншоты: `screenshot-vehicle-db-selector.png`, `screenshot-vehicle-db-mobile.png`.
  - Статус: DONE.

- **Предыдущая задача (2026-11-09, DONE):** ZAPTUT GARAGE — Визуальная оптимизация и каскадный выбор автомобиля (Vehicle Selector):
  - **Визуальная оптимизация (UI Correction):**
    - Убрана огромная центральная рамка и полноразмерная подложка боковой проекции автомобиля.
    - Изображение 2D боковой модели уменьшено до компактных ~220–280 px на десктопе (фактический размер в DOM: 260x104 px) и перенесено в верхний правый угол карточки Zaptut Garage.
    - Полностью удалён бейдж «ОФИЦИАЛЬНЫЙ БОКОВОЙ МАКЕТ ZAPTUT GARAGE» и любые декоративные технические плашки.
    - Карточка скомпонована аккуратно: заголовок ZAPTUT GARAGE, марка/модель крупно, параметры кузова, бейдж основного авто, переключатель слева; компактный авто справа; сетка характеристик (VIN, двигатель, цвет, модификация) снизу; кнопки перехода в каталог и управления внизу.
  - **Каскадный селектор автомобиля (Vehicle Selector):**
    - Ручной ввод марки/модели заменён на 7 последовательных зависимых выпадающих списков: Марка -> Модель -> Поколение -> Год выпуска -> Тип кузова -> Двигатель -> Модификация.
    - Реализован сброс нижестоящих списков при изменении родительских параметров.
    - Реализован быстрый поиск по названию в выпадающих списках (searchable dropdowns).
    - Зависимые поля заблокированы до выбора вышестоящих параметров.
    - VIN-номер вынесен в отдельное необязательное поле.
    - Сохранена палитра 8 цветов + произвольный HEX-пикер с мгновенной перекраской макета.
    - База данных каталога: `src/lib/garage/vehicle-catalog.ts` с реальными данными (Kia, Hyundai, Toyota, VW, Skoda, BMW).
    - Новый REST API: `/api/customer/vehicle-catalog`.
  - **Проверки:**
    - `npx tsc --noEmit` — 0 ошибок.
    - `npm run build` — 54 маршрута скомпилированы успешно.
    - Сервер `next start -p 3000` запущен и доступен онлайн.
    - Сквозное тестирование в реальном Chrome CDP (`scripts/test-vehicle-selector-browser.mjs`):
      1. Авторизация по номеру `+79874023545` через SMS OTP `111111`.
      2. Проверка компактной карточки на `/account`: ширина SVG 260px, бейдж удалён, скриншот `screenshot-garage-card-compact.png`.
      3. Проверка модального окна добавления на `/account/vehicles`: выбор Toyota Camry VIII (XV70) Рестайлинг, 2022, Седан, 2.0 (150 л.с.), белый цвет (`#EAECEE`), сохранение в БД и отображение в списке. Скриншот: `screenshot-vehicle-selector-modal.png`.
      4. Проверка мобильной вёрстки 390x844: горизонтальный скролл отсутствует, скриншот: `screenshot-vehicle-selector-mobile.png`.
    - Все проверки пройдены с кодом 0 (`ALL VEHICLE SELECTOR & GARAGE BROWSER TESTS PASSED`).
  - Статус: DONE.

- **Предыдущая задача (2026-11-09, DONE):** Открытие доступа и сквозная верификация кабинета покупателя по номеру +79874023545:
  - Причина: сервер Next.js на порту 3000 не работал (был временно остановлен при миграции БД для Гаража). Вкладка в браузере пользователя пыталась обновиться и выводила системную ошибку `Application error: a client-side exception has occurred`.
  - Устранены блокирующие ошибки TypeScript/ESLint в модуле Phone Auth (`dialCode` vs `callingCode`, генерация сессии Better Auth с HMAC-подписью куки `zaptut.session_token` через `serializeSignedCookie`).
  - Проект собран (`npm run build`, 53 маршрута), пройдены все тесты (Phone Auth 9/9, Finance 19/19, Staff 13/13, Orders 8/8, Customers 24/24).
  - Сервер запущен на `http://localhost:3000` в фоновом режиме.
  - Проверено в Google Chrome CDP под SUPER_ADMIN: панель `/admin` открывается полностью, ошибки отсутствуют, сохранён скриншот `screenshot-admin-live-check.png`.
  - Статус: DONE.

- **Предыдущая задача (2026-11-09, DONE):** Диагностика и устранение сбоя клиента на `/admin` (Hydration Mismatch #418 & Client Error Boundary):
  - Выявлена и устранена первопричина сбоя клиента:
    1. Рассинхронизация SSR и клиентской гидратации: `section` инициализировался через `typeof window !== "undefined"` с проверкой `window.location.pathname`. На сервере рендерился `dashboard`, на клиенте — другой раздел, что вызывало React Error #418.
    2. Дочерние страницы `/admin/customers` и `/admin/import` ошибочно импортировали `AdminPage` из `../page` вместо `../admin-client-page` без передачи `initialSection`.
    3. `src/app/global-error.tsx` падал при рендере из-за отсутствия `globals.css` и тяжелых зависимостей (`next/image`), вызывая системный чёрный экран Next.js вместо интерфейса восстановления.
    4. Незащищённый `JSON.parse` демо-ключей `localStorage` мог приводить к `SyntaxError`.
  - Все дефекты устранены:
    - `section` инициализируется через `initialSection ?? "dashboard"` строго синхронно.
    - В `customers/page.tsx` и `import/page.tsx` передаётся корректный `initialSection`.
    - Все парсинги `localStorage` обёрнуты в индивидуальные `try/catch`.
    - `global-error.tsx` и `admin/error.tsx` сделаны автономными и надёжными.
  - Проверки:
    - `npx tsc --noEmit`: 0 ошибок.
    - `npm run build`: 50 маршрутов успешно скомпилированы.
    - Тестирование в Chrome через CDP: проверены все 10 разделов CRM и прямые переходы на все `/admin/*` URL — **0 исключений** в рантайме и консоли.
    - `npm run test:finance`: 19/19 pass.
    - `npm run test:portal`: 9/9 pass.
    - `npm run test:staff`: 13/13 pass.
    - `npm run test:orders`: 8/8 pass.
    - Сохранён скриншот: `screenshot-admin-restored.png`.
  - Статус: DONE.

- **Предыдущая задача (2026-11-09, DONE):** Customer Portal / Phase 1 — Полноценный личный кабинет покупателя:
  - Реализована безопасная архитектура аккаунтов `CUSTOMER`:
    - Регистрация и авторизация: `/account/register`, `/account/login`, `/account/forgot-password`, `/account/reset-password`.
    - Требование к паролю: минимум 12 символов.
    - Привязка к модели `Customer` в PostgreSQL: строго к неподтверждённым записям (`userId: null`) по точному совпадению email; запрет присвоения чужих профилей.
    - Вход в личный кабинет добавлен в шапку сайта (`src/app/page.tsx`).
  - Разделы кабинета:
    - `/account` (обзор, KPI гаража и адресов, контактные данные).
    - `/account/profile` (изменение имени/телефона, смена пароля с проверкой старого пароля и валидатором 12+ символов, выход).
    - `/account/vehicles` (гараж: добавление/редактирование/удаление авто, марка, модель, поколение, год, модификация, VIN, двигатель, `isDefault`).
    - `/account/addresses` (адресная книга: добавление/редактирование/удаление адресов, ФИО, телефон, страна, регион, город, улица, дом, квартира, индекс, комментарий, `isDefault`).
  - Серверная защита и изоляция:
    - Все клиентские API проверяют сессию через `requireCustomerContext(req.headers)`.
    - CUSTOMER изолирован от CRM (`/admin` -> `/login`) и Supplier Portal (`/supplier` -> `/login`).
    - Межклиентский доступ (IDOR) полностью заблокирован: манипуляции с чужими `vehicleId` и `addressId` возвращают 404.
  - Проверки:
    - `npx tsc --noEmit`: 0 ошибок.
    - `npm run test:portal`: 9/9 pass.
    - `npm run test:finance`: 19/19 pass.
    - `npm run test:staff`: 13/13 pass.
    - `npm run test:orders`: 8/8 pass.
    - `npm run build`: 50 маршрутов успешно скомпилированы.
    - Сквозной тест в Chrome via CDP (`test-customer-portal-browser.mjs`): 5/5 сценариев пройдены, 4 скриншота сохранены (`screenshot-customer-dashboard.png`, `screenshot-customer-garage.png`, `screenshot-customer-addresses.png`, `screenshot-customer-profile.png`).
  - Следующий этап: подключение клиентского пути `Request → CustomerOffer → Order` в личном кабинете.
  - Статус: DONE.

- **Предыдущая задача (2026-11-09, DONE):** Сквозной Browser QA в Google Chrome (CDP) и актуализация сборки production-сервера:
  - Выявлена и устранена причина отображения старой ошибки клиента в пользовательском браузере: предыдущий фоновый процесс `next start` держал сборку от 20:40 UTC, до того как были внесены исправления в `request-workspace.tsx` и `staff-session.ts`.
  - Дополнительно укреплена защитная типизация: `toMinorUnits` и `calculateLogisticsTotalMinor` в `financial-config.ts` теперь полностью защищены от null/undefined; агрегация в `admin-client-page.tsx` очищена от форматирования; добавлен `src/app/global-error.tsx`.
  - Выполнен чистый `next build` (42 маршрута успешно скомпилированы) и перезапущен production-сервер Next.js на порту 3000.
  - Проведён сквозной аудит всех 5 ролей в Chrome через CDP:
    - `SUPER_ADMIN`: полные финансовые расчёты, закупка и маржа видны, выбор предложения работает.
    - `MANAGER`: закупка и маржа скрыты, видна розничная цена `customerPriceRub`, выбор предложений и F5 без ошибок.
    - `ADMIN (no fin)` / `ADMIN (with fin)`: соответствие индивидуальным правам.
    - `LOGISTICS`: изоляция рабочего пространства, отказ в доступе к CRM-заявкам (HTTP 403).
    - `SUPPLIER`: доступ только к своим оптовым ценам в `/supplier`, блокировка `/admin`.
  - Сохранены 4 требуемых скриншота: `screenshot-super-admin-financial.png`, `screenshot-manager-retail-only.png`, `screenshot-logistics-no-financial.png`, `screenshot-supplier-own-data.png`.
  - Статус: DONE.

- **Предыдущая задача (2026-11-08, DONE):** Разграничение финансовых данных и устранение сбоя клиента на `/admin`.
  - Устранена ошибка `Application error: a client-side exception has occurred while loading localhost` при загрузке `/admin`.
  - Причина: при введении политики сокрытия закупочных цен (`quotes.purchase.read`) для ролей без доступа к оптовым финансам (`MANAGER`, `ADMIN` без override) сервер возвращал `cost: null`. Клиентские функции `minor()` и `retailFor()` пытались форматировать `null` через `toMinorUnits(quote.cost)`, что вызывало необработанный `TypeError: Cannot read properties of null (reading 'trim')` и крах React. Также отсутствовала безопасная проверка `staff?.permissions` в функции `can()`.
  - Исправление:
    1. На сервере (`request-service.ts`) в `toQuoteDto` добавлен расчёт безопасной розничной цены `customerPriceRub` для клиента по утверждённым формулам. При отсутствии `quotes.purchase.read` закупочные цены скрываются (`cost: null`, `purchasePrice: null`), но менеджер получает ориентировочную розничную цену для корректного подбора и сравнения предложений.
    2. В `request-workspace.tsx` функции `minor()` и `shippingTotalMinor()` защищены от `null`/некорректных значений; добавлена безопасная обработка отсутствия финансового доступа с отображением клиентской цены вместо сбоя.
    3. Радиокнопки выбора предложений поставщиков для менеджера теперь отображают клиентскую цену и работают корректно без падений.
    4. В `admin-client-page.tsx` обеспечена безопасная проверка прав `can()` (`staff?.permissions?.includes`) и безопасный `retailFor()`/`finalRetail()`.
    5. Обновлены типы `StaffOfferDto` (`purchaseCurrency: string | null`), `WorkspaceQuote` и `Quote` (`cost: string | null`, `customerPriceRub?: string | null`).
    6. Обновлены тесты `order-service.db-test.mjs`, `catalog-service.db-test.mjs`.
  - Результаты проверок:
    - `tsc --noEmit`: 0 ошибок.
    - `npm run test:finance`: 19/19 pass.
    - `npm run test:staff`: 13/13 pass.
    - `npm run test:orders`: 8/8 pass.
    - `npm run test:server:integration`: 40/40 pass.
    - `npm run build`: успешная оптимизированная сборка (32 маршрута).
    - Production server запущен (`localhost:3000`), `/api/health` возвращает `{"status":"ok","database":"reachable"}`.
  - Статус: DONE.

- **Предыдущая задача (2026-11-08, DONE):** Модуль управления внутренними сотрудниками ZAPTUT.PRO и исправление кнопки «Предложения».
  - Исправлен сбой React (`Application error: a client-side exception has occurred while loading localhost`):
    - В таблице раздела «Предложения поставщиков» устранено разыменование `suppliers.find(...)!` — добавлены безопасные проверки на существование поставщика, страны, валюты и цены.
    - Добавлен компонент Error Boundary (`/admin/error.tsx` и `/error.tsx`) с фирменным стилем ZAPTUT.PRO, отображением ошибки и кнопкой «Попробовать снова» вместо падения Next.js в чёрный экран.
    - В `StaffSessionProvider` добавлен безопасный fallback на случай потери контекста.
  - Реализован модуль управления сотрудниками (`/admin/staff`):
    - Навигационный пункт «Сотрудники» в CRM-меню с разграничением прав (`employees.read` / `employees.manage`).
    - Модели `User.jobTitle` и `StaffInvitation` (7 дней жизни, одноразовый безопасный токен, привязка к роли и создателю).
    - Приглашение сотрудников по ссылке `/staff/invite/[token]` с публичной активацией и самостоятельным вводом пароля (от 10 символов).
    - Таблица активных сотрудников и приглашений с фильтрами, поиском и счётчиками сессий.
    - Редактирование профиля, должности, роли и индивидуальных разрешений (overrides).
    - Блокировка/восстановление сотрудника с автоматическим сбросом всех активных сессий в базе.
    - Принудительное завершение всех сессий сотрудника.
    - Журнал аудита `ActivityLog` для всех действий над сотрудниками.
    - Безопасность: запрет создания `SUPER_ADMIN` через форму, только суперадминистратор может управлять сотрудниками, запрет самоблокировки, отсутствие доступа у `SupplierUser`.
  - Проверки:
    - `npm run test:staff`: 13/13 pass.
    - `npm run test:server:integration`: 40/40 pass.
    - `npm run build`: 32/32 страницы скомпилированы.
    - Headless Chrome CDP: проверены все 9 разделов («Заявки», «Заказы», «Клиенты», «Сотрудники», «Поставщики», «Импорт», «Предложения», «Аналитика», «Финансы») — сбоев нет, все разделы открываются штатно.
    - Сохранены скриншоты: `screenshot-crm-staff-list.png`, `screenshot-crm-staff-create-invite.png`, `screenshot-staff-invite-page.png`, `screenshot-crm-quotes-fixed.png`.

- **Предыдущая задача (2026-11-08, DONE):** Защищённый Requests API и перевод раздела CRM «Заявки» на PostgreSQL.
  - Спроектирована и применена аддитивная миграция `20261108150000_requests_and_workspace_sync`:
    - `Request`: поля `vehicleMake`, `vehicleModel`, `vehicleYear`, `vehicleVin`, `managerNameSnapshot`, `customerOfferStatus`, `customerResponseStatus`.
    - `SupplierQuote`: поле `shippingBasis` (`ORDER` / `PER_UNIT`).
    - `CustomerOffer`: `sharedLogisticsRub`, `responseStatus`, `sentAt`, `snapshot` (JSON со всеми финансовыми строками и курсами валют).
    - `Task`: `description`, `priority`.
  - Разработан серверный слой (`src/lib/server/request-repository.ts` и `src/lib/server/request-service.ts`):
    - Поддержка поиска по каноническому номеру `ZP-2026-XXXX` и по внутреннему UUID.
    - Safe DTO-мапперы с сегментацией закупочных данных: розничные данные и предложения доступны сотрудникам с `requests.read`, закупочные цены и маржа выдаются только при наличии права `quotes.purchase.read`.
    - Идемпотентный пакетный импорт `migrateDemoRequests`: детерминированные UUID v5, сохранение связей с клиентами (`customerId`), поставщиками (`supplierId`), позиций, предложений, задач и истории `ActivityLog`. Защита от перезаписи более свежих данных базы старыми демо-данными.
  - Реализованы защищённые Route Handlers:
    - `GET /api/requests` — поиск, фильтрация, пагинация (`requests.read`).
    - `POST /api/requests` — создание заявки (`requests.create`) и пакетная миграция (`action: "migrate"`).
    - `GET /api/requests/[id]` — полная карточка заявки (`requests.read`).
    - `PATCH /api/requests/[id]` — редактирование заявки (`requests.update`).
    - `POST /api/requests/[id]/items` и `PATCH/DELETE /api/requests/[id]/items/[itemId]` — управление позициями (`requests.update`).
    - `POST /api/requests/[id]/quotes` и `PATCH /api/requests/[id]/quotes/[quoteId]` — управление предложениями поставщиков и выбор предложения менеджером (`quotes.manage`).
    - `POST /api/requests/[id]/customer-offer` — фиксация снимка КП покупателя со всеми финансовыми строками и валютными курсами (`quotes.manage`).
    - `PATCH /api/requests/[id]/customer-response` — фиксация ответа покупателя (`requests.update`).
    - `GET/POST /api/tasks` и `PATCH /api/tasks/[id]` — реестр и статусы задач менеджеров (`requests.read`/`requests.update`).
    - `GET /api/admin/suppliers` — поставщики для рабочего пространства CRM (`quotes.read`).
  - Строгая безопасность и RBAC:
    - Проверка прав через `authorizeStaffApi`.
    - Роли `LOGISTICS` и `SupplierUser` аппаратно заблокированы от доступа к заявкам и контактам клиентов (HTTP 401/403).
  - Клиентская интеграция CRM (`src/app/admin/admin-client-page.tsx`):
    - Подключение `RequestWorkspace`, `DashboardQueue`, `ManagerTasks` к PostgreSQL API.
    - Автоматическая миграция с сохранением резервной копии `zaptut.crm.demo.requests.v1.backup` в `localStorage`.
    - Бейдж «CRM / POSTGRESQL» и «Источник истины: PostgreSQL».
    - При сбое сети или БД выводится явный баннер ошибки с рекомендацией проверки PostgreSQL.
  - Сохранение финансовых формул:
    - Сохранены утверждённые тарифные сетки (28% РФ / 300 RUB, 28% РБ / 300 RUB, 55% PL / 1700 RUB), курсы валют (92 RUB/USD, 98 RUB/EUR, 28 RUB/BYN), распределение логистики и обязательное обоснование при продаже ниже закупки.
  - Проверки и верификация:
    - `tsc --noEmit` — 0 ошибок.
    - `test:customers` — 24/24 pass.
    - `test:server` — 18/18 pass.
    - `test:auth` — 7/7 pass.
    - `test:server:integration` — 19/19 pass (включая Requests API RBAC, batch migration, full lifecycle).
    - `next build` — 25 маршрутов успешно скомпилированы.
    - Глубокая проверка БД (`scripts/verify-db-requests.mjs`): 12 заявок, 13 предложений поставщиков, 13 задач; верификация `qt-148-1` (закупка 164 USD, розница 209.92 USD, маржа 21.88%).
    - Сквозной browser QA в Chrome CDP: 3 скриншота артефактов (`screenshot-crm-requests-list.png`, `screenshot-crm-request-card.png`, `screenshot-crm-request-persisted.png`).
  - Соблюдены цвета ZAPTUT.PRO (`#17191B`, `#FF6428`, `#888B8D`, `#F1F0EB`) и шрифт Onest.

- **Предыдущая задача (2026-11-08, DONE):** Личный кабинет поставщика (Supplier Portal `/supplier`) и управление аккаунтами поставщиков в CRM.
  - Спроектирована и применена аддитивная миграция `20261108140000_supplier_portal`: модели `SupplierUser` (`OWNER`, `MANAGER`), `SupplierInvitation` (`PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`), расширение `Supplier` реквизитами юрлица и логистики.
  - Реализован строгий серверный multi-tenant guard `src/lib/server/supplier-session.ts`: `supplierId` извлекается исключительно из серверной сессии пользователя `SupplierUser.supplierId`, клиентские параметры полностью игнорируются. IDOR и межпоставщицкий доступ аппаратно заблокированы. Роль `SUPPLIER` полностью отсечена от staff-сессий и маршрутов `/admin`.
  - Полнофункциональный Личный кабинет поставщика (`/supplier`):
    - Дашборд: KPI-метрики (активные предложения, товары в каталоге, % свежести цен за 7 дней, отсутствующие/архивные позиции), история последних загрузок фидов.
    - Мои товары: постраничный каталог предложений поставщика, поиск по OEM/артикулу/названию, фильтры по статусу и состоянию (`NEW`/`USED`), цена, остаток, дни доставки, модальное окно быстрого редактирования.
    - Загрузка фидов: загрузка YML/XML/CSV/XLSX с автоматической жесткой привязкой к аккаунту текущего поставщика, превью KPI, валидация строк и подтверждение импорта в каталог.
    - Профиль компании: юридическое наименование, ИНН/КПП/VAT, складской адрес, город, страна, условия доставки, самовывоз, дни комплектации, валюты.
    - Форма принятия инвайта: `/supplier/invite/[token]` с валидацией пароля от 12 символов и автоматическим входом.
  - Управление аккаунтами поставщиков в CRM (`/admin` → вкладка «Поставщики»):
    - Модальное окно «Кабинет и пользователи 👤» для каждого поставщика.
    - Создание прямого логина представителя поставщика (email, имя, пароль от 12 символов, роль OWNER/MANAGER).
    - Генерация защищённых одноразовых инвайт-ссылок (`/supplier/invite/[token]`) со сроком действия 7 дней.
    - Блокировка/разблокировка конкретных пользователей поставщика.
    - Массовая приостановка всех активных предложений поставщика в каталоге («Приостановить все предложения», перевод в `OUT_OF_STOCK` без удаления товаров и истории).
    - Просмотр статистики ошибок и последних фидов без захода в чужой кабинет.
  - Тестирование и валидация:
    - 6/6 интеграционных тестов БД `supplier-portal.db-test.mjs` (создание, инвайты, multi-tenant изоляция данных, блокировка, авто-привязка фидов).
    - 16/16 общих интеграционных тестов сервера (`test:server:integration`).
    - 24/24 customer tests, 18/18 server unit tests.
    - `tsc --noEmit` — 0 ошибок.
    - `next build` — все 22 маршрута успешно скомпилированы.
    - Сквозной browser QA в реальном headless Chrome CDP: 5 скриншотов артефактов (`screenshot-crm-supplier-users.png`, `screenshot-supplier-dashboard.png`, `screenshot-supplier-products.png`, `screenshot-supplier-import.png`, `screenshot-supplier-profile.png`).
  - Фирменный стиль ZAPTUT.PRO: строгое соблюдение палитры Graphite `#17191B`, Signal Orange `#FF6428`, Industrial Steel `#888B8D`, Warm Porcelain `#F1F0EB`, шрифта Onest и BrandLogo.

- **Предыдущая задача (2026-11-08, DONE):** B2B Feed Import: YML, XML, CSV, XLSX, Matching Engine, Preview & CRM Workspace.
  - Поддержаны все утверждённые форматы фидов: YML (Яндекс.Маркет / Дром), XML (Авито / Универсальный), CSV (с разделителями `,`, `;`, `\t`), XLSX (SheetJS без исполнения формул/макросов).
  - Спроектирован и внедрён конвейер `Upload → Parse → Normalize → Validate → Match → Preview → Commit` с хранением промежуточных заданий и строк в `ImportJob` и `ImportRow` в PostgreSQL (миграция `20261108130000_b2b_import_jobs`).
  - Реализован интеллектуальный движок сопоставления (`product-matcher.ts`): точный поиск по каноническому OEM, проверка альтернативных артикулов, дедупликация строк внутри одного фида.
  - Обеспечена полная идемпотентность: детерминированные `externalId` через SHA-256 хеш (`gen-sha256(...)`) гарантируют, что повторные загрузки обновляют существующие предложения `SupplierOffer`, не плодя дубликаты `Product`. Отсутствующие в файле товары не удаляются и не снимаются с продажи автоматически.
  - Создан защищённый REST API:
    - `POST /api/admin/import/upload` — загрузка, валидация и генерация превью (`quotes.manage`).
    - `GET /api/admin/import/jobs` — история импортов (`quotes.read`).
    - `GET /api/admin/import/jobs/[id]` — строки и сводка превью (`quotes.read`).
    - `POST /api/admin/import/jobs/[id]/commit` — подтверждение загрузки в базу каталога (`quotes.manage`).
  - Разработан полнофункциональный раздел CRM «Импорт прайсов» (`/admin/import`) с выбором поставщика, источника, формата, карточками KPI, таблицей предпросмотра с бейджами и историей заданий в строгом брендинге ZAPTUT.PRO.
  - Проверки: TypeScript (0 ошибок), unit/integration тесты (10/10, 18/18, 24/24 pass), production build (все 16 маршрутов) и сквозной browser QA в реальном Chrome CDP со скриншотом `screenshot-admin-import.png`.

- **Предыдущая задача (2026-11-08, DONE):** Единая база товаров и предложений поставщиков (Product & SupplierOffer в PostgreSQL).
  - Разделены сущности: `Product` (физическая деталь, OEM-коды, характеристики, применимость, фото, вечная память) и `SupplierOffer` (конкретные предложения продавцов, закупочные цены, условия, валюты).
  - Применена аддитивная миграция `20261108120000_products_and_supplier_offers` в PostgreSQL без сброса БД и объёмов.
  - Построены `catalog-repository.ts` и `catalog-service.ts` со строгой санитизацией DTO: закупочные цены и внутренние данные поставщиков покупателю не отдаются.
  - Созданы защищённые/публичные эндпоинты `GET /api/catalog` и `GET /api/catalog/[id]` (с закрытым staff-режимом `?internal=true`).
  - Каталог `/catalog` переведён на PostgreSQL; в модальном окне детали выводятся все предложения из РФ, РБ и Польши.
  - Настроена учётная запись суперадминистратора `mr.artursabirov@gmail.com`.
  - Успешно пройдены TypeScript (0 ошибок), unit/integration тесты (7/7, 18/18, 24/24), production build и сквозной browser QA в Chrome CDP.

- **Предыдущая задача (2026-11-08, DONE):** Функциональное приёмочное тестирование агрегатора (Acceptance Test).
  - Проверена вся цепочка клиентского и B2B функционала autoparts-marketplace: поиск, источники (РФ, РБ, Allegro), вечная память карточек, B2B-импорт фидов, карточка товара и персистентность данных.
  - Исправлен поиск на главной странице (`src/app/page.tsx`): подключён роутинг в `/catalog?q=...` и кликабельные быстрые OEM-чипы.
  - Доработан каталог (`src/app/catalog/page.tsx`): чтение query-параметров через `<Suspense>`, фильтр наличия и архива, поддержка `ARCHIVED_SOLD` с сохранением параметров и кнопкой «Найти аналог по OEM».
  - Подтверждено использование PostgreSQL 16 для Auth/RBAC и Customer API (`WORKING`).
  - Классифицированы все блоки по статусам `WORKING`, `DEMO`, `UI ONLY`, `NOT IMPLEMENTED`.
  - Успешно пройдены `tsc --noEmit`, customer suite (24/24), server suite (18/18), production build и браузерные скриншоты в Chrome CDP.

- **Предыдущая задача (2026-11-08, DONE):** Полное восстановление утверждённого фирменного стиля ZAPTUT.PRO.
  - Название: повсеместно внедрено `ZAPTUT.PRO`; устаревшее наименование AUTO-ZAP HUB и посторонняя иконка-молния удалены.
  - Логотип: оригинальный утверждённый мастер-логотип `BrandLogo` (`zaptut-logo-master.png`, `zaptut-logo-dark.png`, `zaptut-logo-light.png`).
  - Анимация загрузки: вращающийся оригинальный шуруп в `BrandLoader` (`zaptut-screw.png`).
  - Цветовая палитра: строго 4 цвета — Graphite (`#17191B`), Signal Orange (`#FF6428`), Industrial Steel (`#888B8D`), Warm Porcelain (`#F1F0EB`). Никакого `#FFFFFF` в качестве основного фона/бренда; синие шаблонные акценты удалены.
  - Типографика: единый шрифт **Onest** применён ко всем элементам приложения.
  - Скриншоты подтверждения: сохранены в артефактах задачи (`screenshot-home.png`, `screenshot-search.png`, `screenshot-catalog.png`, `screenshot-b2b.png`).
  - Проверки: TypeScript, unit-тесты (24 customer, 18 server, 3 db-integration) и production build пройдены со 100% успехом.

- **Предыдущая задача (2026-11-08, DONE):** Защищённый Customer API и перевод раздела CRM «Клиенты» (`/admin/customers`) на PostgreSQL.
  - Созданы защищённые Route Handlers: `GET /api/customers`, `GET /api/customers/[id]`, `PATCH /api/customers/[id]`, `POST /api/customers`.
  - Права проверяются через `authorizeStaffApi` (`customers.read`, `customers.update`). Роль `LOGISTICS` заблокирована (403 Forbidden).
  - Ответы отдаются через allowlist DTO (закупочные и внутренние поля отсечены). Входящие данные строго валидируются.
  - CRM интерфейс подключён к PostgreSQL: загрузка списка, карточка клиента со связанными заявками, редактирование профиля, создание нового клиента, поиск по имени/телефону/email/номеру заявки/автомобилю, сохранение данных после F5.
  - Безопасный перенос профилей из `localStorage` (`zaptut.crm.demo.customers.v1`) в PostgreSQL: детерминированные UUID v5, сохранение связей с заявками по `customerId`, исключение дубликатов, защита свежих серверных данных от затирания демоданными. Исходный ключ `localStorage` сохранён как резервная копия.
  - Полный сквозной QA в headless Chrome через Chrome DevTools Protocol подтвердил корректность всех 12 сценариев.

- **Следующий шаг:** Реализовать защищённый Requests API и перевести раздел CRM «Заявки» (`/admin/requests`) на PostgreSQL, сохраняя связи с клиентскими профилями по `customerId`. До подтверждения следующей задачи не начинать перенос заявок.

- **Среда и зависимости:**
  - PostgreSQL в Docker (`zaptut-local-postgres`, порт `127.0.0.1:5432`, volume `zaptut_postgres_data`).
  - Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS 4, Better Auth, Prisma 6.
  - Запуск тестов: `npm.cmd run test:customers`, `npm.cmd run test:server`, `npm.cmd run test:auth`, `npm.cmd run test:server:integration`, `npm.cmd exec -- tsc --noEmit`, `npm.cmd run build`.
  - Запуск браузерного CDP теста: `node scripts/browser-test.mjs`.

- **Ограничения:**
  - Финансовые формулы и правила наценки не менялись.
  - Заявки пока сохраняются в `localStorage` и ждут отдельного этапа переноса.
  - Git-операции (commit/push/reset) не выполнялись без отдельного указания.

- **Предыдущий продуктовый этап (2026-11-08, PARTIAL):** добавлен общий `BrandLogo`, подготовлены варианты из утверждённого master, favicon/app icon и `BrandLoader`; TypeScript/build успешны. Desktop/mobile, login, каталог, initial loader и переход проверены на свежей сборке через `127.0.0.1:3001`. На `localhost:3000` оставался старый сервер; его процесс не остановлен. Не завершён browser QA анимации вращения, `prefers-reduced-motion` и защищённого CRM-экрана.
- **Параллельный запрос о Taynik API (не реализован):** публичная инструкция Taynik указывает OpenAI-совместимый `https://taynik.store/v1` и `/chat/completions`; текущая Codex config reference допускает для custom model providers только wire API `responses`. Совместимость `/v1/responses` не подтверждена, поэтому пользовательский Codex config и ключ не изменялись. API-ключ из сообщения не копировать в проект; рекомендуется отозвать и перевыпустить.
- **Открытые пункты предыдущего этапа:** завершить browser QA бренда, когда доступен авторизованный CRM-сеанс и reduced-motion проверка; отдельно подтвердить у Taynik поддержку Responses API перед подключением провайдера Codex. Если не поддерживается, использовать совместимый клиент (например, Cline/Roo) по инструкции Taynik. Не отправлять проектные данные внешнему API без явного согласования конкретного набора данных/цели.
- **Текущий статус проекта:** демонстрационный Next.js/TypeScript агрегатор с CRM и локальной PostgreSQL dev-БД. Better Auth/RBAC включены; первый SUPER_ADMIN создан для владельца проекта в локальной БД. Доменные CRM API и перенос данных с localStorage не выполнены; production-среды и интеграций нет. См. `PROJECT-STATE.md` и `PRODUCT-ROADMAP.md`.
- **Последняя задача (2026-11-08):** реализованы вход/выход сотрудников на Better Auth, Prisma-backed sessions, RBAC, server-side guard `/admin` и CLI bootstrap первого SUPER_ADMIN. Additive migration `20261108100000_staff_auth_and_rbac` применена к локальной dev-БД; CRM остаётся на localStorage.
- **Основные изменённые файлы этой задачи:** `prisma/schema.prisma`, `prisma/migrations/20261108100000_staff_auth_and_rbac/migration.sql`, `src/lib/server/auth.ts`, `staff-session.ts`, `staff-rbac.ts`, `src/app/login/page.tsx`, `src/components/auth/login-form.tsx`, `src/app/api/auth/[...all]/route.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/admin-client-page.tsx`, admin session/logout components, `scripts/create-super-admin.mjs`, `package.json`, `.env.example` и auth-тесты. Секреты хранятся только в локальном игнорируемом `.env`; не выводить и не коммитить.
- **Проверки авторизации:** server unit suite 18/18; auth DB integration и repositories DB integration 2/2; TypeScript, Prisma validate/migrate status, Prisma generate и production build успешны. HTTP smoke: `/login` 200, без сессии `/admin` и `/admin/requests` редиректят на `/login`, `/api/health` и `/api/auth/get-session` возвращают 200. UI входа визуально в браузере не тестировался. CLI bootstrap проверен на временной учётной записи: создание успешно, повторный SUPER_ADMIN отклонён; тестовая запись удалена.
- **Среда:** локальная PostgreSQL использует контейнер `zaptut-local-postgres`, bind `127.0.0.1:5432` и volume `zaptut_postgres_data`. В `.env` есть dev-only секрет Better Auth и локальный DB URL; их не раскрывать. Текущий запуск сайта следует перепроверить, если пользователь сообщает о недоступном localhost.
- **Следующий шаг:** реализовать защищённый Customer API на текущем repository/service, с allowlist DTO и `customer.read/create/update`; затем подключить CRM-раздел «Клиенты» к PostgreSQL. Не мигрировать localStorage автоматически и не включать клиентам/менеджерам закрытые финансовые и supplier-поля.
- **Ручные браузерные проверки (со слов пользователя):** цена 220 USD без убытка сохранена после F5; цена 160 USD при закупке 164 USD предупредила об убытке 4 USD и сохранила причину/подтверждение/объяснение после F5; сохранение ниже закупки без подтверждения блокируется; значения и раскрытие деталей проверены визуально.
- **Автоматические проверки (результаты, сообщённые пользователем):** финансовые тесты 15/15, TypeScript успешно, production build успешно с предупреждением Next.js о конфигурации ESLint.
- **Хранение и ограничения:** финансовые данные сохраняются в `localStorage` только в деморежиме. Production-хранилище и реальные интеграции не подключены; формулы не менялись при перестройке интерфейса.
- **Открытые проблемы:** до изменений `git status --short` показывал весь проект как untracked; авторство файлов не выяснено. Ничего не добавлять в индекс, не удалять и не коммитить. Customer phone/email имеют индексы, но не уникальные ограничения в текущей схеме; Serializable transaction защищает конкурентную проверку в сервисе, но DB-level unique constraints требуют отдельной проверки существующих данных/решения о миграции.
- **Замечание по финансовой сверке:** для `qt-148-1` в seed-коде `82.00 USD × 2`, тариф Россия 28%, демо-курс 92 RUB/USD и логистика 18.00 USD/заказ. Расчёт даёт цену позиции без логистики 209.92 USD, строку с логистикой 227.92 USD, прибыль 45.92 USD и маржу 20.14%. Контрольные 218.00/36.00/16.51% подразумевают ручную цену 200.00 USD до логистики и с текущим автоматическим расчётом не совпадают; код не подгонялся.
- **Предыдущий следующий шаг (до расширения roadmap):** согласовать пилот и границу между запросом через менеджера и checkout. Расширенная карта теперь также требует заказного контура; актуальный следующий шаг указан выше.
- **Незакоммиченные изменения:** `git status --short` показывает незакоммиченные файлы по всему проекту. Их происхождение не выяснено; не изменять, не удалять и не включать их в коммит до выяснения принадлежности.
- **Статус последней задачи:** DONE — запрошенный аккаунт первого SUPER_ADMIN создан в локальной dev-БД через CLI; пароль в файлы и логи не записывался. Предыдущий этап auth/RBAC остаётся частичным по полной защите CRM-данных: нужны Customer API и подключение UI вместо localStorage.
