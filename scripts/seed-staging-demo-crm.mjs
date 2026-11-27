import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("=== SEEDING STAGING DEMO CRM ENVIRONMENT ===");

  // 1. Ensure staff roles exist, including DEMO_VIEWER
  console.log("1. Ensuring staff roles exist...");
  const roles = [
    { code: "SUPER_ADMIN", name: "Суперадминистратор", isSystem: true },
    { code: "ADMIN", name: "Администратор", isSystem: true },
    { code: "MANAGER", name: "Менеджер", isSystem: true },
    { code: "LOGISTICS", name: "Логист", isSystem: true },
    { code: "DEMO_VIEWER", name: "Демо-наблюдатель (Партнёр)", isSystem: true },
  ];

  for (const role of roles) {
    await prisma.staffRole.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: { code: role.code, name: role.name, isSystem: role.isSystem },
    });
  }
  console.log("  ✓ Staff roles verified (SUPER_ADMIN, ADMIN, MANAGER, LOGISTICS, DEMO_VIEWER)");

  // 2. Ensure permissions exist
  console.log("2. Ensuring permissions exist...");
  const allPermissions = [
    { code: "admin.access", description: "Открывать внутреннюю CRM" },
    { code: "logistics.access", description: "Открывать рабочее пространство логистики" },
    { code: "requests.read", description: "Читать заявки и данные покупателей" },
    { code: "requests.create", description: "Создавать заявки" },
    { code: "requests.update", description: "Изменять заявки" },
    { code: "requests.assign", description: "Назначать ответственных" },
    { code: "customers.read", description: "Читать профили клиентов" },
    { code: "customers.update", description: "Изменять профили клиентов" },
    { code: "customers.contact.read", description: "Читать контакты покупателей" },
    { code: "customers.internal.read", description: "Читать внутренние заметки клиентов" },
    { code: "suppliers.read", description: "Читать данные поставщиков" },
    { code: "suppliers.manage", description: "Управлять поставщиками" },
    { code: "quotes.read", description: "Читать предложения поставщиков" },
    { code: "quotes.manage", description: "Управлять предложениями поставщиков" },
    { code: "quotes.purchase.read", description: "Читать закупочные цены и условия поставщиков" },
    { code: "analytics.read", description: "Просматривать аналитику CRM" },
    { code: "finance.read", description: "Просматривать финансовые расчёты" },
    { code: "finance.settings.read", description: "Читать финансовые настройки" },
    { code: "finance.settings.update", description: "Изменять финансовые настройки" },
    { code: "employees.read", description: "Просматривать сотрудников и роли" },
    { code: "employees.manage", description: "Управлять сотрудниками и ролями" },
    { code: "audit.read", description: "Просматривать внутреннюю историю действий" },
    { code: "orders.read", description: "Читать заказы" },
    { code: "orders.create", description: "Создавать заказы" },
    { code: "orders.update", description: "Изменять заказы" },
    { code: "orders.payment.manage", description: "Управлять оплатами" },
    { code: "orders.shipment.manage", description: "Управлять доставкой" },
    { code: "shipments.read", description: "Читать отправления" },
    { code: "shipments.update", description: "Управлять отправлениями" },
    { code: "logistics.documents.read", description: "Читать логистические документы" },
    { code: "system.manage", description: "Управлять системными настройками" },
  ];

  for (const perm of allPermissions) {
    await prisma.staffPermission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: { code: perm.code, description: perm.description },
    });
  }

  // Assign DEMO_VIEWER permissions (strictly read-only, ZERO purchase price or write access)
  const demoViewerPermissions = [
    "admin.access",
    "requests.read",
    "orders.read",
    "customers.read",
    "suppliers.read",
    "quotes.read",
    "analytics.read",
    "finance.read",
    "finance.settings.read",
  ];

  for (const p of demoViewerPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleCode_permissionCode: { roleCode: "DEMO_VIEWER", permissionCode: p } },
      update: {},
      create: { roleCode: "DEMO_VIEWER", permissionCode: p },
    });
  }
  console.log("  ✓ DEMO_VIEWER permissions configured (Read-only, Zero financial secrecy exposure)");

  // 3. Create DEMO_VIEWER partner account
  console.log("3. Creating DEMO_VIEWER partner user...");
  const requireEnv = (name) => {
    const val = process.env[name]?.trim();
    if (!val) throw new Error(`Missing required environment variable: ${name}`);
    return val;
  };
  const demoEmail = requireEnv("DEMO_VIEWER_EMAIL").toLowerCase();
  const demoPass = requireEnv("DEMO_VIEWER_PASSWORD");
  const demoHash = await hashPassword(demoPass);

  let demoUser = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        name: "Партнёрский Демо Доступ",
        email: demoEmail,
        role: "DEMO_VIEWER",
        active: true,
        emailVerified: true,
      },
    });
  } else {
    demoUser = await prisma.user.update({
      where: { id: demoUser.id },
      data: { role: "DEMO_VIEWER", active: true },
    });
  }

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: demoUser.id } },
    update: { password: demoHash },
    create: {
      accountId: demoUser.id,
      providerId: "credential",
      userId: demoUser.id,
      password: demoHash,
    },
  });
  console.log(`  ✓ Demo viewer user ready: ${demoEmail}`);

  // 4. Create SUPER_ADMIN owner account
  console.log("4. Creating SUPER_ADMIN owner user...");
  const ownerEmail = requireEnv("ZAPTUT_ADMIN_EMAIL").toLowerCase();
  const ownerName = process.env.ZAPTUT_ADMIN_NAME || "Владелец ZAPTUT.PRO";
  const ownerPass = requireEnv("ZAPTUT_ADMIN_PASSWORD");
  const ownerHash = await hashPassword(ownerPass);

  let ownerUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!ownerUser) {
    ownerUser = await prisma.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        role: "SUPER_ADMIN",
        active: true,
        emailVerified: true,
      },
    });
  } else {
    ownerUser = await prisma.user.update({
      where: { id: ownerUser.id },
      data: { role: "SUPER_ADMIN", active: true },
    });
  }

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: ownerUser.id } },
    update: { password: ownerHash },
    create: {
      accountId: ownerUser.id,
      providerId: "credential",
      userId: ownerUser.id,
      password: ownerHash,
    },
  });
  console.log(`  ✓ Owner SUPER_ADMIN user ready: ${ownerEmail}`);

  // 5. Seed Synthetic Suppliers
  console.log("5. Seeding Synthetic Suppliers...");
  const supplierRu = await prisma.supplier.upsert({
    where: { id: "a0000000-0000-0000-0000-000000000001" },
    update: { name: "Север Авто Деталь", countryCode: "RU" },
    create: {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "Север Авто Деталь",
      countryCode: "RU",
      contactName: "Андрей Морозов",
      phone: "+7 495 120-40-50",
      email: "order@sever-auto.ru",
      specialization: "Немецкие и японские бренды, тормозные системы, подвеска",
      terms: "1-2 рабочих дня, склад Москва",
      supportedCurrencies: ["RUB"],
      status: "ACTIVE",
    },
  });

  const supplierBy = await prisma.supplier.upsert({
    where: { id: "a0000000-0000-0000-0000-000000000002" },
    update: { name: "Минск Моторс", countryCode: "BY" },
    create: {
      id: "a0000000-0000-0000-0000-000000000002",
      name: "Минск Моторс",
      countryCode: "BY",
      contactName: "Дмитрий Козлов",
      phone: "+375 17 330-20-10",
      email: "b2b@minsk-motors.by",
      specialization: "Амортизаторы, радиаторы, рулевые рейки",
      terms: "2-4 рабочих дня, регулярный трансграничный рейс Минск-Москва",
      supportedCurrencies: ["RUB", "BYN"],
      status: "ACTIVE",
    },
  });

  const supplierPl = await prisma.supplier.upsert({
    where: { id: "a0000000-0000-0000-0000-000000000003" },
    update: { name: "Baltic Parts Demo (Allegro B2B Partner)", countryCode: "PL" },
    create: {
      id: "a0000000-0000-0000-0000-000000000003",
      name: "Baltic Parts Demo (Allegro B2B Partner)",
      countryCode: "PL",
      contactName: "Piotr Zieliński",
      phone: "+48 22 890-12-34",
      email: "export@baltic-parts.pl",
      specialization: "Европейские авторазборки и склады Allegro, кузовные детали",
      terms: "7-12 рабочих дней, таможенная очистка включена",
      supportedCurrencies: ["PLN", "EUR"],
      status: "ACTIVE",
    },
  });
  console.log("  ✓ 3 Synthetic suppliers seeded (RU, BY, PL)");

  // 6. Seed Synthetic Customers & Vehicles
  console.log("6. Seeding Synthetic Customers & Garage...");
  const customerFleet = await prisma.customer.upsert({
    where: { id: "c0000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "c0000000-0000-0000-0000-000000000001",
      name: "ООО «ТехноПарк Авто»",
      phone: "+7 999 100-20-30",
      normalizedPhone: "+79991002030",
      email: "fleet@technopark-demo.ru",
      normalizedEmail: "fleet@technopark-demo.ru",
      internalNote: "Корпоративный автопарк (14 коммерческих автомобилей). Оплата по безналичному расчёту.",
    },
  });

  const customerAlex = await prisma.customer.upsert({
    where: { id: "c0000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "c0000000-0000-0000-0000-000000000002",
      name: "Алексей Смирнов",
      phone: "+7 911 222-33-44",
      normalizedPhone: "+79112223344",
      email: "alex.smirnov.demo@mail.ru",
      normalizedEmail: "alex.smirnov.demo@mail.ru",
      internalNote: "Постоянный клиент, предпочитает исключительно оригинальные детали или премиум-аналоги.",
    },
  });

  const customerVictor = await prisma.customer.upsert({
    where: { id: "c0000000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "c0000000-0000-0000-0000-000000000003",
      name: "Виктор Ковалёв",
      phone: "+375 29 888-77-66",
      normalizedPhone: "+375298887766",
      email: "kovalev.minsk.demo@tut.by",
      normalizedEmail: "kovalev.minsk.demo@tut.by",
      internalNote: "Самовывоз или доставка СДЭК до пункта выдачи в Минске.",
    },
  });
  console.log("  ✓ 3 Synthetic customers created");

  // 7. Seed Synthetic CRM Requests across pipeline stages
  console.log("7. Seeding Synthetic CRM Requests...");
  
  // ZP-2026-1001: NEW
  const req1 = await prisma.request.upsert({
    where: { number: "ZP-2026-1001" },
    update: {},
    create: {
      number: "ZP-2026-1001",
      customerId: customerAlex.id,
      status: "NEW",
      priority: "HIGH",
      customerNameSnapshot: "Алексей Смирнов",
      customerPhoneSnapshot: "+7 911 222-33-44",
      customerEmailSnapshot: "alex.smirnov.demo@mail.ru",
      vehicleMake: "BMW",
      vehicleModel: "X5 (G05)",
      vehicleYear: "2021",
      vehicleVin: "WBAJU81000L778901",
      customerComment: "Нужны передние вентилируемые тормозные диски и комплект колодок M-Sport.",
      items: {
        create: [
          {
            description: "Диск тормозной передний вентилируемый (комплект 2 шт)",
            requestedPartNumber: "34116886481",
            quantity: 2,
            conditionPreference: "NEW",
            compatibilityNotes: "BMW X5 G05 M-Sport тормозная система 395 мм",
          },
        ],
      },
    },
  });

  // ZP-2026-1002: ASSIGNED
  const req2 = await prisma.request.upsert({
    where: { number: "ZP-2026-1002" },
    update: {},
    create: {
      number: "ZP-2026-1002",
      customerId: customerVictor.id,
      assignedManagerId: ownerUser.id,
      managerNameSnapshot: ownerName,
      status: "ASSIGNED",
      priority: "NORMAL",
      customerNameSnapshot: "Виктор Ковалёв",
      customerPhoneSnapshot: "+375 29 888-77-66",
      vehicleMake: "Toyota",
      vehicleModel: "Land Cruiser Prado (150)",
      vehicleYear: "2019",
      vehicleVin: "JTEBU3FJ005881234",
      customerComment: "Стойки амортизаторов передние + задние амортизаторы (оригинал или KYB Gas-A-Just).",
      items: {
        create: [
          {
            description: "Амортизатор передний газомасляный",
            requestedPartNumber: "48510-69415",
            quantity: 2,
            conditionPreference: "NEW",
          },
          {
            description: "Амортизатор задний",
            requestedPartNumber: "48530-69435",
            quantity: 2,
            conditionPreference: "NEW",
          },
        ],
      },
    },
  });

  // ZP-2026-1003: OFFERS_READY
  const req3 = await prisma.request.upsert({
    where: { number: "ZP-2026-1003" },
    update: {},
    create: {
      number: "ZP-2026-1003",
      customerId: customerFleet.id,
      assignedManagerId: ownerUser.id,
      managerNameSnapshot: ownerName,
      status: "OFFERS_READY",
      priority: "HIGH",
      customerNameSnapshot: "ООО «ТехноПарк Авто»",
      customerPhoneSnapshot: "+7 999 100-20-30",
      vehicleMake: "Audi",
      vehicleModel: "A6 Allroad",
      vehicleYear: "2020",
      vehicleVin: "WAUZZZF27LN019283",
      customerComment: "Рулевая рейка в сборе с сервоприводом. Рассматриваем оригинал новый или контрактную из Европы с гарантией.",
      items: {
        create: [
          {
            description: "Рулевая рейка с электроусилителем",
            requestedPartNumber: "4K1423055AC",
            quantity: 1,
            conditionPreference: "NEW",
            supplierQuotes: {
              create: [
                {
                  supplierId: supplierRu.id,
                  partNumber: "4K1423055AC",
                  manufacturer: "VAG",
                  condition: "NEW",
                  purchasePrice: 95000,
                  currency: "RUB",
                  quantityAvailable: 1,
                  deliveryCost: 800,
                  deliveryDays: 2,
                  status: "RECEIVED",
                },
                {
                  supplierId: supplierPl.id,
                  partNumber: "4K1423055AC-USED",
                  manufacturer: "VAG OEM",
                  condition: "USED",
                  purchasePrice: 42000,
                  currency: "RUB",
                  quantityAvailable: 1,
                  deliveryCost: 3500,
                  deliveryDays: 9,
                  status: "RECEIVED",
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ZP-2026-1004: SENT_TO_CUSTOMER
  const req4 = await prisma.request.upsert({
    where: { number: "ZP-2026-1004" },
    update: {},
    create: {
      number: "ZP-2026-1004",
      customerId: customerAlex.id,
      assignedManagerId: ownerUser.id,
      managerNameSnapshot: ownerName,
      status: "SENT_TO_CUSTOMER",
      customerOfferStatus: "SENT",
      priority: "NORMAL",
      customerNameSnapshot: "Алексей Смирнов",
      customerPhoneSnapshot: "+7 911 222-33-44",
      vehicleMake: "BMW",
      vehicleModel: "X5 (G05)",
      vehicleYear: "2021",
      vehicleVin: "WBAJU81000L778901",
      customerComment: "Официальное КП на комплект колодок и датчиков отправлено на согласование.",
      items: {
        create: [
          {
            description: "Комплект тормозных колодок передних Brembo Ceramic",
            requestedPartNumber: "P06099N",
            quantity: 1,
            conditionPreference: "NEW",
          },
          {
            description: "Датчик износа тормозных колодок",
            requestedPartNumber: "34356870351",
            quantity: 1,
            conditionPreference: "NEW",
          },
        ],
      },
    },
  });

  // ZP-2026-1005: CONFIRMED
  const req5 = await prisma.request.upsert({
    where: { number: "ZP-2026-1005" },
    update: {},
    create: {
      number: "ZP-2026-1005",
      customerId: customerFleet.id,
      assignedManagerId: ownerUser.id,
      managerNameSnapshot: ownerName,
      status: "CONFIRMED",
      customerOfferStatus: "ACCEPTED",
      priority: "HIGH",
      customerNameSnapshot: "ООО «ТехноПарк Авто»",
      customerPhoneSnapshot: "+7 999 100-20-30",
      vehicleMake: "Mercedes-Benz",
      vehicleModel: "Sprinter (906)",
      vehicleYear: "2018",
      vehicleVin: "WDB9066351S889100",
      customerComment: "Согласовано клиентом, сформирован заказ в доставку СДЭК.",
      items: {
        create: [
          {
            description: "Турбокомпрессор Garrett для OM651",
            requestedPartNumber: "A6510906080",
            quantity: 1,
            conditionPreference: "NEW",
          },
        ],
      },
    },
  });

  console.log("  ✓ 5 CRM Requests seeded across NEW, ASSIGNED, OFFERS_READY, SENT_TO_CUSTOMER, CONFIRMED");

  // 8. Seed Synthetic Orders
  console.log("8. Seeding Synthetic Orders...");
  const order1 = await prisma.order.upsert({
    where: { orderNumber: "ORD-2026-0041" },
    update: {},
    create: {
      orderNumber: "ORD-2026-0041",
      customerId: customerFleet.id,
      requestId: req5.id,
      assignedManagerId: ownerUser.id,
      status: "IN_FULFILLMENT",
      paymentStatus: "PAID",
      fulfillmentStatus: "UNFULFILLED",
      deliveryStatus: "PENDING",
      subtotal: 58000,
      logisticsTotal: 1200,
      grandTotal: 59200,
      customerComment: "Оплата по счету № 108 от 08.11.2026 поступила. Готовится к отправке в СДЭК.",
      items: {
        create: [
          {
            requestedPartNumber: "A6510906080",
            nameOnPurchase: "Турбокомпрессор Garrett для OM651 Mercedes-Benz",
            quantity: 1,
            condition: "NEW",
            supplierId: supplierRu.id,
            purchasePrice: 45000,
            salePrice: 58000,
            totalAmount: 58000,
            grossProfit: 13000,
          },
        ],
      },
      shipments: {
        create: [
          {
            carrier: "СДЭК",
            tariff: "Курьер до двери",
            status: "PENDING",
            address: "Москва, Пресненская наб. 12",
          },
        ],
      },
    },
  });

  const order2 = await prisma.order.upsert({
    where: { orderNumber: "ORD-2026-0042" },
    update: {},
    create: {
      orderNumber: "ORD-2026-0042",
      customerId: customerAlex.id,
      assignedManagerId: ownerUser.id,
      status: "SHIPPED",
      paymentStatus: "PAID",
      fulfillmentStatus: "FULFILLED",
      deliveryStatus: "IN_TRANSIT",
      subtotal: 32400,
      logisticsTotal: 850,
      grandTotal: 33250,
      customerComment: "Отправлено СДЭК, трек-номер передан покупателю.",
      items: {
        create: [
          {
            requestedPartNumber: "34116886481",
            nameOnPurchase: "Диск тормозной вентилируемый BMW M-Performance",
            quantity: 2,
            condition: "NEW",
            supplierId: supplierRu.id,
            purchasePrice: 25000,
            salePrice: 32400,
            totalAmount: 32400,
            grossProfit: 7400,
          },
        ],
      },
      shipments: {
        create: [
          {
            carrier: "СДЭК",
            trackingNumber: "1548920194",
            tariff: "Экспресс",
            status: "IN_TRANSIT",
            address: "Санкт-Петербург, Лиговский пр. 50",
          },
        ],
      },
    },
  });

  console.log("  ✓ 2 Orders seeded (PROCESSING and SHIPPED with CDEK tracking 1548920194)");

  console.log("\n========================================================");
  console.log(" STAGING DEMO CRM SEED COMPLETED SUCCESSFULLY!");
  console.log(` DEMO VIEWER: ${demoEmail} (Read-only, Zero financial leak)`);
  console.log(` SUPER ADMIN: ${ownerEmail} (Full CRM access)`);
  console.log("========================================================");
}

main()
  .catch((err) => {
    console.error("SEEDING FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
