import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type {
  CreateGroupInput,
  UpdateGroupInput,
  AddGroupMemberInput,
} from "./groups.schemas.js";

function generateMonogram(name: string): string {
  const parts = name.trim().split(/[\s-_]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const first = parts[0][0]?.toUpperCase() || "";
    const second = parts[1][0]?.toUpperCase() || "";
    return `${first}${second}`;
  }
  if (parts[0]) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "GP";
}

const PASTEL_COLORS = [
  "#dbeafe", // Blue tint
  "#ffedd5", // Orange tint
  "#f3e8ff", // Purple tint
  "#f1f5f9", // Slate tint
  "#e0e7ff", // Indigo tint
  "#ecfdf5", // Emerald tint
  "#fef3c7", // Amber tint
  "#ffe4e6", // Rose tint
];

@Injectable()
export class GroupsService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async list(
    organisationId: string,
    userId: string,
    query: { search?: string; status?: "ACTIVE" | "INACTIVE" | "ALL" },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const where: any = {
        organisationId,
        ...(query.status === "ACTIVE"
          ? { isActive: true }
          : query.status === "INACTIVE"
            ? { isActive: false }
            : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const groups = await tx.batchGroup.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        include: {
          members: {
            where: { status: "ACTIVE" },
            include: {
              person: {
                select: {
                  id: true,
                  displayName: true,
                  primaryPhone: true,
                  email: true,
                  invoices: {
                    where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
                    select: { balanceDueMinor: true },
                  },
                },
              },
            },
          },
        },
      });

      return groups.map((g) => {
        const totalMembers = g.members.length;
        const totalActiveMembers = g.members.filter((m) => m.status === "ACTIVE").length;

        // Calculate total due amount for all members in this group
        const totalDueMinor = g.members.reduce((acc, m) => {
          const personDues = (m.person?.invoices || []).reduce(
            (sum, inv) => sum + inv.balanceDueMinor,
            0,
          );
          // If no specific invoices, default to customFee or group fee
          return acc + (personDues > 0 ? personDues : m.customFeeMinor || g.feeAmountMinor);
        }, 0);

        return {
          id: g.id,
          name: g.name,
          code: g.code || generateMonogram(g.name),
          description: g.description,
          color: g.color || PASTEL_COLORS[0],
          feeAmountMinor: g.feeAmountMinor,
          feeFrequency: g.feeFrequency,
          billingType: g.billingType,
          collectionDay: g.collectionDay,
          startDate: g.startDate,
          endDate: g.endDate,
          workingDays: g.workingDays,
          isActive: g.isActive,
          totalMembers,
          totalActiveMembers,
          totalDueMinor,
          createdAt: g.createdAt,
        };
      });
    });
  }

  async get(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const group = await tx.batchGroup.findFirst({
        where: { id, organisationId },
        include: {
          members: {
            include: {
              person: {
                select: {
                  id: true,
                  displayName: true,
                  primaryPhone: true,
                  alternatePhone: true,
                  email: true,
                  status: true,
                  address: true,
                  invoices: {
                    where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    select: {
                      id: true,
                      invoiceNumber: true,
                      totalMinor: true,
                      balanceDueMinor: true,
                      status: true,
                      issueDate: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ createdAt: "asc" }],
          },
        },
      });

      if (!group) {
        throw new NotFoundException("Group not found.");
      }

      const totalMembers = group.members.length;
      const totalActiveMembers = group.members.filter((m) => m.status === "ACTIVE").length;

      let totalCollectedMinor = 0;
      let totalDueMinor = 0;

      const membersWithStats = group.members.map((m) => {
        const invoices = m.person?.invoices || [];
        const personPaid = invoices
          .filter((inv) => inv.status === "PAID")
          .reduce((sum, inv) => sum + inv.totalMinor, 0);
        const personDue = invoices
          .filter((inv) => inv.status !== "PAID")
          .reduce((sum, inv) => sum + inv.balanceDueMinor, 0);

        totalCollectedMinor += personPaid;
        totalDueMinor += personDue > 0 ? personDue : m.customFeeMinor || group.feeAmountMinor;

        return {
          id: m.id,
          personId: m.personId,
          displayName: m.person?.displayName || "Unknown Member",
          primaryPhone: m.person?.primaryPhone || null,
          alternatePhone: m.person?.alternatePhone || null,
          email: m.person?.email || null,
          status: m.status,
          customFeeMinor: m.customFeeMinor || group.feeAmountMinor,
          startDate: m.startDate,
          dueAmountMinor: personDue > 0 ? personDue : m.customFeeMinor || group.feeAmountMinor,
          paidAmountMinor: personPaid,
          recentInvoices: invoices,
        };
      });

      return {
        id: group.id,
        name: group.name,
        code: group.code || generateMonogram(group.name),
        description: group.description,
        color: group.color,
        feeAmountMinor: group.feeAmountMinor,
        feeFrequency: group.feeFrequency,
        billingType: group.billingType,
        collectionDay: group.collectionDay,
        startDate: group.startDate,
        endDate: group.endDate,
        workingDays: group.workingDays,
        isActive: group.isActive,
        totalMembers,
        totalActiveMembers,
        totalCollectedMinor,
        totalDueMinor,
        createdAt: group.createdAt,
        members: membersWithStats,
      };
    });
  }

  async create(organisationId: string, userId: string, input: CreateGroupInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const existing = await tx.batchGroup.findFirst({
        where: { organisationId, name: { equals: input.name, mode: "insensitive" } },
      });
      if (existing) {
        throw new ConflictException("A group with this name already exists in this workspace.");
      }

      const monogram = input.code || generateMonogram(input.name);
      const color =
        input.color ||
        PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)] ||
        "#dbeafe";

      const group = await tx.batchGroup.create({
        data: {
          organisationId,
          name: input.name,
          code: monogram,
          description: input.description || null,
          color,
          feeAmountMinor: input.feeAmountMinor,
          feeFrequency: input.feeFrequency,
          billingType: input.billingType,
          collectionDay: input.collectionDay || "1st day of month",
          startDate: input.startDate,
          endDate: input.endDate || null,
          workingDays: input.workingDays,
          isActive: true,
          members: {
            create: input.members.map((m) => ({
              organisationId,
              personId: m.personId,
              customFeeMinor: m.customFeeMinor ?? input.feeAmountMinor,
              startDate: m.startDate,
              status: "ACTIVE",
            })),
          },
        },
        include: {
          members: {
            include: {
              person: {
                select: { id: true, displayName: true, primaryPhone: true, email: true },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "group.created",
          entityType: "batch_group",
          entityId: group.id,
          metadata: { name: group.name, memberCount: input.members.length },
        },
      });

      return group;
    });
  }

  async update(organisationId: string, userId: string, id: string, input: UpdateGroupInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const group = await tx.batchGroup.findFirst({
        where: { id, organisationId },
      });
      if (!group) {
        throw new NotFoundException("Group not found.");
      }

      const updated = await tx.batchGroup.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code,
          description: input.description,
          color: input.color,
          feeAmountMinor: input.feeAmountMinor,
          feeFrequency: input.feeFrequency,
          billingType: input.billingType,
          collectionDay: input.collectionDay,
          startDate: input.startDate,
          endDate: input.endDate,
          workingDays: input.workingDays,
          isActive: input.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "group.updated",
          entityType: "batch_group",
          entityId: id,
          metadata: input,
        },
      });

      return updated;
    });
  }

  async addMember(organisationId: string, userId: string, groupId: string, input: AddGroupMemberInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const group = await tx.batchGroup.findFirst({ where: { id: groupId, organisationId } });
      if (!group) throw new NotFoundException("Group not found.");

      const person = await tx.person.findFirst({ where: { id: input.personId, organisationId } });
      if (!person) throw new NotFoundException("Person / Member not found.");

      const membership = await tx.groupMember.upsert({
        where: { groupId_personId: { groupId, personId: input.personId } },
        update: {
          customFeeMinor: input.customFeeMinor ?? group.feeAmountMinor,
          startDate: input.startDate,
          status: "ACTIVE",
        },
        create: {
          organisationId,
          groupId,
          personId: input.personId,
          customFeeMinor: input.customFeeMinor ?? group.feeAmountMinor,
          startDate: input.startDate,
          status: "ACTIVE",
        },
      });

      return membership;
    });
  }

  async removeMember(organisationId: string, userId: string, groupId: string, personId: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await tx.groupMember.deleteMany({
        where: { organisationId, groupId, personId },
      });
      return { success: true };
    });
  }

  async delete(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const group = await tx.batchGroup.findFirst({ where: { id, organisationId } });
      if (!group) throw new NotFoundException("Group not found.");

      await tx.batchGroup.delete({ where: { id } });
      return { success: true };
    });
  }
}
