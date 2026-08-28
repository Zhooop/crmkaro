import { Inject, Injectable } from "@nestjs/common";
import { type DatabaseClient, withPlatformAdmin } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";

@Injectable()
export class PlatformService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async overview() {
    return withPlatformAdmin(this.database, async (tx) => {
      const totalOrganisations = await tx.organisation.count();
      const activeOrganisations = await tx.organisation.count({
        where: { status: "ACTIVE" },
      });
      const totalUsers = await tx.user.count({
        where: { status: "ACTIVE" },
      });
      const totalServicesActive = await tx.organisationService.count({
        where: { status: { in: ["ACTIVE", "TRIAL"] } },
      });

      const recentOrganisations = await tx.organisation.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          services: {
            where: { status: { in: ["ACTIVE", "TRIAL"] } },
            include: { service: true },
          },
          _count: { select: { memberships: true } },
        },
      });

      const recentAudit = await tx.auditLog.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { name: true, email: true } },
          organisation: { select: { name: true } },
        },
      });

      // Service adoption breakdown
      const services = await tx.service.findMany({
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
    });
  }

  async listOrganisations() {
    return withPlatformAdmin(this.database, async (tx) => {
      const organisations = await tx.organisation.findMany({
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
    });
  }

  async updateOrganisationStatus(orgId: string, status: "ACTIVE" | "SUSPENDED" | "CLOSED", actorUserId?: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      const updated = await tx.organisation.update({
        where: { id: orgId },
        data: { status },
      });

      if (actorUserId) {
        await tx.auditLog.create({
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
    });
  }

  async updateOrganisationServices(orgId: string, serviceCodes: string[], actorUserId?: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      const allServices = await tx.service.findMany();
      const serviceMap = new Map(allServices.map((s) => [s.code, s.id]));

      // Deactivate services not in serviceCodes
      await tx.organisationService.updateMany({
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
          await tx.organisationService.upsert({
            where: {
              organisationId_serviceId: { organisationId: orgId, serviceId },
            },
            update: { status: "ACTIVE" },
            create: { organisationId: orgId, serviceId, status: "ACTIVE" },
          });
        }
      }

      if (actorUserId) {
        await tx.auditLog.create({
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
    });
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
    return withPlatformAdmin(this.database, async (tx) => {
      const slug = input.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .concat("-", Math.random().toString(36).slice(2, 6));

      const org = await tx.organisation.create({
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
        const user = await tx.user.upsert({
          where: { email: input.ownerEmail.toLowerCase().trim() },
          update: {},
          create: {
            email: input.ownerEmail.toLowerCase().trim(),
            name: input.name + " Admin",
            status: "ACTIVE",
          },
        });

        const ownerRole = await tx.role.findFirst({
          where: { code: "owner" },
        });

        if (ownerRole) {
          await tx.organisationMembership.create({
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
      const allServices = await tx.service.findMany();
      for (const s of allServices) {
        if (serviceCodes.includes(s.code)) {
          await tx.organisationService.create({
            data: {
              organisationId: org.id,
              serviceId: s.id,
              status: "ACTIVE",
            },
          });
        }
      }

      if (actorUserId) {
        await tx.auditLog.create({
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
    });
  }

  async getHealth() {
    return withPlatformAdmin(this.database, async (tx) => {
      const [
        totalUsers,
        totalOrganisations,
        totalPeople,
        totalInvoices,
        totalLeads,
        totalAuditLogs,
      ] = await Promise.all([
        tx.user.count(),
        tx.organisation.count(),
        tx.person.count(),
        tx.invoice.count(),
        tx.lead.count(),
        tx.auditLog.count(),
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
    });
  }

  async listAudit(limit = 50) {
    return withPlatformAdmin(this.database, async (tx) => {
      const logs = await tx.auditLog.findMany({
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
    });
  }
}
