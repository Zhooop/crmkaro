import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";

@Injectable()
export class PlatformService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async overview() {
    const totalOrganisations = await this.database.organisation.count();
    const activeOrganisations = await this.database.organisation.count({
      where: { status: "ACTIVE" },
    });
    const totalUsers = await this.database.user.count({
      where: { status: "ACTIVE" },
    });
    const totalServicesActive = await this.database.organisationService.count({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
    });

    const recentOrganisations = await this.database.organisation.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        services: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { service: true },
        },
        _count: { select: { memberships: true } },
      },
    });

    const recentAudit = await this.database.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, email: true } },
        organisation: { select: { name: true } },
      },
    });

    // Service adoption breakdown
    const services = await this.database.service.findMany({
      include: {
        _count: {
          select: {
            organisations: {
              where: { status: { in: ["ACTIVE", "TRIAL"] } },
            },
          },
        },
      },
    });

    return {
      stats: {
        organisations: totalOrganisations,
        activeOrganisations,
        totalUsers,
        activeServices: totalServicesActive,
      },
      recentOrganisations: recentOrganisations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        businessType: org.businessType || "Standard",
        currency: org.currency,
        status: org.status,
        memberCount: org._count.memberships,
        services: org.services.map((s) => s.service.name),
        createdAt: org.createdAt.toISOString(),
      })),
      recentAudit: recentAudit.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        actorName: log.actor?.name || log.actor?.email || "System",
        organisationName: log.organisation?.name || "Global",
        createdAt: log.createdAt.toISOString(),
      })),
      adoption: services.map((s) => ({
        code: s.code,
        name: s.name,
        count: s._count.organisations,
        percentage:
          totalOrganisations > 0
            ? Math.round((s._count.organisations / totalOrganisations) * 100)
            : 0,
      })),
    };
  }

  async listOrganisations() {
    const organisations = await this.database.organisation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        services: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { service: true },
        },
        _count: {
          select: {
            memberships: true,
            people: true,
            invoices: true,
            leads: true,
          },
        },
      },
    });

    return {
      organisations: organisations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        businessType: org.businessType || "General",
        status: org.status,
        currency: org.currency,
        timezone: org.timezone,
        memberCount: org._count.memberships,
        peopleCount: org._count.people,
        invoicesCount: org._count.invoices,
        leadsCount: org._count.leads,
        services: org.services.map((s) => ({
          code: s.service.code,
          name: s.service.name,
        })),
        createdAt: org.createdAt.toISOString(),
      })),
    };
  }

  async listAudit(limit = 50) {
    const logs = await this.database.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, email: true } },
        organisation: { select: { name: true } },
      },
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor?.name || log.actor?.email || "System",
        organisation: log.organisation?.name || "Global",
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}
