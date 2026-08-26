import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { permissions, rolePresets, type RolePresetCode } from "@crmkaro/permissions";
import { DATABASE } from "../database/database.module.js";

@Injectable()
export class AccessService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  listPermissions() {
    return permissions.map((code) => ({ code, module: code.split(".")[0] }));
  }

  listRoles(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, (tx) => tx.role.findMany({
      where: { organisationId },
      orderBy: { name: "asc" },
      include: { permissions: { include: { permission: true } }, _count: { select: { memberships: true } } },
    }));
  }

  listServices(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, (tx) => tx.service.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
      include: { organisations: { where: { organisationId } } },
    }));
  }

  setServiceStatus(organisationId: string, userId: string, serviceCode: string, enabled: boolean) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const service = await tx.service.findUnique({ where: { code: serviceCode } });
      if (!service || service.status !== "ACTIVE") throw new NotFoundException("Service not found.");
      const entitlement = await tx.organisationService.upsert({
        where: { organisationId_serviceId: { organisationId, serviceId: service.id } },
        create: { organisationId, serviceId: service.id, status: enabled ? "ACTIVE" : "DISABLED", activatedAt: enabled ? new Date() : null, disabledAt: enabled ? null : new Date() },
        update: { status: enabled ? "ACTIVE" : "DISABLED", activatedAt: enabled ? new Date() : undefined, disabledAt: enabled ? null : new Date() },
      });
      await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: enabled ? "service.enabled" : "service.disabled", entityType: "service", entityId: service.id, metadata: { serviceCode } } });
      return entitlement;
    });
  }

  assignRole(organisationId: string, userId: string, membershipId: string, roleCode: RolePresetCode) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const membership = await tx.organisationMembership.findFirst({ where: { id: membershipId, organisationId }, include: { role: true } });
      const role = await tx.role.findUnique({ where: { organisationId_code: { organisationId, code: roleCode } } });
      if (!membership) throw new NotFoundException("Membership not found.");
      if (!role) throw new NotFoundException("Role not found.");
      if (membership.userId === userId && membership.role.code === "owner" && roleCode !== "owner") {
        const owners = await tx.organisationMembership.count({ where: { organisationId, status: "ACTIVE", role: { code: "owner" } } });
        if (owners === 1) throw new ConflictException("The organisation must retain an active owner.");
      }
      if (membership.role.code === "owner" && roleCode !== "owner") {
        const owners = await tx.organisationMembership.count({ where: { organisationId, status: "ACTIVE", role: { code: "owner" } } });
        if (owners === 1) throw new ForbiddenException("The organisation must retain an active owner.");
      }
      const updated = await tx.organisationMembership.update({ where: { id: membership.id }, data: { roleId: role.id }, include: { role: true } });
      await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "membership.role_changed", entityType: "organisation_membership", entityId: membership.id, changes: { before: membership.role.code, after: roleCode } } });
      return updated;
    });
  }

  listAudit(organisationId: string, userId: string, limit: number, cursor?: string, action?: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const rows = await tx.auditLog.findMany({
        where: { organisationId, ...(action ? { action } : {}) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
    });
  }
}
