import { Inject, Injectable, NotFoundException } from "@nestjs/common";
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

  async deleteOrganisation(organisationId: string, deleteOwnerUser = false, actorUserId?: string) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      const org = await tx.organisation.findUnique({
        where: { id: organisationId },
        include: {
          memberships: {
            include: { user: true, role: true },
          },
        },
      });

      if (!org) {
        throw new NotFoundException("Organisation not found.");
      }

      // Collect owner user IDs if deleteOwnerUser is requested
      const ownerUserIds = (org.memberships || [])
        .filter((m: any) => m.role?.code === "owner" || m.role?.name?.toLowerCase().includes("owner"))
        .map((m: any) => m.userId);

      // 1. Unset active organisation from any active sessions
      await tx.authSession.updateMany({
        where: { activeOrganisationId: organisationId },
        data: { activeOrganisationId: null },
      });

      // 2. Cascade delete all child records tied to this organisation
      // Attendance & Batches
      await tx.attendanceRecord.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.groupMember.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.batchGroup.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.studentProfile.deleteMany({ where: { organisationId } }).catch(() => {});

      // Inventory
      await tx.stockMovement.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.product.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.productCategory.deleteMany({ where: { organisationId } }).catch(() => {});

      // Payroll
      await tx.payrollItem.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.payrollRun.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.salaryStructure.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.employee.deleteMany({ where: { organisationId } }).catch(() => {});

      // Finance & Invoicing
      await tx.expense.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.paymentRefund.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.payment.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.invoiceItem.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.invoice.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.organisationSequence.deleteMany({ where: { organisationId } }).catch(() => {});

      // Leads & CRM
      await tx.followUp.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.leadNote.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.leadActivity.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.lead.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.pipelineStage.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.pipeline.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.organisationLeadSetting.deleteMany({ where: { organisationId } }).catch(() => {});

      // People & Contacts
      await tx.personActivity.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.personTag.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.personTypeAssignment.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.tag.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.person.deleteMany({ where: { organisationId } }).catch(() => {});

      // Settings & Subscriptions
      await tx.organisationPayoutSetting.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.organisationSubscription.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.organisationService.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.outboxEvent.deleteMany({ where: { organisationId } }).catch(() => {});

      // RBAC Roles & Memberships
      await tx.rolePermission.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.organisationMembership.deleteMany({ where: { organisationId } }).catch(() => {});
      await tx.role.deleteMany({ where: { organisationId } }).catch(() => {});

      // Audit logs for this organisation
      await tx.auditLog.deleteMany({ where: { organisationId } }).catch(() => {});

      // 3. Delete Organisation
      await tx.organisation.delete({
        where: { id: organisationId },
      });

      // 4. Optionally delete owner user if requested (so email can be re-registered immediately)
      const deletedUsers: string[] = [];
      if (deleteOwnerUser && ownerUserIds.length > 0) {
        for (const uid of ownerUserIds) {
          const otherMemberships = await tx.organisationMembership.count({
            where: { userId: uid },
          });
          if (otherMemberships === 0) {
            const userRec = await tx.user.findUnique({ where: { id: uid }, select: { email: true } });
            if (userRec?.email) {
              await tx.emailOtpChallenge.deleteMany({
                where: { email: { equals: userRec.email, mode: "insensitive" } },
              }).catch(() => {});
            }
            await tx.authSession.deleteMany({ where: { userId: uid } }).catch(() => {});
            await tx.oAuthAccount.deleteMany({ where: { userId: uid } }).catch(() => {});
            await tx.user.delete({ where: { id: uid } }).catch(() => {});
            deletedUsers.push(uid);
          }
        }
      }

      return {
        success: true,
        organisationId,
        deletedOrgName: org.name,
        deletedOwnerUsersCount: deletedUsers.length,
      };
    });
  }

  async deleteUser(userId: string, actorUserId?: string) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          memberships: {
            include: { organisation: true },
          },
        },
      });

      if (!user) {
        throw new NotFoundException("User not found.");
      }

      // Check if user is the sole member of any organisations, cascade delete them
      for (const m of user.memberships || []) {
        const orgId = m.organisationId;
        const totalMembers = await tx.organisationMembership.count({
          where: { organisationId: orgId },
        });
        if (totalMembers <= 1) {
          await this.deleteOrganisation(orgId, false, actorUserId);
        }
      }

      // Remove remaining memberships
      await tx.organisationMembership.deleteMany({ where: { userId } }).catch(() => {});
      // Remove sessions & OAuth
      await tx.authSession.deleteMany({ where: { userId } }).catch(() => {});
      await tx.oAuthAccount.deleteMany({ where: { userId } }).catch(() => {});
      // Remove any OTP challenges
      await tx.emailOtpChallenge.deleteMany({
        where: { email: { equals: user.email, mode: "insensitive" } },
      }).catch(() => {});

      // Delete user
      await tx.user.delete({ where: { id: userId } });

      return {
        success: true,
        userId,
        deletedUserEmail: user.email,
      };
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

  // 7. SUBSCRIPTION PLANS MANAGEMENT
  async listPlans() {
    return withPlatformAdmin(this.database, async (tx: any) => {
      let plans = await tx.subscriptionPlan.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });

      if (plans.length === 0) {
        const defaultPlan = await tx.subscriptionPlan.create({
          data: {
            name: "Launch Offer — All-in-One Business OS",
            code: "launch_offer_249",
            description: "Complete business operating system at special introductory pricing",
            originalPriceMinor: 104900, // ₹1,049
            discountPriceMinor: 24900, // ₹249
            currency: "INR",
            billingPeriod: "monthly",
            billingInterval: 1,
            badge: "Special Launch Offer · 76% OFF",
            features: [
              "Unlimited Students, Members & Clients",
              "1-Click WhatsApp PDF Receipts & Invoices",
              "Daily Batch Attendance & Parent WhatsApp Alerts",
              "Staff Salary Structures & 1-Click Payslips",
              "GST Invoicing & Daily Kharcha Expense Tracker",
              "Sales CRM Visual Pipeline & Follow-up Reminders",
              "Single-Tap Mobile Web & Computer Access",
              "Hassle-free Monthly Renewal",
            ],
            isPopular: true,
            isActive: true,
            sortOrder: 1,
          },
        });
        plans = [defaultPlan];
      }

      return { plans };
    });
  }

  async listPublicPlans() {
    return withPlatformAdmin(this.database, async (tx: any) => {
      let plans = await tx.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });

      if (plans.length === 0) {
        const defaultPlan = await tx.subscriptionPlan.create({
          data: {
            name: "Launch Offer — All-in-One Business OS",
            code: "launch_offer_249",
            description: "Complete business operating system at special introductory pricing",
            originalPriceMinor: 104900, // ₹1,049
            discountPriceMinor: 24900, // ₹249
            currency: "INR",
            billingPeriod: "monthly",
            billingInterval: 1,
            badge: "Special Launch Offer · 76% OFF",
            features: [
              "Unlimited Students, Members & Clients",
              "1-Click WhatsApp PDF Receipts & Invoices",
              "Daily Batch Attendance & Parent WhatsApp Alerts",
              "Staff Salary Structures & 1-Click Payslips",
              "GST Invoicing & Daily Kharcha Expense Tracker",
              "Sales CRM Visual Pipeline & Follow-up Reminders",
              "Single-Tap Mobile Web & Computer Access",
              "Hassle-free Monthly Renewal",
            ],
            isPopular: true,
            isActive: true,
            sortOrder: 1,
          },
        });
        plans = [defaultPlan];
      }

      return { plans };
    });
  }

  async createPlan(input: {
    name: string;
    code?: string;
    description?: string;
    originalPriceMinor: number;
    discountPriceMinor: number;
    currency?: string;
    billingPeriod?: string;
    billingInterval?: number;
    badge?: string;
    features?: string[];
    isPopular?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      const code =
        input.code?.trim() ||
        input.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_")
          .slice(0, 50) + `_${Date.now().toString().slice(-4)}`;

      const plan = await tx.subscriptionPlan.create({
        data: {
          name: input.name.trim(),
          code,
          description: input.description?.trim() || null,
          originalPriceMinor: Math.round(Number(input.originalPriceMinor)),
          discountPriceMinor: Math.round(Number(input.discountPriceMinor)),
          currency: input.currency || "INR",
          billingPeriod: input.billingPeriod || "monthly",
          billingInterval: input.billingInterval || 1,
          badge: input.badge?.trim() || null,
          features: Array.isArray(input.features) ? input.features : [],
          isPopular: Boolean(input.isPopular),
          isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
          sortOrder: Number(input.sortOrder) || 0,
        },
      });

      return { plan };
    });
  }

  async updatePlan(
    id: string,
    input: Partial<{
      name: string;
      code: string;
      description: string;
      originalPriceMinor: number;
      discountPriceMinor: number;
      currency: string;
      billingPeriod: string;
      billingInterval: number;
      badge: string;
      features: string[];
      isPopular: boolean;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      const dataToUpdate: any = {};
      if (input.name !== undefined) dataToUpdate.name = input.name.trim();
      if (input.code !== undefined) dataToUpdate.code = input.code.trim();
      if (input.description !== undefined) dataToUpdate.description = input.description?.trim() || null;
      if (input.originalPriceMinor !== undefined)
        dataToUpdate.originalPriceMinor = Math.round(Number(input.originalPriceMinor));
      if (input.discountPriceMinor !== undefined)
        dataToUpdate.discountPriceMinor = Math.round(Number(input.discountPriceMinor));
      if (input.currency !== undefined) dataToUpdate.currency = input.currency;
      if (input.billingPeriod !== undefined) dataToUpdate.billingPeriod = input.billingPeriod;
      if (input.billingInterval !== undefined) dataToUpdate.billingInterval = Number(input.billingInterval);
      if (input.badge !== undefined) dataToUpdate.badge = input.badge?.trim() || null;
      if (input.features !== undefined) dataToUpdate.features = Array.isArray(input.features) ? input.features : [];
      if (input.isPopular !== undefined) dataToUpdate.isPopular = Boolean(input.isPopular);
      if (input.isActive !== undefined) dataToUpdate.isActive = Boolean(input.isActive);
      if (input.sortOrder !== undefined) dataToUpdate.sortOrder = Number(input.sortOrder);

      const plan = await tx.subscriptionPlan.update({
        where: { id },
        data: dataToUpdate,
      });

      return { plan };
    });
  }

  async deletePlan(id: string) {
    return withPlatformAdmin(this.database, async (tx: any) => {
      await tx.subscriptionPlan.delete({ where: { id } });
      return { success: true };
    });
  }
}
