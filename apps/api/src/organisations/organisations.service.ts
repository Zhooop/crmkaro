import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant, withUser } from "@crmkaro/database";
import { rolePresets } from "@crmkaro/permissions";
import { DATABASE } from "../database/database.module.js";
import { SessionService } from "../auth/session.service.js";

type CreateOrganisationInput = {
  name: string;
  businessType?: string;
  industry?: string;
  timezone: string;
  currency: string;
  serviceCodes: string[];
};

@Injectable()
export class OrganisationsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  private slugify(value: string) {
    const base = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
    return `${base || "organisation"}-${randomUUID().slice(0, 8)}`;
  }

  async create(
    userId: string,
    sessionId: string,
    input: CreateOrganisationInput,
  ) {
    const organisationId = randomUUID();

    const organisation = await withTenant(
      this.database,
      organisationId,
      userId,
      async (transaction) => {
        for (const code of input.serviceCodes) {
          await transaction.service.upsert({
            where: { code },
            update: {},
            create: { code, name: code, sortOrder: 50 },
          });
        }

        const selectedServices = await transaction.service.findMany({
          where: { code: { in: input.serviceCodes }, status: "ACTIVE" },
        });

        const created = await transaction.organisation.create({
          data: {
            id: organisationId,
            name: input.name,
            slug: this.slugify(input.name),
            businessType: input.businessType,
            industry: input.industry,
            timezone: input.timezone,
            currency: input.currency,
          },
        });

        const createdRoles = [];
        for (const [code, preset] of Object.entries(rolePresets)) {
          createdRoles.push(
            await transaction.role.create({
              data: {
                organisationId,
                code,
                name: preset.name,
                isSystem: false,
              },
            }),
          );
        }
        const ownerRole = createdRoles.find((role) => role.code === "owner");
        if (!ownerRole)
          throw new ConflictException("Owner role could not be created.");
        await transaction.organisationMembership.create({
          data: {
            organisationId,
            userId,
            roleId: ownerRole.id,
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        });

        const permissionRows = await transaction.permission.findMany({
          select: { id: true, code: true },
        });
        await transaction.rolePermission.createMany({
          data: createdRoles.flatMap((role) => {
            const preset = rolePresets[role.code as keyof typeof rolePresets];
            return permissionRows
              .filter(({ code }) =>
                (preset.permissions as readonly string[]).includes(code),
              )
              .map(({ id }) => ({
                organisationId,
                roleId: role.id,
                permissionId: id,
              }));
          }),
        });
        await transaction.organisationService.createMany({
          data: selectedServices.map(({ id }) => ({
            organisationId,
            serviceId: id,
            status: "ACTIVE",
            activatedAt: new Date(),
          })),
        });
        if (input.serviceCodes.includes("crm")) {
          await transaction.pipeline.create({
            data: {
              organisationId,
              name: "Sales Pipeline",
              isDefault: true,
              stages: {
                create: [
                  {
                    organisationId,
                    name: "New",
                    position: 10,
                    colour: "#3B82F6",
                  },
                  {
                    organisationId,
                    name: "Contacted",
                    position: 20,
                    colour: "#8B5CF6",
                  },
                  {
                    organisationId,
                    name: "Interested",
                    position: 30,
                    colour: "#0D9488",
                  },
                  {
                    organisationId,
                    name: "Follow-up",
                    position: 40,
                    colour: "#F59E0B",
                  },
                  {
                    organisationId,
                    name: "Converted",
                    position: 50,
                    colour: "#16A34A",
                    isConverted: true,
                  },
                  {
                    organisationId,
                    name: "Lost",
                    position: 60,
                    colour: "#DC4C64",
                    isLost: true,
                  },
                ],
              },
            },
          });
        }
        await transaction.auditLog.create({
          data: {
            organisationId,
            actorUserId: userId,
            action: "organisation.created",
            entityType: "organisation",
            entityId: organisationId,
          },
        });

        return created;
      },
    );

    await this.sessions.setActiveOrganisation(sessionId, organisationId);
    return organisation;
  }

  async list(userId: string) {
    const memberships = await withUser(this.database, userId, (transaction) =>
      transaction.organisationMembership.findMany({
        where: { userId, status: "ACTIVE" },
        select: { organisationId: true, roleId: true },
      }),
    );

    return Promise.all(
      memberships.map(({ organisationId, roleId }) =>
        withTenant(
          this.database,
          organisationId,
          userId,
          async (transaction) => {
            const organisation = await transaction.organisation.findUnique({
              where: { id: organisationId },
              include: {
                services: {
                  where: { status: "ACTIVE" },
                  include: { service: true },
                },
              },
            });
            const role = await transaction.role.findUnique({
              where: { id: roleId },
            });
            const activeServices = organisation?.services.map((s) => s.service.code) ?? [];
            return {
              organisation: organisation ? { ...organisation, activeServices } : null,
              role,
              activeServices,
            };
          },
        ),
      ),
    );
  }

  async activate(userId: string, sessionId: string, organisationId: string) {
    const membership = await withTenant(
      this.database,
      organisationId,
      userId,
      (transaction) =>
        transaction.organisationMembership.findUnique({
          where: { organisationId_userId: { organisationId, userId } },
        }),
    );

    if (!membership) throw new NotFoundException("Organisation not found.");
    if (membership.status !== "ACTIVE")
      throw new ForbiddenException("Organisation membership is not active.");

    await this.sessions.setActiveOrganisation(sessionId, organisationId);
    return { activeOrganisationId: organisationId };
  }

  async update(
    organisationId: string,
    userId: string,
    input: {
      name?: string;
      logoUrl?: string | null;
      phone?: string | null;
      address?: string | null;
      businessType?: string | null;
      timezone?: string;
      currency?: string;
    },
  ) {
    return withTenant(
      this.database,
      organisationId,
      userId,
      async (transaction) => {
        const updated = await transaction.organisation.update({
          where: { id: organisationId },
          data: {
            ...(input.name ? { name: input.name } : {}),
            ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.address !== undefined ? { address: input.address } : {}),
            ...(input.businessType !== undefined ? { businessType: input.businessType } : {}),
            ...(input.timezone ? { timezone: input.timezone } : {}),
            ...(input.currency ? { currency: input.currency } : {}),
          },
        });

        await transaction.auditLog.create({
          data: {
            organisationId,
            actorUserId: userId,
            action: "organisation.updated",
            entityType: "organisation",
            entityId: organisationId,
            metadata: { updatedFields: Object.keys(input) },
          },
        });

        return updated;
      },
    );
  }

  async getPayoutSettings(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const rows: any[] = await tx.$queryRawUnsafe(
        `SELECT * FROM "organisation_payout_settings" WHERE "organisation_id" = $1::uuid LIMIT 1`,
        organisationId,
      );
      const row = rows[0] || null;
      if (!row) {
        return {
          configured: false,
          payoutStatus: "NOT_CONFIGURED",
          gatewayMode: "PLATFORM_ROUTE",
          settlementCycle: "T+1 Daily",
          isVerified: false,
          accountHolderName: "",
          bankName: "",
          accountNumber: "",
          accountNumberMasked: "",
          ifscCode: "",
          upiId: "",
          panNumber: "",
          businessGstin: "",
          customRazorpayKeyId: "",
          hasCustomSecret: false,
        };
      }
      const accNum = row.account_number || "";
      const masked = accNum.length > 4 ? `••••••••${accNum.slice(-4)}` : accNum;
      return {
        configured: Boolean(row.account_number && row.ifsc_code),
        id: row.id,
        payoutStatus: row.payout_status || (row.account_number ? "ACTIVE" : "NOT_CONFIGURED"),
        gatewayMode: row.gateway_mode || "PLATFORM_ROUTE",
        settlementCycle: row.settlement_cycle || "T+1 Daily",
        isVerified: Boolean(row.is_verified),
        accountHolderName: row.account_holder_name || "",
        bankName: row.bank_name || "",
        accountNumber: accNum,
        accountNumberMasked: masked,
        ifscCode: row.ifsc_code || "",
        upiId: row.upi_id || "",
        panNumber: row.pan_number || "",
        businessGstin: row.business_gstin || "",
        customRazorpayKeyId: row.custom_razorpay_key_id || "",
        hasCustomSecret: Boolean(row.custom_razorpay_secret),
      };
    });
  }

  async updatePayoutSettings(
    organisationId: string,
    userId: string,
    input: {
      accountHolderName?: string;
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      upiId?: string;
      panNumber?: string;
      businessGstin?: string;
      gatewayMode?: string;
      customRazorpayKeyId?: string;
      customRazorpaySecret?: string;
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const existingRows: any[] = await tx.$queryRawUnsafe(
        `SELECT * FROM "organisation_payout_settings" WHERE "organisation_id" = $1::uuid LIMIT 1`,
        organisationId,
      );
      const existing = existingRows[0] || null;

      const accountHolderName =
        input.accountHolderName !== undefined
          ? input.accountHolderName.trim()
          : existing?.account_holder_name || null;
      const bankName =
        input.bankName !== undefined ? input.bankName.trim() : existing?.bank_name || null;
      let accountNumber = existing?.account_number || null;
      if (input.accountNumber && !input.accountNumber.includes("•")) {
        accountNumber = input.accountNumber.trim();
      }
      const ifscCode =
        input.ifscCode !== undefined
          ? input.ifscCode.trim().toUpperCase()
          : existing?.ifsc_code || null;
      const upiId =
        input.upiId !== undefined ? input.upiId.trim().toLowerCase() : existing?.upi_id || null;
      const panNumber =
        input.panNumber !== undefined
          ? input.panNumber.trim().toUpperCase()
          : existing?.pan_number || null;
      const businessGstin =
        input.businessGstin !== undefined
          ? input.businessGstin.trim().toUpperCase()
          : existing?.business_gstin || null;
      const gatewayMode =
        input.gatewayMode !== undefined ? input.gatewayMode : existing?.gateway_mode || "PLATFORM_ROUTE";
      const customRazorpayKeyId =
        input.customRazorpayKeyId !== undefined
          ? input.customRazorpayKeyId.trim()
          : existing?.custom_razorpay_key_id || null;
      let customRazorpaySecret = existing?.custom_razorpay_secret || null;
      if (input.customRazorpaySecret && !input.customRazorpaySecret.includes("•")) {
        customRazorpaySecret = input.customRazorpaySecret.trim();
      }

      const isConfigured = Boolean(accountNumber && ifscCode);
      const payoutStatus = isConfigured ? "ACTIVE" : "NOT_CONFIGURED";

      if (existing) {
        await tx.$executeRawUnsafe(
          `UPDATE "organisation_payout_settings"
           SET "account_holder_name" = $1,
               "bank_name" = $2,
               "account_number" = $3,
               "ifsc_code" = $4,
               "upi_id" = $5,
               "pan_number" = $6,
               "business_gstin" = $7,
               "gateway_mode" = $8,
               "custom_razorpay_key_id" = $9,
               "custom_razorpay_secret" = $10,
               "payout_status" = $11,
               "is_verified" = $12,
               "updated_at" = now()
           WHERE "organisation_id" = $13::uuid`,
          accountHolderName,
          bankName,
          accountNumber,
          ifscCode,
          upiId,
          panNumber,
          businessGstin,
          gatewayMode,
          customRazorpayKeyId,
          customRazorpaySecret,
          payoutStatus,
          isConfigured,
          organisationId,
        );
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO "organisation_payout_settings" (
             "id", "organisation_id", "account_holder_name", "bank_name", "account_number",
             "ifsc_code", "upi_id", "pan_number", "business_gstin", "gateway_mode",
             "custom_razorpay_key_id", "custom_razorpay_secret", "payout_status", "is_verified",
             "settlement_cycle", "created_at", "updated_at"
           ) VALUES (
             gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'T+1 Daily', now(), now()
           )`,
          organisationId,
          accountHolderName,
          bankName,
          accountNumber,
          ifscCode,
          upiId,
          panNumber,
          businessGstin,
          gatewayMode,
          customRazorpayKeyId,
          customRazorpaySecret,
          payoutStatus,
          isConfigured,
        );
      }

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "organisation.payout_settings_updated",
          entityType: "organisation_payout_setting",
          entityId: organisationId,
          metadata: {
            bankName,
            ifscCode,
            upiId,
            payoutStatus,
            gatewayMode,
          },
        },
      });

      return this.getPayoutSettings(organisationId, userId);
    });
  }
}
