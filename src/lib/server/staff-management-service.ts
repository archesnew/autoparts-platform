import "server-only";

import { prisma } from "@/lib/server/db.ts";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import type { StaffContext } from "@/lib/server/staff-session.ts";
import type { InvitationStatus, PermissionEffect } from "@prisma/client";

export type StaffRoleCode = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "LOGISTICS" | "DEMO_VIEWER";

export type StaffMemberDto = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: string;
  active: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
  lastSessionAt?: string;
  permissions: string[];
  permissionOverrides: { permissionCode: string; effect: "GRANT" | "DENY" }[];
};

export type StaffInvitationDto = {
  id: string;
  email: string;
  name: string;
  jobTitle: string;
  role: string;
  permissions?: { permissionCode: string; effect: "GRANT" | "DENY" }[];
  token: string;
  status: InvitationStatus;
  invitedById?: string | null;
  invitedByName?: string | null;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  inviteUrl?: string;
};

export type StaffAuditEntryDto = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  details: Record<string, unknown> | null;
  occurredAt: string;
};

export class StaffManagementService {
  /**
   * List all internal staff members (excluding suppliers)
   */
  async listStaff(
    params: {
      query?: string;
      role?: string;
      active?: boolean;
    },
    caller: StaffContext,
  ): Promise<StaffMemberDto[]> {
    const where: any = {
      role: { not: "SUPPLIER" },
      supplierMembership: null,
    };

    if (params.role) {
      where.role = params.role;
    }

    if (typeof params.active === "boolean") {
      where.active = params.active;
    }

    if (params.query?.trim()) {
      const q = params.query.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { jobTitle: { contains: q, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        sessions: {
          select: {
            id: true,
            expiresAt: true,
            createdAt: true,
          },
          where: {
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        },
        roleDefinition: {
          include: {
            permissions: {
              select: { permissionCode: true },
            },
          },
        },
        permissionOverrides: {
          select: { permissionCode: true, effect: true },
        },
      },
      orderBy: [
        { active: "desc" },
        { createdAt: "desc" },
      ],
    });

    const allPermissions = await prisma.staffPermission.findMany({
      select: { code: true },
    });

    return users.map((user) => {
      const rolePerms = new Set(user.roleDefinition.permissions.map((p) => p.permissionCode));
      const effectivePerms = new Set(rolePerms);

      for (const override of user.permissionOverrides) {
        if (override.effect === "GRANT") effectivePerms.add(override.permissionCode);
        else effectivePerms.delete(override.permissionCode);
      }

      if (user.role === "SUPER_ADMIN") {
        for (const p of allPermissions) effectivePerms.add(p.code);
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email || "",
        jobTitle: user.jobTitle || "",
        role: user.role,
        active: user.active,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        activeSessionCount: user.sessions.length,
        lastSessionAt: user.sessions[0]?.createdAt.toISOString(),
        permissions: [...effectivePerms],
        permissionOverrides: user.permissionOverrides.map((o) => ({
          permissionCode: o.permissionCode,
          effect: o.effect as "GRANT" | "DENY",
        })),
      };
    });
  }

  /**
   * Get single staff member details
   */
  async getStaffMember(id: string, caller: StaffContext): Promise<StaffMemberDto> {
    const user = await prisma.user.findFirst({
      where: {
        id,
        role: { not: "SUPPLIER" },
        supplierMembership: null,
      },
      include: {
        sessions: {
          select: { id: true, expiresAt: true, createdAt: true, ipAddress: true, userAgent: true },
          where: { expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        },
        roleDefinition: {
          include: {
            permissions: { select: { permissionCode: true } },
          },
        },
        permissionOverrides: {
          select: { permissionCode: true, effect: true },
        },
      },
    });

    if (!user) throw new Error("Сотрудник не найден");

    const allPermissions = await prisma.staffPermission.findMany({ select: { code: true } });
    const rolePerms = new Set(user.roleDefinition.permissions.map((p) => p.permissionCode));
    const effectivePerms = new Set(rolePerms);

    for (const override of user.permissionOverrides) {
      if (override.effect === "GRANT") effectivePerms.add(override.permissionCode);
      else effectivePerms.delete(override.permissionCode);
    }

    if (user.role === "SUPER_ADMIN") {
      for (const p of allPermissions) effectivePerms.add(p.code);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email || "",
      jobTitle: user.jobTitle || "",
      role: user.role,
      active: user.active,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      activeSessionCount: user.sessions.length,
      lastSessionAt: user.sessions[0]?.createdAt.toISOString(),
      permissions: [...effectivePerms],
      permissionOverrides: user.permissionOverrides.map((o) => ({
        permissionCode: o.permissionCode,
        effect: o.effect as "GRANT" | "DENY",
      })),
    };
  }

  /**
   * Create an invitation for a staff member (7-day token)
   */
  async createInvitation(
    params: {
      name: string;
      email: string;
      jobTitle?: string;
      role: "ADMIN" | "MANAGER" | "LOGISTICS";
      permissions?: { permissionCode: string; effect: "GRANT" | "DENY" }[];
    },
    caller: StaffContext,
    baseUrl = "",
  ): Promise<StaffInvitationDto> {
    if (caller.role !== "SUPER_ADMIN") {
      throw new Error("Только SUPER_ADMIN может создавать приглашения для сотрудников");
    }

    if (params.role === ("SUPER_ADMIN" as any)) {
      throw new Error("Нельзя создать второго SUPER_ADMIN через форму");
    }

    if (!["ADMIN", "MANAGER", "LOGISTICS"].includes(params.role)) {
      throw new Error("Недопустимая роль сотрудника");
    }

    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Укажите корректный email");
    if (!cleanName) throw new Error("Укажите ФИО сотрудника");

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      throw new Error(`Пользователь с email ${cleanEmail} уже зарегистрирован`);
    }

    // Invalidate any existing pending invitations for this email
    await prisma.staffInvitation.updateMany({
      where: { email: cleanEmail, status: "PENDING" },
      data: { status: "REVOKED" },
    });

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.staffInvitation.create({
      data: {
        email: cleanEmail,
        name: cleanName,
        jobTitle: params.jobTitle?.trim() || null,
        role: params.role,
        permissions: params.permissions ? (params.permissions as any) : null,
        token,
        status: "PENDING",
        invitedById: caller.userId,
        expiresAt,
      },
    });

    // Record audit event
    await prisma.activityLog.create({
      data: {
        actorId: caller.userId,
        entityType: "STAFF",
        entityId: invitation.id,
        action: "STAFF_INVITED",
        details: {
          email: cleanEmail,
          name: cleanName,
          role: params.role,
          jobTitle: params.jobTitle || "",
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      jobTitle: invitation.jobTitle || "",
      role: invitation.role,
      permissions: params.permissions,
      token: invitation.token,
      status: invitation.status,
      invitedById: caller.userId,
      invitedByName: caller.name,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      inviteUrl: baseUrl ? `${baseUrl}/staff/invite/${token}` : `/staff/invite/${token}`,
    };
  }

  /**
   * List staff invitations
   */
  async listInvitations(
    params: { status?: InvitationStatus },
    caller: StaffContext,
    baseUrl = "",
  ): Promise<StaffInvitationDto[]> {
    const where: any = {};
    if (params.status) where.status = params.status;

    const list = await prisma.staffInvitation.findMany({
      where,
      include: {
        invitedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return list.map((inv) => ({
      id: inv.id,
      email: inv.email,
      name: inv.name,
      jobTitle: inv.jobTitle || "",
      role: inv.role,
      permissions: inv.permissions as any,
      token: inv.token,
      status: inv.status,
      invitedById: inv.invitedById,
      invitedByName: inv.invitedBy?.name || null,
      expiresAt: inv.expiresAt.toISOString(),
      acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
      inviteUrl: baseUrl ? `${baseUrl}/staff/invite/${inv.token}` : `/staff/invite/${inv.token}`,
    }));
  }

  /**
   * Revoke an active staff invitation
   */
  async revokeInvitation(id: string, caller: StaffContext): Promise<void> {
    if (caller.role !== "SUPER_ADMIN") {
      throw new Error("Только SUPER_ADMIN может отзывать приглашения");
    }

    const invitation = await prisma.staffInvitation.findUnique({ where: { id } });
    if (!invitation) throw new Error("Приглашение не найдено");
    if (invitation.status !== "PENDING") {
      throw new Error("Можно отозвать только активное приглашение");
    }

    await prisma.staffInvitation.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    await prisma.activityLog.create({
      data: {
        actorId: caller.userId,
        entityType: "STAFF",
        entityId: id,
        action: "STAFF_INVITATION_REVOKED",
        details: {
          email: invitation.email,
          role: invitation.role,
        },
      },
    });
  }

  /**
   * Get public invitation data by token for the invite setup screen
   */
  async getInvitationByToken(token: string) {
    const cleanToken = token.trim();
    const invitation = await prisma.staffInvitation.findUnique({
      where: { token: cleanToken },
    });

    if (!invitation) throw new Error("Приглашение не найдено");
    if (invitation.status !== "PENDING") {
      throw new Error("Это приглашение уже использовано или отозвано");
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new Error("Срок действия приглашения (7 дней) истёк");
    }

    return {
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      jobTitle: invitation.jobTitle || "",
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Accept an invitation and initialize employee account with password
   */
  async acceptInvitation(params: {
    token: string;
    name?: string;
    password: string;
  }): Promise<{ id: string; email: string; name: string; role: string }> {
    const { token, password } = params;
    if (!password || password.length < 8) {
      throw new Error("Пароль должен содержать не менее 8 символов");
    }

    const invitation = await prisma.staffInvitation.findUnique({
      where: { token: token.trim() },
    });

    if (!invitation) throw new Error("Приглашение не найдено");
    if (invitation.status !== "PENDING") {
      throw new Error("Приглашение уже использовано или отозвано");
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new Error("Срок действия приглашения истёк");
    }

    const cleanEmail = invitation.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      throw new Error(`Пользователь с email ${cleanEmail} уже существует`);
    }

    const finalName = (params.name?.trim() || invitation.name).trim();
    const hashedPassword = await hashPassword(password);
    const userId = randomUUID();

    await prisma.$transaction(async (tx) => {
      // 1. Create User
      await tx.user.create({
        data: {
          id: userId,
          name: finalName,
          email: cleanEmail,
          jobTitle: invitation.jobTitle,
          role: invitation.role,
          active: true,
          emailVerified: true,
        },
      });

      // 2. Create Credential Account
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashedPassword,
        },
      });

      // 3. Apply custom permission overrides if any were attached to the invitation
      if (Array.isArray(invitation.permissions)) {
        for (const item of invitation.permissions as any[]) {
          if (item?.permissionCode && (item.effect === "GRANT" || item.effect === "DENY")) {
            await tx.userPermission.create({
              data: {
                userId,
                permissionCode: item.permissionCode,
                effect: item.effect as PermissionEffect,
              },
            });
          }
        }
      }

      // 4. Mark invitation ACCEPTED
      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      // 5. Activity log
      await tx.activityLog.create({
        data: {
          actorId: userId,
          entityType: "STAFF",
          entityId: userId,
          action: "STAFF_REGISTERED",
          details: {
            email: cleanEmail,
            role: invitation.role,
            jobTitle: invitation.jobTitle,
          },
        },
      });
    });

    return {
      id: userId,
      email: cleanEmail,
      name: finalName,
      role: invitation.role,
    };
  }

  /**
   * Update staff member details, role, and permission overrides
   */
  async updateStaffMember(
    id: string,
    params: {
      name?: string;
      jobTitle?: string;
      role?: "ADMIN" | "MANAGER" | "LOGISTICS";
      permissionOverrides?: { permissionCode: string; effect: "GRANT" | "DENY" }[];
    },
    caller: StaffContext,
  ): Promise<StaffMemberDto> {
    const target = await prisma.user.findFirst({
      where: { id, role: { not: "SUPPLIER" }, supplierMembership: null },
      include: { permissionOverrides: true },
    });

    if (!target) throw new Error("Сотрудник не найден");

    // Security guards
    if (caller.role !== "SUPER_ADMIN") {
      throw new Error("Только SUPER_ADMIN может изменять данные и роли сотрудников");
    }

    if (target.role === "SUPER_ADMIN" && caller.userId !== target.id) {
      throw new Error("Нельзя редактировать главного администратора системы");
    }

    if (params.role && params.role === ("SUPER_ADMIN" as any) && target.role !== "SUPER_ADMIN") {
      throw new Error("Нельзя назначить роль SUPER_ADMIN");
    }

    const updateData: any = {};
    if (params.name?.trim()) updateData.name = params.name.trim();
    if (typeof params.jobTitle === "string") updateData.jobTitle = params.jobTitle.trim();
    if (params.role && ["ADMIN", "MANAGER", "LOGISTICS"].includes(params.role)) {
      updateData.role = params.role;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id },
          data: updateData,
        });
      }

      // Update permission overrides if provided
      if (params.permissionOverrides) {
        await tx.userPermission.deleteMany({ where: { userId: id } });
        for (const override of params.permissionOverrides) {
          if (override.permissionCode && (override.effect === "GRANT" || override.effect === "DENY")) {
            await tx.userPermission.create({
              data: {
                userId: id,
                permissionCode: override.permissionCode,
                effect: override.effect as PermissionEffect,
              },
            });
          }
        }
      }

      await tx.activityLog.create({
        data: {
          actorId: caller.userId,
          entityType: "STAFF",
          entityId: id,
          action: "STAFF_UPDATED",
          details: {
            changes: {
              name: params.name,
              jobTitle: params.jobTitle,
              role: params.role,
              permissionOverridesCount: params.permissionOverrides?.length,
            },
          },
        },
      });
    });

    return this.getStaffMember(id, caller);
  }

