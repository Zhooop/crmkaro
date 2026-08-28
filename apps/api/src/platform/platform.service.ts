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

  async updateOrganisationStatus(orgId: string, status: "ACTIVE" | "SUSPENDED" | "CLOSED", actorUserId?: string) {
    const updated = await this.database.organisation.update({
      where: { id: orgId },
      data: { status },
    });

    if (actorUserId) {
      await this.database.auditLog.create({
        data: {
          organisationId: orgId,
          actorUserId,
          action: `organisation.status.${status.toLowerCase()}`,
          entityType: "ORGANISATION",
          entityId: orgId,
          metadata: { status },
        },
      });
    }

    return { organisation: updated };
  }

  async updateOrganisationServices(orgId: string, serviceCodes: string[], actorUserId?: string) {
    const allServices = await this.database.service.findMany();
    const serviceMap = new Map(allServices.map((s) => [s.code, s.id]));

    // Deactivate services not in serviceCodes
    await this.database.organisationService.updateMany({
      where: {
        organisationId: orgId,
        service: { code: { notIn: serviceCodes } },
      },
      data: { status: "DISABLED" },
    });

    // Activate or upsert services in serviceCodes
    for (const code of serviceCodes) {
      const serviceId = serviceMap.get(code);
      if (serviceId) {
        await this.database.organisationService.upsert({
          where: {
            organisationId_serviceId: { organisationId: orgId, serviceId },
          },
          update: { status: "ACTIVE" },
          create: { organisationId: orgId, serviceId, status: "ACTIVE" },
        });
      }
    }

    if (actorUserId) {
      await this.database.auditLog.create({
        data: {
          organisationId: orgId,
          actorUserId,
          action: "organisation.services.updated",
          entityType: "ORGANISATION",
          entityId: orgId,
          metadata: { serviceCodes },
        },
      });
    }

    return { success: true, serviceCodes };
  }

  async createOrganisation(
    input: {
      name: string;
      businessType?: string;
      currency?: string;
      timezone?: string;
      ownerEmail?: string;
      serviceCodes?: string[];
    },
    actorUserId?: string,
  ) {
    const slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .concat("-", Math.random().toString(36).slice(2, 6));

    const org = await this.database.organisation.create({
      data: {
        name: input.name,
        slug,
        businessType: input.businessType || "General",
        currency: input.currency || "INR",
        timezone: input.timezone || "Asia/Kolkata",
        status: "ACTIVE",
      },
    });

    // If owner email provided, link or create user and owner role
    if (input.ownerEmail) {
      const user = await this.database.user.upsert({
        where: { email: input.ownerEmail.toLowerCase().trim() },
        update: {},
        create: {
          email: input.ownerEmail.toLowerCase().trim(),
          name: input.name + " Admin",
          status: "ACTIVE",
        },
      });

      const ownerRole = await this.database.role.findFirst({
        where: { code: "owner" },
      });

      if (ownerRole) {
        await this.database.organisationMembership.create({
          data: {
            organisationId: org.id,
            userId: user.id,
            roleId: ownerRole.id,
            status: "ACTIVE",
          },
        });
      }
    }

    // Assign services
    const serviceCodes = input.serviceCodes || ["crm", "finance", "people", "payroll", "inventory"];
    const allServices = await this.database.service.findMany();
    for (const s of allServices) {
      if (serviceCodes.includes(s.code)) {
        await this.database.organisationService.create({
          data: {
            organisationId: org.id,
            serviceId: s.id,
            status: "ACTIVE",
          },
        });
      }
    }

    if (actorUserId) {
      await this.database.auditLog.create({
        data: {
          organisationId: org.id,
          actorUserId,
          action: "organisation.created",
          entityType: "ORGANISATION",
          entityId: org.id,
          metadata: { name: org.name, slug: org.slug },
        },
      });
    }

    return { organisation: org };
  }

  async getHealth() {
    const [
      totalUsers,
      totalOrganisations,
      totalPeople,
      totalInvoices,
      totalLeads,
      totalAuditLogs,
    ] = await Promise.all([
      this.database.user.count(),
      this.database.organisation.count(),
      this.database.person.count(),
      this.database.invoice.count(),
      this.database.lead.count(),
      this.database.auditLog.count(),
    ]);

    const memoryUsage = process.memoryUsage();

    return {
      status: "HEALTHY",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: "CONNECTED",
        counts: {
          users: totalUsers,
          organisations: totalOrganisations,
          people: totalPeople,
          invoices: totalInvoices,
          leads: totalLeads,
          auditLogs: totalAuditLogs,
        },
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        rssMemoryMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
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
