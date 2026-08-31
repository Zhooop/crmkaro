import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  withTenant,
  type DatabaseClient,
  type StudentStatus,
  type AttendanceStatus,
  type FeeFrequency,
} from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import { normaliseEmail, normalisePhone } from "../people/people.utils.js";
import { calculateInvoice } from "../finance/finance.utils.js";
import type {
  CollectFeeInput,
  RecordAttendanceBatchInput,
  StudentAdmissionInput,
  StudentUpdateInput,
} from "./students.schemas.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMonthLabel(yyyyMm: string): string {
  const [yearStr, monthStr] = yyyyMm.split("-");
  const monthIdx = Number(monthStr) - 1;
  return `${MONTH_NAMES[monthIdx] || monthStr} ${yearStr}`;
}

@Injectable()
export class StudentsService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  private async sequence(
    tx: any,
    organisationId: string,
    code: string,
  ): Promise<number> {
    const sequence = await tx.organisationSequence.upsert({
      where: { organisationId_code: { organisationId, code } },
      update: { currentValue: { increment: 1 } },
      create: { organisationId, code, currentValue: 1 },
    });
    return sequence.currentValue;
  }

  async list(
    organisationId: string,
    userId: string,
    input: {
      search?: string;
      standard?: string;
      batch?: string;
      status?: StudentStatus;
      limit?: number;
      cursor?: string;
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const limit = input.limit ?? 100;
      const where: any = {
        organisationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.standard ? { standard: input.standard } : {}),
        ...(input.batch ? { batch: input.batch } : {}),
        ...(input.search
          ? {
              OR: [
                { rollNumber: { contains: input.search, mode: "insensitive" } },
                { standard: { contains: input.search, mode: "insensitive" } },
                { batch: { contains: input.search, mode: "insensitive" } },
                { guardianName: { contains: input.search, mode: "insensitive" } },
                { guardianPhone: { contains: input.search } },
                {
                  person: {
                    displayName: { contains: input.search, mode: "insensitive" },
                  },
                },
                { person: { primaryPhone: { contains: input.search } } },
              ],
            }
          : {}),
      };

      const rows = await tx.studentProfile.findMany({
        where,
        orderBy: [{ standard: "asc" }, { rollNumber: "asc" }, { createdAt: "desc" }],
        include: {
          person: {
            select: {
              id: true,
              displayName: true,
              primaryPhone: true,
              alternatePhone: true,
              email: true,
              address: true,
              status: true,
            },
          },
        },
        take: limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      return {
        items,
        nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
      };
    });
  }

  async get(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const student = await tx.studentProfile.findFirst({
        where: { id, organisationId },
        include: {
          person: {
            include: {
              invoices: {
                orderBy: { issueDate: "desc" },
                take: 20,
                include: { payments: true, items: true },
              },
            },
          },
          attendances: {
            orderBy: { date: "desc" },
            take: 60,
          },
        },
      });

      if (!student) throw new NotFoundException("Student profile not found.");
      return student;
    });
  }

  async createAdmission(
    organisationId: string,
    userId: string,
    input: StudentAdmissionInput,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      // 1. Create or link Person
      const person = await tx.person.create({
        data: {
          organisationId,
          displayName: input.displayName,
          primaryPhone: input.primaryPhone || null,
          primaryPhoneNormalised: normalisePhone(input.primaryPhone),
          alternatePhone: input.alternatePhone || null,
          email: input.email || null,
          emailNormalised: normaliseEmail(input.email),
          address: input.address ?? undefined,
          notes: input.notes || null,
          types: {
            create: [
              { organisationId, type: "STUDENT" },
              { organisationId, type: "CUSTOMER" },
            ],
          },
          activities: {
            create: {
              organisationId,
              actorUserId: userId,
              action: "student.enrolled",
              summary: `Enrolled in ${input.standard}${input.batch ? ` (${input.batch})` : ""}`,
            },
          },
        },
      });

      // 2. Generate Roll Number if not provided
      let roll = input.rollNumber?.trim();
      if (!roll) {
        const seq = await this.sequence(tx, organisationId, "student_roll");
        roll = `STD-${String(seq).padStart(4, "0")}`;
      }

      // 3. Create Student Profile
      const student = await tx.studentProfile.create({
        data: {
          organisationId,
          personId: person.id,
          rollNumber: roll,
          standard: input.standard.trim(),
          batch: input.batch?.trim() || null,
          guardianName: input.guardianName?.trim() || null,
          guardianPhone: input.guardianPhone?.trim() || null,
          guardianRelation: input.guardianRelation?.trim() || null,
          feeFrequency: input.feeFrequency as FeeFrequency,
          feeAmountMinor: input.feeAmountMinor,
          billingStartDate: input.billingStartDate,
          admissionDate: input.admissionDate,
          status: "ACTIVE",
        },
        include: { person: true },
      });

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "student.admitted",
          entityType: "student_profile",
          entityId: student.id,
          metadata: {
            rollNumber: student.rollNumber,
            standard: student.standard,
            feeAmountMinor: student.feeAmountMinor,
          },
        },
      });

      return student;
    });
  }

  async update(
    organisationId: string,
    userId: string,
    id: string,
    input: StudentUpdateInput,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const existing = await tx.studentProfile.findFirst({
        where: { id, organisationId },
      });
      if (!existing) throw new NotFoundException("Student profile not found.");

      // Update Person details if provided
      if (
        input.displayName ||
        input.primaryPhone !== undefined ||
        input.alternatePhone !== undefined ||
        input.email !== undefined ||
        input.address !== undefined ||
        input.notes !== undefined
      ) {
        await tx.person.update({
          where: { id: existing.personId },
          data: {
            ...(input.displayName ? { displayName: input.displayName } : {}),
            ...(input.primaryPhone !== undefined
              ? {
                  primaryPhone: input.primaryPhone || null,
                  primaryPhoneNormalised: normalisePhone(input.primaryPhone),
                }
              : {}),
            ...(input.alternatePhone !== undefined
              ? { alternatePhone: input.alternatePhone || null }
              : {}),
            ...(input.email !== undefined
              ? {
                  email: input.email || null,
                  emailNormalised: normaliseEmail(input.email),
                }
              : {}),
            ...(input.address !== undefined
              ? { address: input.address ?? undefined }
              : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          },
        });
      }

      // Update StudentProfile details
      const student = await tx.studentProfile.update({
        where: { id },
        data: {
          ...(input.rollNumber !== undefined ? { rollNumber: input.rollNumber } : {}),
          ...(input.standard !== undefined ? { standard: input.standard } : {}),
          ...(input.batch !== undefined ? { batch: input.batch } : {}),
          ...(input.guardianName !== undefined ? { guardianName: input.guardianName } : {}),
          ...(input.guardianPhone !== undefined ? { guardianPhone: input.guardianPhone } : {}),
          ...(input.guardianRelation !== undefined
            ? { guardianRelation: input.guardianRelation }
            : {}),
          ...(input.feeFrequency !== undefined
            ? { feeFrequency: input.feeFrequency as FeeFrequency }
            : {}),
          ...(input.feeAmountMinor !== undefined
            ? { feeAmountMinor: input.feeAmountMinor }
            : {}),
          ...(input.status !== undefined ? { status: input.status as StudentStatus } : {}),
        },
        include: { person: true },
      });

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "student.updated",
          entityType: "student_profile",
          entityId: id,
        },
      });

      return student;
    });
  }

  async toggleStatus(
    organisationId: string,
    userId: string,
    id: string,
    status: StudentStatus,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const student = await tx.studentProfile.findFirst({
        where: { id, organisationId },
      });
      if (!student) throw new NotFoundException("Student profile not found.");

      const updated = await tx.studentProfile.update({
        where: { id },
        data: {
          status,
          inactivatedAt: status === "INACTIVE" ? new Date() : null,
        },
        include: { person: true },
      });

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: status === "ACTIVE" ? "student.reactivated" : "student.deactivated",
          entityType: "student_profile",
          entityId: id,
        },
      });

      return updated;
    });
  }

  async getRecurringFeesDashboard(
    organisationId: string,
    userId: string,
    month: string,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const monthLabel = formatMonthLabel(targetMonth);

      // Fetch all active students
      const students = await tx.studentProfile.findMany({
        where: {
          organisationId,
          status: "ACTIVE",
        },
        orderBy: [{ standard: "asc" }, { rollNumber: "asc" }],
        include: {
          person: {
            select: {
              id: true,
              displayName: true,
              primaryPhone: true,
              email: true,
            },
          },
        },
      });

      // Fetch invoices for these students matching this cycle
      const invoices = await tx.invoice.findMany({
        where: {
          organisationId,
          notes: { contains: targetMonth },
        },
        include: {
          payments: { orderBy: { receivedAt: "desc" } },
        },
      });

      const invoiceByPersonId = new Map<string, (typeof invoices)[0]>();
      for (const inv of invoices) {
        invoiceByPersonId.set(inv.personId, inv);
      }

      let totalExpectedMinor = 0;
      let totalCollectedMinor = 0;
      let totalPendingMinor = 0;

      const studentFeeList = students.map((std) => {
        const feePlanAmount = std.feeAmountMinor || 0;
        totalExpectedMinor += feePlanAmount;

        const inv = invoiceByPersonId.get(std.personId);
        let status: "PAID" | "PARTIALLY_PAID" | "PENDING" = "PENDING";
        let paidMinor = 0;
        let balanceMinor = feePlanAmount;

        if (inv) {
          paidMinor = inv.paidTotalMinor;
          balanceMinor = inv.balanceDueMinor;
          if (inv.status === "PAID" || balanceMinor <= 0) {
            status = "PAID";
          } else if (paidMinor > 0) {
            status = "PARTIALLY_PAID";
          }
        }

        totalCollectedMinor += paidMinor;
        totalPendingMinor += Math.max(0, balanceMinor);

        return {
          studentProfileId: std.id,
          personId: std.personId,
          displayName: std.person.displayName,
          rollNumber: std.rollNumber,
          standard: std.standard,
          batch: std.batch,
          guardianName: std.guardianName,
          guardianPhone: std.guardianPhone || std.person.primaryPhone,
          feeFrequency: std.feeFrequency,
          feePlanAmountMinor: feePlanAmount,
          cycleMonth: targetMonth,
          cycleMonthLabel: monthLabel,
          status,
          paidMinor,
          balanceMinor,
          invoiceId: inv?.id || null,
          invoiceNumber: inv?.invoiceNumber || null,
          lastPaymentDate: inv?.payments[0]?.receivedAt || null,
        };
      });

      return {
        cycleMonth: targetMonth,
        cycleMonthLabel: monthLabel,
        totalExpectedMinor,
        totalCollectedMinor,
        totalPendingMinor,
        studentsCount: students.length,
        paidCount: studentFeeList.filter((s) => s.status === "PAID").length,
        pendingCount: studentFeeList.filter((s) => s.status !== "PAID").length,
        items: studentFeeList,
      };
    });
  }

  async collectFee(
    organisationId: string,
    userId: string,
    input: CollectFeeInput,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const student = await tx.studentProfile.findFirst({
        where: { id: input.studentProfileId, organisationId },
        include: { person: true, organisation: true },
      });
      if (!student) throw new NotFoundException("Student not found.");

      const monthLabel = formatMonthLabel(input.month);
      const description = `Tuition / Course Fee — ${student.standard}${student.batch ? ` (${student.batch})` : ""} [${monthLabel}]`;

      // 1. Check if invoice already exists for this cycle
      let existingInvoice = await tx.invoice.findFirst({
        where: {
          organisationId,
          personId: student.personId,
          notes: { contains: input.month },
        },
        include: { payments: true },
      });

      let invoice = existingInvoice;
      const targetAmountMinor = input.amountMinor || student.feeAmountMinor;

      if (!invoice) {
        // Create new invoice for the fee cycle
        const invoiceCalc = calculateInvoice([
          {
            quantity: 1,
            unitPriceMinor: targetAmountMinor,
            discountMinor: 0,
            taxRateBps: 0,
          },
        ]);

        const seq = await this.sequence(tx, organisationId, "invoice");
        const invoiceNumber = `FEE-${String(seq).padStart(6, "0")}`;
        const issueDate = input.receivedAt || new Date();
        const dueDate = issueDate;

        invoice = await tx.invoice.create({
          data: {
            organisationId,
            personId: student.personId,
            invoiceNumber,
            issueDate,
            dueDate,
            status: "ISSUED",
            currency: student.organisation.currency || "INR",
            subtotalMinor: invoiceCalc.subtotalMinor,
            discountMinor: 0,
            taxMinor: 0,
            grandTotalMinor: invoiceCalc.grandTotalMinor,
            paidTotalMinor: 0,
            balanceDueMinor: invoiceCalc.grandTotalMinor,
            notes: `Fee Cycle: ${input.month} (${monthLabel}). ${input.notes || ""}`.trim(),
            issuedAt: new Date(),
            items: {
              create: [
                {
                  organisationId,
                  description,
                  quantity: 1,
                  unitPriceMinor: targetAmountMinor,
                  discountMinor: 0,
                  taxRateBps: 0,
                  taxMinor: 0,
                  lineTotalMinor: targetAmountMinor,
                  position: 1,
                },
              ],
            },
          },
          include: { items: true, payments: true },
        });
      }

      // 2. Record Payment
      const pSeq = await this.sequence(tx, organisationId, "receipt");
      const receiptNumber = `REC-${String(pSeq).padStart(6, "0")}`;

      const payment = await tx.payment.create({
        data: {
          organisationId,
          invoiceId: invoice.id,
          personId: student.personId,
          recordedById: userId,
          receiptNumber,
          amountMinor: targetAmountMinor,
          method: input.paymentMethod,
          reference: input.reference || null,
          receivedAt: input.receivedAt || new Date(),
          notes: `Paid for ${monthLabel}. ${input.notes || ""}`.trim(),
          status: "COMPLETED",
        },
      });

      // 3. Update Invoice Paid & Balance Due
      const newPaidTotal = (invoice.paidTotalMinor || 0) + targetAmountMinor;
      const newBalanceDue = Math.max(0, invoice.grandTotalMinor - newPaidTotal);
      const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidTotalMinor: newPaidTotal,
          balanceDueMinor: newBalanceDue,
          status: newStatus,
        },
        include: { items: true, payments: true, person: true },
      });

      // 4. Log Activity
      await tx.personActivity.create({
        data: {
          organisationId,
          personId: student.personId,
          actorUserId: userId,
          action: "student.fee_paid",
          summary: `Fee collected ₹${(targetAmountMinor / 100).toFixed(0)} for ${monthLabel} via ${input.paymentMethod} (Receipt: ${receiptNumber})`,
        },
      });

      // 5. Generate WhatsApp text
      const phone = student.guardianPhone || student.person.primaryPhone || "";
      const orgName = student.organisation.name || "Institute";
      const waText = `Dear Guardian/Student,\nFee payment received successfully for *${student.person.displayName}* (${student.standard}${student.batch ? ` - ${student.batch}` : ""}).\n\n📌 *Receipt No:* ${receiptNumber}\n📅 *Month:* ${monthLabel}\n💰 *Amount Paid:* ₹${(targetAmountMinor / 100).toLocaleString("en-IN")}\n💳 *Payment Mode:* ${input.paymentMethod}\n\nThank you,\n*${orgName}*`;

      return {
        invoice: updatedInvoice,
        payment,
        receiptNumber,
        monthLabel,
        whatsappText: waText,
        whatsappUrl: phone
          ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waText)}`
          : null,
      };
    });
  }

  async getAttendance(
    organisationId: string,
    userId: string,
    input: { date: Date; standard?: string; batch?: string },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const dateOnly = new Date(input.date);
      dateOnly.setHours(0, 0, 0, 0);

      // Fetch all active students
      const students = await tx.studentProfile.findMany({
        where: {
          organisationId,
          status: "ACTIVE",
          ...(input.standard ? { standard: input.standard } : {}),
          ...(input.batch ? { batch: input.batch } : {}),
        },
        orderBy: [{ standard: "asc" }, { rollNumber: "asc" }],
        include: {
          person: {
            select: {
              id: true,
              displayName: true,
              primaryPhone: true,
            },
          },
        },
      });

      // Fetch attendance records for this date
      const records = await tx.attendanceRecord.findMany({
        where: {
          organisationId,
          date: dateOnly,
        },
      });

      const recordMap = new Map<string, (typeof records)[0]>();
      for (const rec of records) {
        recordMap.set(rec.studentProfileId, rec);
      }

      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;

      const items = students.map((std) => {
        const rec = recordMap.get(std.id);
        const status: AttendanceStatus = rec?.status || "PRESENT"; // Default present for quick attendance

        if (status === "PRESENT") presentCount++;
        else if (status === "ABSENT") absentCount++;
        else if (status === "LEAVE") leaveCount++;

        return {
          studentProfileId: std.id,
          personId: std.personId,
          displayName: std.person.displayName,
          rollNumber: std.rollNumber,
          standard: std.standard,
          batch: std.batch,
          primaryPhone: std.person.primaryPhone,
          status,
          remarks: rec?.remarks || "",
          recordedAt: rec?.createdAt || null,
        };
      });

      return {
        date: dateOnly.toISOString().slice(0, 10),
        totalStudents: students.length,
        presentCount,
        absentCount,
        leaveCount,
        attendancePercentage:
          students.length > 0
            ? Math.round((presentCount / students.length) * 100)
            : 0,
        items,
      };
    });
  }

  async recordAttendanceBatch(
    organisationId: string,
    userId: string,
    input: RecordAttendanceBatchInput,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const dateOnly = new Date(input.date);
      dateOnly.setHours(0, 0, 0, 0);

      const updatedRecords = [];
      for (const rec of input.records) {
        const student = await tx.studentProfile.findFirst({
          where: { id: rec.studentProfileId, organisationId },
        });
        if (!student) continue;

        const record = await tx.attendanceRecord.upsert({
          where: {
            organisationId_studentProfileId_date: {
              organisationId,
              studentProfileId: rec.studentProfileId,
              date: dateOnly,
            },
          },
          update: {
            status: rec.status,
            remarks: rec.remarks || null,
            recordedById: userId,
          },
          create: {
            organisationId,
            studentProfileId: rec.studentProfileId,
            personId: student.personId,
            date: dateOnly,
            status: rec.status,
            remarks: rec.remarks || null,
            recordedById: userId,
          },
        });
        updatedRecords.push(record);
      }

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "attendance.recorded",
          entityType: "attendance_records",
          metadata: {
            date: dateOnly.toISOString().slice(0, 10),
            count: updatedRecords.length,
          },
        },
      });

      return {
        date: dateOnly.toISOString().slice(0, 10),
        updatedCount: updatedRecords.length,
      };
    });
  }

  async getMonthlyAttendanceSummary(
    organisationId: string,
    userId: string,
    month: string,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const [yearStr, monthStr] = targetMonth.split("-");
      const year = Number(yearStr);
      const monthNum = Number(monthStr);

      const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
      const endDate = new Date(Date.UTC(year, monthNum, 0));

      // Fetch active students
      const students = await tx.studentProfile.findMany({
        where: { organisationId, status: "ACTIVE" },
        include: { person: { select: { displayName: true, primaryPhone: true } } },
        orderBy: [{ standard: "asc" }, { rollNumber: "asc" }],
      });

      // Fetch attendance in range
      const records = await tx.attendanceRecord.findMany({
        where: {
          organisationId,
          date: { gte: startDate, lte: endDate },
        },
      });

      // Group records by student
      const studentMap = new Map<string, { present: number; absent: number; leave: number }>();
      const distinctDates = new Set<string>();

      for (const rec of records) {
        distinctDates.add(rec.date.toISOString().slice(0, 10));
        const curr = studentMap.get(rec.studentProfileId) || {
          present: 0,
          absent: 0,
          leave: 0,
        };
        if (rec.status === "PRESENT") curr.present++;
        else if (rec.status === "ABSENT") curr.absent++;
        else if (rec.status === "LEAVE") curr.leave++;
        studentMap.set(rec.studentProfileId, curr);
      }

      const totalWorkingDays = distinctDates.size || 1;

      const summary = students.map((std) => {
        const counts = studentMap.get(std.id) || { present: 0, absent: 0, leave: 0 };
        const percentage =
          totalWorkingDays > 0
            ? Math.round((counts.present / totalWorkingDays) * 100)
            : 0;

        return {
          studentProfileId: std.id,
          displayName: std.person.displayName,
          rollNumber: std.rollNumber,
          standard: std.standard,
          batch: std.batch,
          totalWorkingDays,
          presentDays: counts.present,
          absentDays: counts.absent,
          leaveDays: counts.leave,
          percentage,
        };
      });

      return {
        month: targetMonth,
        monthLabel: formatMonthLabel(targetMonth),
        totalWorkingDays,
        students: summary,
      };
    });
  }
}
