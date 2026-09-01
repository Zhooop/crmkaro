import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient, PersonTypeCode, Prisma } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { PersonInput } from "./people.schemas.js";
import { csvCell, normaliseEmail, normalisePhone, parseCsv } from "./people.utils.js";

type PersonUpdate = Partial<PersonInput>;
type TenantTx = Prisma.TransactionClient;
const personInclude = { types: true, tags: { include: { tag: true } } } as const;

@Injectable()
export class PeopleService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  private async ensureTags(tx: TenantTx, organisationId: string, tagIds: string[]) {
    const unique = [...new Set(tagIds)];
    if (!unique.length) return unique;
    const count = await tx.tag.count({ where: { organisationId, id: { in: unique } } });
    if (count !== unique.length) throw new BadRequestException("One or more tags are invalid.");
    return unique;
  }

  private duplicateWhere(organisationId: string, email?: string | null, phone?: string | null, excludeId?: string) {
    const emailNormalised = normaliseEmail(email), primaryPhoneNormalised = normalisePhone(phone);
    return { organisationId, ...(excludeId ? { id: { not: excludeId } } : {}), OR: [
      ...(emailNormalised ? [{ emailNormalised }] : []), ...(primaryPhoneNormalised ? [{ primaryPhoneNormalised }] : []),
    ] };
  }

  findDuplicates(organisationId: string, userId: string, email?: string | null, phone?: string | null, excludeId?: string) {
    const where = this.duplicateWhere(organisationId, email, phone, excludeId);
    if (!where.OR.length) return Promise.resolve([]);
    return withTenant(this.database, organisationId, userId, (tx) => tx.person.findMany({ where, take: 10, select: { id: true, displayName: true, email: true, primaryPhone: true, status: true } }));
  }

  list(
    organisationId: string,
    userId: string,
    input: {
      search?: string;
      status?: "ACTIVE" | "ARCHIVED";
      type?: PersonTypeCode;
      types?: PersonTypeCode[];
      excludeType?: PersonTypeCode;
      tagId?: string;
      cursor?: string;
      limit: number;
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const typeFilter: any = {};
      if (input.types && input.types.length > 0) {
        typeFilter.types = { some: { type: { in: input.types } } };
      } else if (input.type) {
        typeFilter.types = { some: { type: input.type } };
      }
      const excludeFilter: any = {};
      if (input.excludeType) {
        excludeFilter.types = { none: { type: input.excludeType } };
      }

      const rows = await tx.person.findMany({
        where: {
          organisationId,
          status: input.status ?? "ACTIVE",
          ...(input.search
            ? {
                OR: [
                  { displayName: { contains: input.search, mode: "insensitive" } },
                  { email: { contains: input.search, mode: "insensitive" } },
                  { primaryPhone: { contains: input.search } },
                ],
              }
            : {}),
          ...typeFilter,
          ...excludeFilter,
          ...(input.tagId ? { tags: { some: { tagId: input.tagId } } } : {}),
        },
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        include: personInclude,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > input.limit,
        items = hasMore ? rows.slice(0, input.limit) : rows;
      return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
    });
  }

  get(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const person = await tx.person.findFirst({ where: { id, organisationId }, include: { ...personInclude, activities: { orderBy: { createdAt: "desc" }, take: 25, include: { actor: { select: { id: true, name: true, email: true } } } } } });
      if (!person) throw new NotFoundException("Person not found.");
      return person;
    });
  }

  create(organisationId: string, userId: string, input: PersonInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const tagIds = await this.ensureTags(tx, organisationId, input.tagIds);
      const duplicates = await tx.person.findMany({ where: this.duplicateWhere(organisationId, input.email, input.primaryPhone), take: 10, select: { id: true, displayName: true, email: true, primaryPhone: true } });
      const person = await tx.person.create({ data: {
        organisationId, displayName: input.displayName, primaryPhone: input.primaryPhone || null, primaryPhoneNormalised: normalisePhone(input.primaryPhone), alternatePhone: input.alternatePhone || null,
        email: input.email || null, emailNormalised: normaliseEmail(input.email), address: input.address ?? undefined, notes: input.notes || null,
        types: { create: input.types.map((type) => ({ organisationId, type })) }, tags: { create: tagIds.map((tagId) => ({ organisationId, tagId })) },
        activities: { create: { organisationId, actorUserId: userId, action: "person.created", summary: "Person record created" } },
      }, include: personInclude });

      if (input.types.includes("STUDENT")) {
        const addressJson = (input.address && typeof input.address === "object" ? input.address : {}) as Record<string, any>;
        try {
          await tx.studentProfile.create({
            data: {
              organisationId,
              personId: person.id,
              status: "ACTIVE",
              standard: addressJson.standard || "General",
              batch: addressJson.batch || "Regular",
              guardianName: addressJson.guardianName || null,
              rollNumber: addressJson.admissionNo || null,
              admissionDate: addressJson.admissionDate ? new Date(addressJson.admissionDate) : new Date(),
            },
          });
        } catch {
          // ignore duplicate / race
        }
      }

      await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "person.created", entityType: "person", entityId: person.id, metadata: { types: input.types } } });
      return { person, duplicateWarnings: duplicates };
    });
  }

  update(organisationId: string, userId: string, id: string, input: PersonUpdate) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const current = await tx.person.findFirst({ where: { id, organisationId } });
      if (!current) throw new NotFoundException("Person not found.");
      const tagIds = input.tagIds ? await this.ensureTags(tx, organisationId, input.tagIds) : undefined;
      if (input.types) { await tx.personTypeAssignment.deleteMany({ where: { personId: id, organisationId } }); await tx.personTypeAssignment.createMany({ data: input.types.map((type) => ({ organisationId, personId: id, type })) }); }
      if (tagIds) { await tx.personTag.deleteMany({ where: { personId: id, organisationId } }); await tx.personTag.createMany({ data: tagIds.map((tagId) => ({ organisationId, personId: id, tagId })) }); }
      const person = await tx.person.update({ where: { id }, data: {
        displayName: input.displayName, primaryPhone: input.primaryPhone, primaryPhoneNormalised: input.primaryPhone !== undefined ? normalisePhone(input.primaryPhone) : undefined,
        alternatePhone: input.alternatePhone, email: input.email, emailNormalised: input.email !== undefined ? normaliseEmail(input.email) : undefined,
        address: input.address ?? undefined, notes: input.notes,
        activities: { create: { organisationId, actorUserId: userId, action: "person.updated", summary: "Person profile updated" } },
      }, include: personInclude });

      if (input.types && input.types.includes("STUDENT")) {
        const studentProfile = await tx.studentProfile.findFirst({ where: { personId: id, organisationId } });
        const addressJson = (input.address && typeof input.address === "object" ? input.address : {}) as Record<string, any>;
        if (!studentProfile) {
          try {
            await tx.studentProfile.create({
              data: {
                organisationId,
                personId: id,
                status: "ACTIVE",
                standard: addressJson.standard || "General",
                batch: addressJson.batch || "Regular",
                guardianName: addressJson.guardianName || null,
                rollNumber: addressJson.admissionNo || null,
                admissionDate: addressJson.admissionDate ? new Date(addressJson.admissionDate) : new Date(),
              },
            });
          } catch {}
        } else if (addressJson.guardianName || addressJson.admissionNo || addressJson.standard || addressJson.batch) {
          await tx.studentProfile.update({
            where: { id: studentProfile.id },
            data: {
              ...(addressJson.guardianName ? { guardianName: addressJson.guardianName } : {}),
              ...(addressJson.admissionNo ? { rollNumber: addressJson.admissionNo } : {}),
              ...(addressJson.standard ? { standard: addressJson.standard } : {}),
              ...(addressJson.batch ? { batch: addressJson.batch } : {}),
            },
          });
        }
      }

      const duplicates = await tx.person.findMany({ where: this.duplicateWhere(organisationId, input.email ?? current.email, input.primaryPhone ?? current.primaryPhone, id), take: 10, select: { id: true, displayName: true, email: true, primaryPhone: true } });
      await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "person.updated", entityType: "person", entityId: id } });
      return { person, duplicateWarnings: duplicates };
    });
  }

  archive(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const exists = await tx.person.findFirst({ where: { id, organisationId } }); if (!exists) throw new NotFoundException("Person not found.");
      const person = await tx.person.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date(), activities: { create: { organisationId, actorUserId: userId, action: "person.archived", summary: "Person record archived" } } } });
      await tx.studentProfile.updateMany({ where: { personId: id, organisationId }, data: { status: "INACTIVE", inactivatedAt: new Date() } });
      await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "person.archived", entityType: "person", entityId: id } }); return person;
    });
  }

  unarchive(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const exists = await tx.person.findFirst({ where: { id, organisationId } }); if (!exists) throw new NotFoundException("Person not found.");
      const person = await tx.person.update({ where: { id }, data: { status: "ACTIVE", archivedAt: null, activities: { create: { organisationId, actorUserId: userId, action: "person.unarchived", summary: "Person record unarchived / restored" } } } });
      await tx.studentProfile.updateMany({ where: { personId: id, organisationId }, data: { status: "ACTIVE", inactivatedAt: null } });
      await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "person.unarchived", entityType: "person", entityId: id } }); return person;
    });
  }

  listTags(organisationId: string, userId: string) { return withTenant(this.database, organisationId, userId, (tx) => tx.tag.findMany({ where: { organisationId }, orderBy: { name: "asc" } })); }
  createTag(organisationId: string, userId: string, input: { name: string; colour: string }) { return withTenant(this.database, organisationId, userId, (tx) => tx.tag.upsert({ where: { organisationId_name: { organisationId, name: input.name } }, update: { colour: input.colour }, create: { organisationId, ...input } })); }

  async importCsv(organisationId: string, userId: string, csv: string, preview: boolean) {
    let rows: string[][]; try { rows = parseCsv(csv); } catch (error) { throw new BadRequestException((error as Error).message); }
    if (rows.length < 2) throw new BadRequestException("CSV must contain a header and at least one data row.");
    if (rows.length > 1001) throw new BadRequestException("A maximum of 1,000 people can be imported at once.");
    const headers = rows[0]!.map((header) => header.trim().toLowerCase());
    const requiredName = headers.findIndex((header) => header === "display_name" || header === "name");
    if (requiredName < 0) throw new BadRequestException("CSV requires a name or display_name column.");
    const value = (row: string[], key: string) => { const index = headers.indexOf(key); return index < 0 ? "" : row[index]?.trim() ?? ""; };
    const candidates = rows.slice(1).map((row, index) => ({ row: index + 2, displayName: row[requiredName]?.trim() ?? "", email: value(row, "email"), primaryPhone: value(row, "primary_phone") || value(row, "phone"), types: (value(row, "types") || "CUSTOMER").split("|").map((item) => item.trim().toUpperCase()) }));
    const allowedTypes = new Set(["CUSTOMER", "STUDENT", "MEMBER", "EMPLOYEE"]), errors: { row: number; message: string }[] = [];
    for (const item of candidates) { if (item.displayName.length < 2) errors.push({ row: item.row, message: "Name must contain at least 2 characters." }); if (item.email && !/^\S+@\S+\.\S+$/.test(item.email)) errors.push({ row: item.row, message: "Email is invalid." }); if (item.types.some((type) => !allowedTypes.has(type))) errors.push({ row: item.row, message: "Person type is invalid." }); }
    const valid = candidates.filter((item) => !errors.some((error) => error.row === item.row));
    const duplicateWarnings = await withTenant(this.database, organisationId, userId, async (tx) => {
      const warnings: { row: number; matches: string[] }[] = [];
      for (const item of valid) { const where = this.duplicateWhere(organisationId, item.email, item.primaryPhone); if (!where.OR.length) continue; const matches = await tx.person.findMany({ where, select: { displayName: true } }); if (matches.length) warnings.push({ row: item.row, matches: matches.map((match) => match.displayName) }); }
      if (!preview && !errors.length) { for (const item of valid) { const person = await tx.person.create({ data: { organisationId, displayName: item.displayName, email: item.email || null, emailNormalised: normaliseEmail(item.email), primaryPhone: item.primaryPhone || null, primaryPhoneNormalised: normalisePhone(item.primaryPhone), types: { create: item.types.map((type) => ({ organisationId, type: type as PersonTypeCode })) }, activities: { create: { organisationId, actorUserId: userId, action: "person.imported", summary: "Person imported from CSV" } } } }); await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "person.imported", entityType: "person", entityId: person.id } }); } await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "people.csv_imported", entityType: "people", metadata: { count: valid.length } } }); }
      return warnings;
    });
    return { preview, totalRows: candidates.length, validRows: valid.length, errors, duplicateWarnings, imported: !preview && !errors.length ? valid.length : 0 };
  }

  exportCsv(organisationId: string, userId: string) { return withTenant(this.database, organisationId, userId, async (tx) => { const people = await tx.person.findMany({ where: { organisationId }, include: personInclude, orderBy: { displayName: "asc" } }); await tx.auditLog.create({ data: { organisationId, actorUserId: userId, action: "people.csv_exported", entityType: "people", metadata: { count: people.length } } }); return [["display_name","primary_phone","alternate_phone","email","status","types","tags","notes"].map(csvCell).join(","), ...people.map((person) => [person.displayName,person.primaryPhone,person.alternatePhone,person.email,person.status,person.types.map((type) => type.type).join("|"),person.tags.map(({ tag }) => tag.name).join("|"),person.notes].map(csvCell).join(","))].join("\r\n"); }); }
}
