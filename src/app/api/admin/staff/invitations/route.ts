import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { staffManagementService } from "@/lib/server/staff-management-service.ts";
import type { InvitationStatus } from "@prisma/client";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("employees.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams, origin } = new URL(request.url);
  const status = (searchParams.get("status") || undefined) as InvitationStatus | undefined;

  try {
    const list = await staffManagementService.listInvitations({ status }, staff, origin);
    return Response.json({ invitations: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список приглашений";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staff = await authorizeStaffApi("employees.manage", request.headers);
  if (staff instanceof Response) return staff;

  const { origin } = new URL(request.url);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const { name, email, jobTitle, role, permissions } = body;
  if (!name || !email || !role) {
    return Response.json({ error: "Поля name, email и role обязательны" }, { status: 400 });
  }

  try {
    const invitation = await staffManagementService.createInvitation(
      { name, email, jobTitle, role, permissions },
      staff,
      origin,
    );
    return Response.json({ success: true, invitation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка создания приглашения";
    return Response.json({ error: message }, { status: 400 });
  }
}
