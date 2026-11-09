-- Additive employee authentication and authorization schema.
-- Existing users are retained and their current role values are preserved.

CREATE TABLE "staff_roles" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "staff_roles_pkey" PRIMARY KEY ("code")
);

INSERT INTO "staff_roles" ("code", "name", "isSystem", "updatedAt") VALUES
  ('SUPER_ADMIN', 'Суперадминистратор', true, CURRENT_TIMESTAMP),
  ('ADMIN', 'Администратор', true, CURRENT_TIMESTAMP),
  ('MANAGER', 'Менеджер', true, CURRENT_TIMESTAMP),
  ('LOGISTICS', 'Логист', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Preserve any roles already present in an existing database instead of breaking the FK.
INSERT INTO "staff_roles" ("code", "name", "isSystem", "updatedAt")
SELECT DISTINCT "role", "role", false, CURRENT_TIMESTAMP FROM "users"
WHERE "role" IS NOT NULL AND btrim("role") <> ''
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "staff_permissions" (
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("code")
);

INSERT INTO "staff_permissions" ("code", "description") VALUES
  ('admin.access', 'Открывать внутреннюю CRM'),
  ('logistics.access', 'Открывать рабочее пространство логистики'),
  ('requests.read', 'Читать заявки и данные покупателей'),
  ('requests.create', 'Создавать заявки'),
  ('requests.update', 'Изменять заявки'),
  ('requests.assign', 'Назначать ответственных'),
  ('customers.read', 'Читать профили клиентов'),
  ('customers.update', 'Изменять профили клиентов'),
  ('customers.contact.read', 'Читать контакты покупателей'),
  ('customers.internal.read', 'Читать внутренние заметки клиентов'),
  ('suppliers.read', 'Читать данные поставщиков'),
  ('suppliers.manage', 'Управлять поставщиками'),
  ('quotes.read', 'Читать предложения поставщиков'),
  ('quotes.manage', 'Управлять предложениями поставщиков'),
  ('quotes.purchase.read', 'Читать закупочные цены и условия поставщиков'),
  ('analytics.read', 'Просматривать аналитику CRM'),
  ('finance.read', 'Просматривать финансовые расчёты'),
  ('finance.settings.read', 'Читать финансовые настройки'),
  ('finance.settings.update', 'Изменять финансовые настройки'),
  ('employees.read', 'Просматривать сотрудников и роли'),
  ('employees.manage', 'Управлять сотрудниками и ролями'),
  ('audit.read', 'Просматривать внутреннюю историю действий'),
  ('orders.read', 'Читать заказы'),
  ('orders.update', 'Изменять заказы'),
  ('shipments.read', 'Читать отправления'),
  ('shipments.update', 'Управлять отправлениями'),
  ('logistics.documents.read', 'Читать логистические документы'),
  ('system.manage', 'Управлять системными настройками')
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "role_permissions" (
  "role_code" TEXT NOT NULL,
  "permission_code" TEXT NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_code", "permission_code"),
  CONSTRAINT "role_permissions_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "staff_roles"("code") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "role_permissions_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "staff_permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TYPE "PermissionEffect" AS ENUM ('GRANT', 'DENY');

CREATE TABLE "user_permissions" (
  "user_id" UUID NOT NULL,
  "permission_code" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id", "permission_code"),
  CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_permissions_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "staff_permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- SUPER_ADMIN receives full access through the server policy engine, including future permissions.
INSERT INTO "role_permissions" ("role_code", "permission_code")
SELECT 'ADMIN', "code" FROM "staff_permissions"
WHERE "code" NOT IN ('system.manage', 'logistics.access', 'orders.read', 'orders.update', 'shipments.read', 'shipments.update', 'logistics.documents.read')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('MANAGER', 'admin.access'), ('MANAGER', 'requests.read'), ('MANAGER', 'requests.create'),
  ('MANAGER', 'requests.update'), ('MANAGER', 'requests.assign'), ('MANAGER', 'customers.read'),
  ('MANAGER', 'customers.update'), ('MANAGER', 'customers.contact.read'), ('MANAGER', 'customers.internal.read'),
  ('MANAGER', 'suppliers.read'), ('MANAGER', 'suppliers.manage'), ('MANAGER', 'quotes.read'),
  ('MANAGER', 'quotes.manage'), ('MANAGER', 'quotes.purchase.read'), ('MANAGER', 'analytics.read'),
  ('MANAGER', 'finance.read'), ('MANAGER', 'audit.read'),
  ('LOGISTICS', 'logistics.access'), ('LOGISTICS', 'orders.read'), ('LOGISTICS', 'orders.update'),
  ('LOGISTICS', 'shipments.read'), ('LOGISTICS', 'shipments.update'), ('LOGISTICS', 'logistics.documents.read')
ON CONFLICT DO NOTHING;

ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "image" TEXT;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MANAGER';
ALTER TABLE "users" ADD CONSTRAINT "users_role_fkey" FOREIGN KEY ("role") REFERENCES "staff_roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sessions" (
  "id" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "token" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

CREATE TABLE "accounts" (
  "id" UUID NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ(6),
  "refreshTokenExpiresAt" TIMESTAMPTZ(6),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

CREATE TABLE "verifications" (
  "id" UUID NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

CREATE TABLE "rate_limits" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,
  CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");
