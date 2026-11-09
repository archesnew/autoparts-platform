import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { catalogService } from "@/lib/server/catalog-service";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  if (!id) {
    return Response.json({ error: "ID товара обязателен" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const isInternal = searchParams.get("internal") === "true";

  try {
    if (isInternal) {
      const staff = await authorizeStaffApi("quotes.read", request.headers);
      if (staff instanceof Response) return staff;

      const canReadPurchase = staff.role === "SUPER_ADMIN" || staff.permissions.includes("quotes.purchase.read");
      const product = await catalogService.getStaffProductById(id, canReadPurchase);
      if (!product) {
        return Response.json({ error: "Товар не найден" }, { status: 404 });
      }
      return Response.json(product);
    }

    const product = await catalogService.getPublicProductById(id);
    if (!product) {
      return Response.json({ error: "Товар не найден" }, { status: 404 });
    }
    return Response.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения товара";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("quotes.manage", request.headers);
  if (staff instanceof Response) return staff;

  const params = await props.params;
  const { id } = params;

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  try {
    if (body.action === "ARCHIVE") {
      const archived = await catalogService.archiveProduct(id);
      return Response.json({ ok: true, product: archived });
    }
    return Response.json({ error: "Действие не поддерживается" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обновления товара";
    return Response.json({ error: message }, { status: 500 });
  }
}
