import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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

  async create(userId: string, sessionId: string, input: CreateOrganisationInput) {
    const organisationId = randomUUID();

    const organisation = await withTenant(this.database, organisationId, userId, async (transaction) => {
      const selectedServices = await transaction.service.findMany({
        where: { code: { in: input.serviceCodes }, status: "ACTIVE" },
      });

      if (selectedServices.length !== new Set(input.serviceCodes).size) {
        throw new ConflictException("One or more selected services are unavailable.");
      }

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
        createdRoles.push(await transaction.role.create({
          data: { organisationId, code, name: preset.name, isSystem: false },
        }));
      }
      const ownerRole = createdRoles.find((role) => role.code === "owner");
      if (!ownerRole) throw new ConflictException("Owner role could not be created.");
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
            .filter(({ code }) => (preset.permissions as readonly string[]).includes(code))
            .map(({ id }) => ({ organisationId, roleId: role.id, permissionId: id }));
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
    });

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
        withTenant(this.database, organisationId, userId, async (transaction) => {
          const organisation = await transaction.organisation.findUnique({ where: { id: organisationId } });
          const role = await transaction.role.findUnique({ where: { id: roleId } });
          return { organisation, role };
        }),
      ),
    );
  }

  async activate(userId: string, sessionId: string, organisationId: string) {
    const membership = await withTenant(this.database, organisationId, userId, (transaction) =>
      transaction.organisationMembership.findUnique({
        where: { organisationId_userId: { organisationId, userId } },
      }),
    );

    if (!membership) throw new NotFoundException("Organisation not found.");
    if (membership.status !== "ACTIVE") throw new ForbiddenException("Organisation membership is not active.");

    await this.sessions.setActiveOrganisation(sessionId, organisationId);
    return { activeOrganisationId: organisationId };
  }
}