  /**
   * Block or unblock staff member. Blocking immediately terminates all active sessions.
   */
  async setStaffActiveStatus(
    id: string,
    active: boolean,
    caller: StaffContext,
  ): Promise<{ id: string; active: boolean }> {
    if (caller.role !== "SUPER_ADMIN") {
      throw new Error("Только SUPER_ADMIN может блокировать и восстанавливать сотрудников");
    }

    if (id === caller.userId) {
      throw new Error("Вы не можете заблокировать собственный аккаунт");
    }

    const target = await prisma.user.findFirst({
      where: { id, role: { not: "SUPPLIER" }, supplierMembership: null },
    });

    if (!target) throw new Error("Сотрудник не найден");
    if (target.role === "SUPER_ADMIN") {
      throw new Error("Нельзя заблокировать SUPER_ADMIN");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { active },
      });

      // If deactivated, terminate all active sessions immediately
      if (!active) {
        await tx.session.deleteMany({
          where: { userId: id },
        });
      }

      await tx.activityLog.create({
        data: {
          actorId: caller.userId,
          entityType: "STAFF",
          entityId: id,
          action: active ? "STAFF_UNBLOCKED" : "STAFF_BLOCKED",
          details: {
            email: target.email,
            role: target.role,
          },
        },
      });
    });

    return { id, active };
  }

  /**
   * Terminate all active sessions of a staff member
   */
  async terminateStaffSessions(
    id: string,
    caller: StaffContext,
  ): Promise<{ terminatedCount: number }> {
    if (caller.role !== "SUPER_ADMIN" && caller.userId !== id) {
      throw new Error("Только SUPER_ADMIN может завершать сессии других сотрудников");
    }

    const target = await prisma.user.findFirst({
      where: { id, role: { not: "SUPPLIER" }, supplierMembership: null },
    });

    if (!target) throw new Error("Сотрудник не найден");

    const deleted = await prisma.session.deleteMany({
      where: { userId: id },
    });

    await prisma.activityLog.create({
      data: {
        actorId: caller.userId,
        entityType: "STAFF",
        entityId: id,
        action: "STAFF_SESSIONS_TERMINATED",
        details: {
          count: deleted.count,
        },
      },
    });

    return { terminatedCount: deleted.count };
  }

  /**
   * Get audit log history for staff
   */
  async getStaffAuditHistory(
    targetUserId?: string,
    caller?: StaffContext,
  ): Promise<StaffAuditEntryDto[]> {
    const where: any = {
      entityType: "STAFF",
    };

    if (targetUserId) {
      where.entityId = targetUserId;
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });

    return logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorName: log.actor?.name || "Система",
      action: log.action,
      details: (log.details as Record<string, unknown>) || null,
      occurredAt: log.occurredAt.toISOString(),
    }));
  }

  /**
   * List all available permissions in the system for permission management UI
   */
  async listAllPermissions(): Promise<{ code: string; description: string }[]> {
    return prisma.staffPermission.findMany({
      orderBy: { code: "asc" },
    });
  }
}

export const staffManagementService = new StaffManagementService();
