import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";
import { prisma } from "@/lib/server/db";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("suppliers.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await props.params;

  try {
    const users = await supplierPortalService.listSupplierUsers(id);
    const invitations = await prisma.supplierInvitation.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      ok: true,
      users,
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        token: inv.token,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения пользователей";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("suppliers.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await props.params;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "invite") {
      const { email, role } = body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return Response.json({ error: "Некорректный email для приглашения" }, { status: 400 });
      }

      const invitation = await supplierPortalService.createInvitation({
        supplierId: id,
        email,
        role: role || "MANAGER",
        invitedById: staff.userId,
      });

      return Response.json({
        ok: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          token: invitation.token,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
        },
      });
    }

    if (action === "create_direct") {
      const { name, email, password, role } = body;
      if (!name || !email || !password) {
        return Response.json({ error: "Заполните все обязательные поля" }, { status: 400 });
      }

      const created = await supplierPortalService.createSupplierUser({
        supplierId: id,
        name,
        email,
        password,
        role: role || "MANAGER",
      });

      return Response.json({ ok: true, user: created });
    }

    return Response.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка создания пользователя";
    return Response.json({ error: message }, { status: 400 });
  }
}
