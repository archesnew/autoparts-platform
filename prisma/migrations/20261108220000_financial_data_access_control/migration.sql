-- Commercial Policy: Financial Data Access Control
-- 1. SUPER_ADMIN sees all financial data.
-- 2. ADMIN gets access to financial data only through individual permission overrides.
-- 3. MANAGER by default does NOT see purchase prices, markups, minimum markup, gross profit, margin, or financial adjustments.

DELETE FROM "role_permissions"
WHERE "role_code" = 'MANAGER'
  AND "permission_code" IN ('quotes.purchase.read', 'finance.read', 'finance.settings.read', 'finance.settings.update');

DELETE FROM "role_permissions"
WHERE "role_code" = 'ADMIN'
  AND "permission_code" IN ('quotes.purchase.read', 'finance.read', 'finance.settings.read', 'finance.settings.update');
