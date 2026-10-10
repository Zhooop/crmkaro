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

  // 1. USERS MANAGEMENT
  async listUsers(params: { search?: string; platform?: string; status?: string; limit?: number }) {
    return withPlatformAdmin(this.database, async (tx) => {
      const limit = params.limit || 50;
      const where: any = {};
      if (params.search) {
        where.OR = [
          { email: { contains: params.search, mode: "insensitive" } },
          { name: { contains: params.search, mode: "insensitive" } },
        ];
      }
      if (params.platform && params.platform !== "ALL") {
        where.signupPlatform = params.platform;
      }
      if (params.status && params.status !== "ALL") {
        where.status = params.status;
      }

      const users = await tx.user.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          memberships: {
            include: {
              organisation: { select: { id: true, name: true, slug: true } },
              role: { select: { name: true } },
            },
          },
          _count: {
            select: { sessions: true },
          },
        },
      });

      return {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name || "Anonymous",
          avatarUrl: u.avatarUrl,
          status: u.status,
          signupPlatform: u.signupPlatform || "WEB",
          lastPlatform: u.lastPlatform || "WEB",
          isVerified: u.isVerified,
          blockReason: u.blockReason,
          blockedAt: u.blockedAt ? u.blockedAt.toISOString() : null,
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
          createdAt: u.createdAt.toISOString(),
          activeSessionsCount: u._count.sessions,
          organisations: u.memberships
            .filter((m) => Boolean(m.organisation))
            .map((m) => ({
              id: m.organisation?.id || "",
              name: m.organisation?.name || "Workspace",
              role: m.role?.name || "Member",
            })),
        })),
      };
    });
  }

  async updateUserStatus(
    userId: string,
    status: "ACTIVE" | "DISABLED",
    blockReason?: string,
    actorUserId?: string,
  ) {
    return withPlatformAdmin(this.database, async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status,
          blockReason: status === "DISABLED" ? blockReason || "Account suspended by Platform Administrator" : null,
          blockedAt: status === "DISABLED" ? new Date() : null,
        },
      });

      // If disabled/blocked, revoke all active sessions immediately
      if (status === "DISABLED") {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      if (actorUserId) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            action: `user.status.${status.toLowerCase()}`,
            entityType: "USER",
            entityId: userId,
            metadata: { status, blockReason },
          },
        });
      }

      return { user: updated };
    });
  }

  async toggleUserVerify(userId: string, isVerified: boolean, actorUserId?: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isVerified },
      });

      if (actorUserId) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            action: isVerified ? "user.verified" : "user.unverified",
            entityType: "USER",
            entityId: userId,
            metadata: { isVerified },
          },
        });
      }

      return { user: updated };
    });
  }

  // 2. CMS & BANNERS
  async listBanners() {
    return withPlatformAdmin(this.database, async (tx) => {
      const banners = await tx.platformBanner.findMany({
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });
      return { banners };
    });
  }

  async listPublicBanners(platform?: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      const now = new Date();
      const where: any = {
        isActive: true,
        OR: [
          { targetPlatform: "ALL" },
          ...(platform ? [{ targetPlatform: platform.toUpperCase() }] : []),
        ],
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      };
      const banners = await tx.platformBanner.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 10,
      });
      return { banners };
    });
  }

  async createBanner(input: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    targetPlatform?: string;
    category?: string;
    priority?: number;
    startDate?: string | null;
    endDate?: string | null;
  }) {
    return withPlatformAdmin(this.database, async (tx) => {
      const banner = await tx.platformBanner.create({
        data: {
          title: input.title,
          subtitle: input.subtitle,
          imageUrl: input.imageUrl,
          ctaLabel: input.ctaLabel,
          ctaUrl: input.ctaUrl,
          targetPlatform: input.targetPlatform || "ALL",
          category: input.category || "ANNOUNCEMENT",
          priority: input.priority || 0,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
        },
      });
      return { banner };
    });
  }

  async updateBanner(id: string, input: any) {
    return withPlatformAdmin(this.database, async (tx) => {
      const data: any = { ...input };
      if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
      if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;

      const banner = await tx.platformBanner.update({
        where: { id },
        data,
      });
      return { banner };
    });
  }

  async deleteBanner(id: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      await tx.platformBanner.delete({ where: { id } });
      return { success: true };
    });
  }

  // 3. PAYMENTS & TRANSACTIONS
  async listTransactions(params: { status?: string; limit?: number }) {
    return withPlatformAdmin(this.database, async (tx) => {
      const limit = params.limit || 50;

      const payments = await tx.payment.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          organisation: { select: { id: true, name: true, slug: true, currency: true } },
          person: { select: { id: true, displayName: true } },
          refunds: true,
        },
      });

      return {
        transactions: payments.map((p) => {
          let status = "SUCCESS";
          if (p.status === "REFUNDED") status = "REFUNDED";
          else if (p.status === "PARTIALLY_REFUNDED") status = "PARTIALLY_REFUNDED";

          return {
            id: p.id,
            organisationId: p.organisationId,
            organisationName: p.organisation?.name || "Unknown Org",
            personName: p.person?.displayName || "Direct Customer",
            amount: Number(p.amountMinor) / 100,
            currency: p.organisation?.currency || "INR",
            method: p.method,
            status,
            reference: p.reference || "N/A",
            paidAt: p.receivedAt.toISOString(),
            createdAt: p.createdAt.toISOString(),
            refundCount: p.refunds.length,
          };
        }),
      };
    });
  }

  async refundTransaction(paymentId: string, reason?: string, actorUserId?: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) {
        throw new Error("Payment not found");
      }

      const refund = await tx.paymentRefund.create({
        data: {
          organisationId: payment.organisationId,
          paymentId: payment.id,
          amountMinor: payment.amountMinor,
          reason: reason || "Refund processed by Platform Super Admin",
          issuedById: actorUserId,
        },
      });

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "REFUNDED" },
      });

      if (actorUserId) {
        await tx.auditLog.create({
          data: {
            actorUserId,
            organisationId: payment.organisationId,
            action: "payment.refunded_by_platform_admin",
            entityType: "PAYMENT",
            entityId: paymentId,
            metadata: { amountMinor: payment.amountMinor, reason },
          },
        });
      }

      return { refund };
    });
  }

  // 4. BROADCAST NOTIFICATIONS
  async listNotifications() {
    return withPlatformAdmin(this.database, async (tx) => {
      const notifications = await tx.platformNotification.findMany({
        orderBy: { createdAt: "desc" },
      });
      return { notifications };
    });
  }

  async listPublicNotifications(audience?: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      const where: any = {
        OR: [
          { targetAudience: "ALL" },
          ...(audience ? [{ targetAudience: audience.toUpperCase() }] : []),
        ],
      };
      const notifications = await tx.platformNotification.findMany({
        where,
        take: 15,
        orderBy: { createdAt: "desc" },
      });
      return { notifications };
    });
  }

  async broadcastNotification(
    input: {
      title: string;
      message: string;
      type?: string;
      targetAudience?: string;
      actionUrl?: string;
    },
    adminEmail?: string,
  ) {
    return withPlatformAdmin(this.database, async (tx) => {
      const notification = await tx.platformNotification.create({
        data: {
          title: input.title,
          message: input.message,
          type: input.type || "ANNOUNCEMENT",
          targetAudience: input.targetAudience || "ALL",
          actionUrl: input.actionUrl,
          sentByAdminEmail: adminEmail || "Platform Admin",
        },
      });
      return { notification };
    });
  }

  // 5. BUSINESS REPORTS & ANALYTICS
  async getReportsOverview() {
    return withPlatformAdmin(this.database, async (tx) => {
      const [
        totalUsers,
        webUsers,
        mobileUsers,
        totalOrganisations,
        activeOrganisations,
        payments,
        refunds,
      ] = await Promise.all([
        tx.user.count(),
        tx.user.count({ where: { signupPlatform: "WEB" } }),
        tx.user.count({ where: { signupPlatform: "MOBILE" } }),
        tx.organisation.count(),
        tx.organisation.count({ where: { status: "ACTIVE" } }),
        tx.payment.findMany({ select: { amountMinor: true, status: true } }),
        tx.paymentRefund.findMany({ select: { amountMinor: true } }),
      ]);

      const totalGrossVolume = payments.reduce((sum, p) => sum + Number(p.amountMinor) / 100, 0);
      const totalRefundedVolume = refunds.reduce((sum, r) => sum + Number(r.amountMinor) / 100, 0);
      const netVolume = totalGrossVolume - totalRefundedVolume;

      return {
        metrics: {
          totalUsers,
          webUsers,
          mobileUsers,
          totalOrganisations,
          activeOrganisations,
          totalGrossVolume,
          totalRefundedVolume,
          netVolume,
          successfulTransactionsCount: payments.length,
          refundedCount: refunds.length,
        },
      };
    });
  }

  // 6. TEAM & PERMISSIONS
  async listTeamMembers() {
    return withPlatformAdmin(this.database, async (tx) => {
      let members = await tx.platformAdminUser.findMany({
        orderBy: { createdAt: "desc" },
      });

      // If empty, create initial super-admin entry for platform admin
      if (members.length === 0) {
        const rootAdmin = await tx.platformAdminUser.create({
          data: {
            email: "admin@crmkaro.com",
            name: "Platform Master Admin",
            role: "SUPER_ADMIN",
            isActive: true,
          },
        });
        members = [rootAdmin];
      }

      return { members };
    });
  }

  async createTeamMember(input: { email: string; name: string; role: string }) {
    return withPlatformAdmin(this.database, async (tx) => {
      const member = await tx.platformAdminUser.create({
        data: {
          email: input.email.toLowerCase().trim(),
          name: input.name.trim(),
          role: input.role || "SUPPORT_ADMIN",
          isActive: true,
        },
      });
      return { member };
    });
  }

  async updateTeamMember(id: string, input: { role?: string; isActive?: boolean }) {
    return withPlatformAdmin(this.database, async (tx) => {
      const member = await tx.platformAdminUser.update({
        where: { id },
        data: input,
      });
      return { member };
    });
  }

  async deleteTeamMember(id: string) {
    return withPlatformAdmin(this.database, async (tx) => {
      await tx.platformAdminUser.delete({ where: { id } });
      return { success: true };
    });
  }
}
