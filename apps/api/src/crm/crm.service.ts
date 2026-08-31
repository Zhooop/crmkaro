import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient, Prisma } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import {
  normaliseEmail,
  normalisePhone,
  parseCsv,
} from "../people/people.utils.js";
import type { LeadInput } from "./crm.schemas.js";

type Tx = Prisma.TransactionClient;
const leadInclude = {
  stage: true,
  pipeline: true,
  owner: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  followUps: {
    where: { status: "SCHEDULED" as const },
    orderBy: { dueAt: "asc" as const },
    take: 1,
  },
} as const;

@Injectable()
export class CrmService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}
  private async lead(tx: Tx, organisationId: string, id: string) {
    const lead = await tx.lead.findFirst({ where: { id, organisationId } });
    if (!lead) throw new NotFoundException("Lead not found.");
    return lead;
  }
  private async validateMembership(
    tx: Tx,
    organisationId: string,
    id?: string | null,
  ) {
    if (!id) return;
    const membership = await tx.organisationMembership.findFirst({
      where: { id, organisationId, status: "ACTIVE" },
    });
    if (!membership)
      throw new BadRequestException(
        "Lead owner is not an active organisation member.",
      );
  }
  private async validateStage(
    tx: Tx,
    organisationId: string,
    pipelineId: string,
    stageId: string,
  ) {
    const stage = await tx.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, organisationId, isActive: true },
    });
    if (!stage) throw new BadRequestException("Pipeline stage is invalid.");
    return stage;
  }
  private activity(
    tx: Tx,
    organisationId: string,
    leadId: string,
    actorUserId: string,
    action: string,
    summary: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return tx.leadActivity.create({
      data: { organisationId, leadId, actorUserId, action, summary, metadata },
    });
  }

  pipelines(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, (tx) =>
      tx.pipeline.findMany({
        where: { organisationId, isActive: true },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        include: { stages: { orderBy: { position: "asc" } } },
      }),
    );
  }
  createPipeline(
    organisationId: string,
    userId: string,
    input: {
      name: string;
      stages: {
        name: string;
        colour: string;
        isConverted: boolean;
        isLost: boolean;
      }[];
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const pipeline = await tx.pipeline.create({
        data: {
          organisationId,
          name: input.name,
          stages: {
            create: input.stages.map((stage, index) => ({
              organisationId,
              ...stage,
              position: (index + 1) * 10,
            })),
          },
        },
        include: { stages: { orderBy: { position: "asc" } } },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "crm.pipeline_created",
          entityType: "pipeline",
          entityId: pipeline.id,
        },
      });
      return pipeline;
    });
  }
  updateStages(
    organisationId: string,
    userId: string,
    pipelineId: string,
    stages: { id: string; name: string; colour: string; isActive: boolean }[],
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const pipeline = await tx.pipeline.findFirst({
        where: { id: pipelineId, organisationId },
      });
      if (!pipeline) throw new NotFoundException("Pipeline not found.");
      const existing = await tx.pipelineStage.findMany({
        where: { pipelineId, organisationId },
      });
      if (
        stages.length !== existing.length ||
        stages.some((stage) => !existing.some((item) => item.id === stage.id))
      )
        throw new BadRequestException("One or more stages are invalid.");
      if (
        stages.some(
          (stage) =>
            !stage.isActive &&
            existing.some(
              (item) =>
                item.id === stage.id && (item.isConverted || item.isLost),
            ),
        )
      )
        throw new BadRequestException(
          "Converted and lost stages must remain active.",
        );
      await tx.pipelineStage.updateMany({
        where: { pipelineId },
        data: { position: { increment: 1000 } },
      });
      for (const [index, stage] of stages.entries())
        await tx.pipelineStage.update({
          where: { id: stage.id },
          data: {
            name: stage.name,
            colour: stage.colour,
            isActive: stage.isActive,
            position: (index + 1) * 10,
          },
        });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "crm.stages_updated",
          entityType: "pipeline",
          entityId: pipelineId,
        },
      });
      return tx.pipeline.findUnique({
        where: { id: pipelineId },
        include: { stages: { orderBy: { position: "asc" } } },
      });
    });
  }

  list(
    organisationId: string,
    userId: string,
    input: {
      search?: string;
      pipelineId?: string;
      stageId?: string;
      ownerMembershipId?: string;
      source?: string;
      status?: "OPEN" | "CONVERTED" | "LOST";
      cursor?: string;
      limit: number;
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const rows = await tx.lead.findMany({
        where: {
          organisationId,
          status: input.status ?? "OPEN",
          pipelineId: input.pipelineId,
          stageId: input.stageId,
          ownerMembershipId: input.ownerMembershipId,
          source: input.source,
          ...(input.search
            ? {
                OR: [
                  { name: { contains: input.search, mode: "insensitive" } },
                  { email: { contains: input.search, mode: "insensitive" } },
                  { phone: { contains: input.search } },
                ],
              }
            : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        include: leadInclude,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > input.limit,
        items = hasMore ? rows.slice(0, input.limit) : rows;
      return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
    });
  }
  get(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id, organisationId },
        include: {
          ...leadInclude,
          person: { include: { types: true } },
          followUps: { orderBy: { dueAt: "desc" } },
          notes: {
            orderBy: { createdAt: "desc" },
            include: {
              actor: { select: { id: true, name: true, email: true } },
            },
          },
          activities: {
            orderBy: { createdAt: "desc" },
            include: {
              actor: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
      if (!lead) throw new NotFoundException("Lead not found.");
      return lead;
    });
  }
  create(organisationId: string, userId: string, input: LeadInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await this.validateStage(
        tx,
        organisationId,
        input.pipelineId,
        input.stageId,
      );
      await this.validateMembership(
        tx,
        organisationId,
        input.ownerMembershipId,
      );
      const lead = await tx.lead.create({
        data: {
          organisationId,
          ...input,
          phone: input.phone || null,
          phoneNormalised: normalisePhone(input.phone),
          email: input.email || null,
          emailNormalised: normaliseEmail(input.email),
          activities: {
            create: {
              organisationId,
              actorUserId: userId,
              action: "lead.created",
              summary: "Lead created",
            },
          },
        },
        include: leadInclude,
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "lead.created",
          entityType: "lead",
          entityId: lead.id,
        },
      });
      return lead;
    });
  }
  update(
    organisationId: string,
    userId: string,
    id: string,
    input: Partial<LeadInput> & { lostReason?: string | null },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const current = await this.lead(tx, organisationId, id);
      if (current.status !== "OPEN")
        throw new ConflictException("Closed leads cannot be edited.");
      await this.validateMembership(
        tx,
        organisationId,
        input.ownerMembershipId,
      );
      let status: "OPEN" | "LOST" = "OPEN",
        lostReason = input.lostReason;
      if (input.stageId) {
        const stage = await this.validateStage(
          tx,
          organisationId,
          current.pipelineId,
          input.stageId,
        );
        if (stage.isConverted)
          throw new BadRequestException(
            "Use the conversion action for a converted stage.",
          );
        if (stage.isLost) {
          if (!lostReason?.trim())
            throw new BadRequestException("A lost reason is required.");
          status = "LOST";
        }
      }
      const lead = await tx.lead.update({
        where: { id },
        data: {
          ...input,
          phoneNormalised:
            input.phone !== undefined ? normalisePhone(input.phone) : undefined,
          emailNormalised:
            input.email !== undefined ? normaliseEmail(input.email) : undefined,
          status,
          lostReason: status === "LOST" ? lostReason : null,
        },
        include: leadInclude,
      });
      await this.activity(
        tx,
        organisationId,
        id,
        userId,
        status === "LOST" ? "lead.lost" : "lead.updated",
        status === "LOST" ? "Lead marked as lost" : "Lead updated",
      );
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: status === "LOST" ? "lead.lost" : "lead.updated",
          entityType: "lead",
          entityId: id,
        },
      });
      return lead;
    });
  }
  addNote(
    organisationId: string,
    userId: string,
    leadId: string,
    body: string,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await this.lead(tx, organisationId, leadId);
      const note = await tx.leadNote.create({
        data: { organisationId, leadId, actorUserId: userId, body },
      });
      await this.activity(
        tx,
        organisationId,
        leadId,
        userId,
        "lead.note_added",
        "Note added",
      );
      return note;
    });
  }
  scheduleFollowUp(
    organisationId: string,
    userId: string,
    leadId: string,
    input: { dueAt: Date; assignedToMembershipId?: string | null },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await this.lead(tx, organisationId, leadId);
      await this.validateMembership(
        tx,
        organisationId,
        input.assignedToMembershipId,
      );
      const followUp = await tx.followUp.create({
        data: { organisationId, leadId, ...input },
      });
      await this.activity(
        tx,
        organisationId,
        leadId,
        userId,
        "follow_up.scheduled",
        "Follow-up scheduled",
        { dueAt: input.dueAt.toISOString() },
      );
      return followUp;
    });
  }
  updateFollowUp(
    organisationId: string,
    userId: string,
    id: string,
    input: {
      dueAt?: Date;
      status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
      outcome?: string | null;
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const current = await tx.followUp.findFirst({
        where: { id, organisationId },
      });
      if (!current) throw new NotFoundException("Follow-up not found.");
      if (input.status === "COMPLETED" && !input.outcome?.trim())
        throw new BadRequestException(
          "An outcome is required to complete a follow-up.",
        );
      const followUp = await tx.followUp.update({
        where: { id },
        data: {
          ...input,
          completedAt:
            input.status === "COMPLETED"
              ? new Date()
              : input.status === "SCHEDULED"
                ? null
                : undefined,
        },
      });
      await this.activity(
        tx,
        organisationId,
        current.leadId,
        userId,
        input.status === "COMPLETED"
          ? "follow_up.completed"
          : "follow_up.updated",
        input.status === "COMPLETED"
          ? "Follow-up completed"
          : "Follow-up updated",
      );
      return followUp;
    });
  }
  getTodayFollowUps(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      return tx.followUp.findMany({
        where: {
          organisationId,
          status: "SCHEDULED",
          dueAt: { lte: endOfToday },
        },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              expectedValueMinor: true,
              stage: { select: { id: true, name: true, colour: true } },
              pipeline: { select: { id: true, name: true } },
            },
          },
          assignedTo: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { dueAt: "asc" },
        take: 50,
      });
    });
  }
  convert(
    organisationId: string,
    userId: string,
    leadId: string,
    personId?: string,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const lead = await this.lead(tx, organisationId, leadId);
      if (lead.status !== "OPEN")
        throw new ConflictException("Lead is already closed.");
      let person = personId
        ? await tx.person.findFirst({
            where: { id: personId, organisationId, status: "ACTIVE" },
          })
        : null;
      if (personId && !person) throw new NotFoundException("Person not found.");
      if (!person)
        person = await tx.person.findFirst({
          where: {
            organisationId,
            status: "ACTIVE",
            OR: [
              ...(lead.emailNormalised
                ? [{ emailNormalised: lead.emailNormalised }]
                : []),
              ...(lead.phoneNormalised
                ? [{ primaryPhoneNormalised: lead.phoneNormalised }]
                : []),
            ],
          },
        });
      if (!person)
        person = await tx.person.create({
          data: {
            organisationId,
            displayName: lead.name,
            primaryPhone: lead.phone,
            primaryPhoneNormalised: lead.phoneNormalised,
            email: lead.email,
            emailNormalised: lead.emailNormalised,
            types: { create: { organisationId, type: "CUSTOMER" } },
            activities: {
              create: {
                organisationId,
                actorUserId: userId,
                action: "person.created_from_lead",
                summary: "Customer created from lead",
              },
            },
          },
        });
      else
        await tx.personTypeAssignment.upsert({
          where: { personId_type: { personId: person.id, type: "CUSTOMER" } },
          update: {},
          create: { organisationId, personId: person.id, type: "CUSTOMER" },
        });
      const convertedStage = await tx.pipelineStage.findFirst({
        where: {
          organisationId,
          pipelineId: lead.pipelineId,
          isConverted: true,
          isActive: true,
        },
      });
      if (!convertedStage)
        throw new ConflictException("Pipeline has no active converted stage.");
      const converted = await tx.lead.update({
        where: { id: leadId },
        data: {
          personId: person.id,
          stageId: convertedStage.id,
          status: "CONVERTED",
          convertedAt: new Date(),
        },
        include: leadInclude,
      });
      await this.activity(
        tx,
        organisationId,
        leadId,
        userId,
        "lead.converted",
        "Lead converted to customer",
        { personId: person.id },
      );
      await tx.personActivity.create({
        data: {
          organisationId,
          personId: person.id,
          actorUserId: userId,
          action: "lead.converted",
          summary: "Lead converted and linked to customer",
          metadata: { leadId },
        },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "lead.converted",
          entityType: "lead",
          entityId: leadId,
          metadata: { personId: person.id },
        },
      });
      return { lead: converted, person };
    });
  }
  metrics(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const now = new Date(),
        monthStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        );
      const newLeads = await tx.lead.count({
        where: { organisationId, createdAt: { gte: monthStart } },
      });
      const conversions = await tx.lead.count({
        where: {
          organisationId,
          status: "CONVERTED",
          convertedAt: { gte: monthStart },
        },
      });
      const dueFollowUps = await tx.followUp.count({
        where: { organisationId, status: "SCHEDULED", dueAt: { lte: now } },
      });
      const stages = await tx.pipelineStage.findMany({
        where: { organisationId, isActive: true },
        orderBy: { position: "asc" },
        include: {
          _count: { select: { leads: { where: { status: "OPEN" } } } },
        },
      });
      const sources = await tx.lead.groupBy({
        by: ["source"],
        where: { organisationId },
        _count: true,
        orderBy: { _count: { source: "desc" } },
        take: 10,
      });
      return {
        newLeads,
        conversions,
        dueFollowUps,
        conversionRate: newLeads
          ? Math.round((conversions / newLeads) * 10000) / 100
          : 0,
        stages: stages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          count: stage._count.leads,
        })),
        sources,
      };
    });
  }

  async importCsv(
    organisationId: string,
    userId: string,
    input: {
      csv: string;
      preview: boolean;
      pipelineId: string;
      stageId: string;
      ownerMembershipId?: string | null;
    },
  ) {
    let rows: string[][];
    try {
      rows = parseCsv(input.csv);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (rows.length < 2)
      throw new BadRequestException(
        "CSV must contain a header and at least one lead.",
      );
    if (rows.length > 1001)
      throw new BadRequestException(
        "A maximum of 1,000 leads can be imported at once.",
      );
    const headers = rows[0]!.map((header) => header.trim().toLowerCase()),
      nameIndex = headers.indexOf("name");
    if (nameIndex < 0)
      throw new BadRequestException("CSV requires a name column.");
    const value = (row: string[], key: string) => {
      const index = headers.indexOf(key);
      return index < 0 ? "" : (row[index]?.trim() ?? "");
    };
    const candidates = rows
      .slice(1)
      .map((row, index) => ({
        row: index + 2,
        name: row[nameIndex]?.trim() ?? "",
        phone: value(row, "phone"),
        email: value(row, "email"),
        source: value(row, "source"),
        expectedValueMinor:
          Number(value(row, "expected_value_minor") || 0) || null,
      }));
    const errors: { row: number; message: string }[] = [];
    for (const item of candidates) {
      if (item.name.length < 2)
        errors.push({
          row: item.row,
          message: "Name must contain at least 2 characters.",
        });
      if (item.email && !/^\S+@\S+\.\S+$/.test(item.email))
        errors.push({ row: item.row, message: "Email is invalid." });
      if (
        item.expectedValueMinor != null &&
        (!Number.isInteger(item.expectedValueMinor) ||
          item.expectedValueMinor < 0)
      )
        errors.push({
          row: item.row,
          message: "Expected value must be a positive integer in minor units.",
        });
    }
    const valid = candidates.filter(
      (item) => !errors.some((error) => error.row === item.row),
    );
    if (!input.preview && !errors.length)
      await withTenant(this.database, organisationId, userId, async (tx) => {
        await this.validateStage(
          tx,
          organisationId,
          input.pipelineId,
          input.stageId,
        );
        await this.validateMembership(
          tx,
          organisationId,
          input.ownerMembershipId,
        );
        for (const item of valid)
          await tx.lead.create({
            data: {
              organisationId,
              pipelineId: input.pipelineId,
              stageId: input.stageId,
              ownerMembershipId: input.ownerMembershipId,
              name: item.name,
              phone: item.phone || null,
              phoneNormalised: normalisePhone(item.phone),
              email: item.email || null,
              emailNormalised: normaliseEmail(item.email),
              source: item.source || null,
              expectedValueMinor: item.expectedValueMinor,
              activities: {
                create: {
                  organisationId,
                  actorUserId: userId,
                  action: "lead.imported",
                  summary: "Lead imported from CSV",
                },
              },
            },
          });
        await tx.auditLog.create({
          data: {
            organisationId,
            actorUserId: userId,
            action: "crm.leads_imported",
            entityType: "lead",
            metadata: { count: valid.length },
          },
        });
      });
    return {
      preview: input.preview,
      totalRows: candidates.length,
      validRows: valid.length,
      errors,
      imported: !input.preview && !errors.length ? valid.length : 0,
    };
  }
}
