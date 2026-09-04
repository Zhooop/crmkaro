import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Environment } from "../config/environment.js";
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

export function formatWhatsAppPhone(rawPhone: string | null | undefined): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/[^0-9]/g, "");
  if (!digits) return "";
  // Strip leading 0 if 11 digits (e.g. 09876543210 -> 9876543210 or 0123456789 -> 123456789)
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  // Standard 10 digit Indian number without country code
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

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

  private async autoSyncStudents(tx: any, organisationId: string) {
    const personStudents = await tx.person.findMany({
      where: {
        organisationId,
        types: { some: { type: "STUDENT" } },
        studentProfile: null,
      },
    });

    for (const p of personStudents) {
      const addressJson = (p.address && typeof p.address === "object" ? p.address : {}) as Record<string, any>;
      try {
        await tx.studentProfile.create({
          data: {
            organisationId,
            personId: p.id,
            status: p.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
            standard: addressJson.standard || "General",
            batch: addressJson.batch || "Regular",
            guardianName: addressJson.guardianName || null,
            rollNumber: addressJson.admissionNo || null,
            admissionDate: addressJson.admissionDate ? new Date(addressJson.admissionDate) : (p.createdAt || new Date()),
          },
        });
      } catch {
        // ignore race
      }
    }
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
      await this.autoSyncStudents(tx, organisationId);
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
            create: [
              {
                organisationId,
                actorUserId: userId,
                action: "student.admitted",
                summary: `Admitted as student in ${input.standard}${input.batch ? ` (${input.batch})` : ""}`,
              },
            ],
          },
        },
      });

      // 2. Generate Roll Number if not supplied
      let roll = input.rollNumber?.trim();
      if (!roll) {
        const nextNum = await this.sequence(tx, organisationId, "student_roll");
        roll = String(1000 + nextNum);
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
      await this.autoSyncStudents(tx, organisationId);
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

      const studentFeeList = await Promise.all(
        students.map(async (std) => {
          const feePlanAmount = std.feeAmountMinor || 0;
          totalExpectedMinor += feePlanAmount;

          const inv = invoiceByPersonId.get(std.personId);
          let status: "PAID" | "PARTIALLY_PAID" | "PENDING" = "PENDING";
          let paidMinor = 0;
          let balanceMinor = feePlanAmount;

          if (inv) {
            // Align grandTotal with expected fee plan
            const expectedTotal = Math.max(feePlanAmount, inv.grandTotalMinor);
            paidMinor = inv.paidTotalMinor;
            balanceMinor = Math.max(0, expectedTotal - paidMinor);

            if (inv.grandTotalMinor < expectedTotal || inv.balanceDueMinor !== balanceMinor) {
              await tx.invoice.update({
                where: { id: inv.id },
                data: {
                  grandTotalMinor: expectedTotal,
                  subtotalMinor: expectedTotal,
                  balanceDueMinor: balanceMinor,
                  status: balanceMinor <= 0 ? "PAID" : "PARTIALLY_PAID",
                },
              });
            }

            if (balanceMinor <= 0 && paidMinor > 0) {
              status = "PAID";
            } else if (paidMinor > 0) {
              status = "PARTIALLY_PAID";
            } else {
              status = "PENDING";
            }
          }

          totalCollectedMinor += paidMinor;
          totalPendingMinor += Math.max(0, balanceMinor);

          const waPhone = formatWhatsAppPhone(std.guardianPhone || std.person.primaryPhone);

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
            whatsappUrl: waPhone
              ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(
                  `Dear Guardian / Student,\nFee payment status for *${std.person.displayName}* (${std.standard}${std.batch ? ` - ${std.batch}` : ""}) for *${monthLabel}*:\n\n💰 *Total Fee Plan:* ₹${(feePlanAmount / 100).toLocaleString("en-IN")}\n💵 *Paid Amount:* ₹${(paidMinor / 100).toLocaleString("en-IN")}\n${balanceMinor > 0 ? `⚠️ *Remaining Balance Due:* ₹${(balanceMinor / 100).toLocaleString("en-IN")}\n📊 *Fee Status:* Partially Paid` : `✅ *Fee Status:* Fully Paid (Cleared)`}${inv?.id && balanceMinor > 0 ? `\n\n💳 *Pay Online (UPI / Card / NetBanking):*\n${(this.config.get("WEB_URL", { infer: true }) || "http://localhost:3000")}/pay/${inv.id}` : ""}`
                )}`
              : null,
          };
        }),
      );

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
      const feePlanAmountMinor = student.feeAmountMinor || 0;
      const amountPaidNowMinor = input.amountMinor || feePlanAmountMinor;
      const expectedTotalMinor = Math.max(feePlanAmountMinor, existingInvoice?.grandTotalMinor || 0, amountPaidNowMinor);

      if (!invoice) {
        // Create new invoice with full monthly fee plan amount
        const invoiceCalc = calculateInvoice([
          {
            quantity: 1,
            unitPriceMinor: expectedTotalMinor,
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
                  unitPriceMinor: expectedTotalMinor,
                  discountMinor: 0,
                  taxRateBps: 0,
                  taxMinor: 0,
                  lineTotalMinor: expectedTotalMinor,
                  position: 1,
                },
              ],
            },
          },
          include: { items: true, payments: true },
        });
      } else if (invoice.grandTotalMinor < expectedTotalMinor) {
        // Update existing invoice to reflect full fee plan
        invoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            grandTotalMinor: expectedTotalMinor,
            subtotalMinor: expectedTotalMinor,
            balanceDueMinor: Math.max(0, expectedTotalMinor - invoice.paidTotalMinor),
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
          amountMinor: amountPaidNowMinor,
          method: input.paymentMethod,
          reference: input.reference || null,
          receivedAt: input.receivedAt || new Date(),
          notes: `Paid for ${monthLabel}. ${input.notes || ""}`.trim(),
          status: "COMPLETED",
        },
      });

      // 3. Update Invoice Paid & Balance Due
      const newPaidTotal = (invoice.paidTotalMinor || 0) + amountPaidNowMinor;
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
          summary: `Fee collected ₹${(amountPaidNowMinor / 100).toFixed(0)} for ${monthLabel} via ${input.paymentMethod} (Receipt: ${receiptNumber}, Balance Due: ₹${(newBalanceDue / 100).toFixed(0)})`,
        },
      });

      // 5. Generate WhatsApp text with accurate balance and status
      const phone = student.guardianPhone || student.person.primaryPhone || "";
      const waPhone = formatWhatsAppPhone(phone);
      const orgName = student.organisation.name || "Academy";
      const remainingText = newBalanceDue > 0
        ? `⚠️ *Remaining Balance Due:* ₹${(newBalanceDue / 100).toLocaleString("en-IN")}\n📊 *Fee Status:* Partially Paid`
        : `✅ *Fee Status:* Paid in Full (Cleared)`;

      const waText = `Dear Guardian / Student,\nFee payment received successfully for *${student.person.displayName}* (${student.standard}${student.batch ? ` - ${student.batch}` : ""}).\n\n📌 *Receipt No:* ${receiptNumber}\n📅 *Billing Cycle:* ${monthLabel}\n💰 *Amount Paid Now:* ₹${(amountPaidNowMinor / 100).toLocaleString("en-IN")}\n💳 *Payment Mode:* ${input.paymentMethod}\n💵 *Total Monthly Fee:* ₹${(invoice.grandTotalMinor / 100).toLocaleString("en-IN")}\n${remainingText}\n\nThank you,\n*${orgName}*`;

      const whatsappUrl = waPhone
        ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(waText)}`
        : null;

      // 6. Send Email Receipt if email is present
      const email = student.person.email;
      let emailSent = false;
      if (email) {
        try {
          await this.sendReceiptEmail({
            to: email,
            studentName: student.person.displayName,
            standard: student.standard || "General",
            batch: student.batch,
            receiptNumber,
            monthLabel,
            amountPaidMinor: amountPaidNowMinor,
            balanceDueMinor: newBalanceDue,
            totalFeeMinor: invoice.grandTotalMinor,
            paymentMethod: input.paymentMethod,
            orgName,
          });
          emailSent = true;
        } catch (e) {
          console.error("Failed to send receipt email:", e);
        }
      }

      return {
        invoice: updatedInvoice,
        payment,
        receiptNumber,
        monthLabel,
        amountPaidMinor: amountPaidNowMinor,
        balanceDueMinor: newBalanceDue,
        totalFeeMinor: invoice.grandTotalMinor,
        emailSent,
        emailTarget: email || null,
        whatsappText: waText,
        whatsappUrl,
      };
    });
  }

  private async sendReceiptEmail({
    to,
    studentName,
    standard,
    batch,
    receiptNumber,
    monthLabel,
    amountPaidMinor,
    balanceDueMinor,
    totalFeeMinor,
    paymentMethod,
    orgName,
  }: {
    to: string;
    studentName: string;
    standard: string;
    batch?: string | null;
    receiptNumber: string;
    monthLabel: string;
    amountPaidMinor: number;
    balanceDueMinor: number;
    totalFeeMinor: number;
    paymentMethod: string;
    orgName: string;
  }) {
    const host = this.config.get("SMTP_HOST", { infer: true });
    const port = this.config.get("SMTP_PORT", { infer: true });
    const from = this.config.get("AUTH_EMAIL_FROM", { infer: true });
    const user = this.config.get("SMTP_USER", { infer: true });
    const password = this.config.get("SMTP_PASSWORD", { infer: true });

    if (!host || !port || !from || !to) return;

    try {
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: this.config.get("SMTP_SECURE", { infer: true }) === "true",
        ...(user && password ? { auth: { user, pass: password } } : {}),
      });

      const paidFormatted = `₹${(amountPaidMinor / 100).toLocaleString("en-IN")}`;
      const balanceFormatted =
        balanceDueMinor > 0
          ? `₹${(balanceDueMinor / 100).toLocaleString("en-IN")}`
          : "₹0 (Cleared)";
      const totalFormatted = `₹${(totalFeeMinor / 100).toLocaleString("en-IN")}`;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #1e293b; margin: 0 0 6px;">${orgName}</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Official Student Fee Payment Receipt</p>
          </div>
          
          <div style="background: #f8fafc; padding: 18px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Receipt Number:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${receiptNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Student Name:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${studentName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Standard / Batch:</td>
                <td style="padding: 6px 0; text-align: right; color: #0f172a;">${standard}${batch ? ` (${batch})` : ""}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Billing Cycle:</td>
                <td style="padding: 6px 0; text-align: right; color: #0f172a;">${monthLabel}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Payment Mode:</td>
                <td style="padding: 6px 0; text-align: right; color: #0f172a;">${paymentMethod}</td>
              </tr>
            </table>
          </div>

          <div style="border-top: 2px dashed #cbd5e1; padding-top: 16px; margin-bottom: 20px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Total Monthly Fee:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${totalFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #166534; font-size: 16px; font-weight: bold;">Amount Paid Now:</td>
                <td style="padding: 6px 0; text-align: right; color: #166534; font-size: 16px; font-weight: bold;">${paidFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: ${balanceDueMinor > 0 ? "#b45309" : "#64748b"}; font-weight: ${balanceDueMinor > 0 ? "bold" : "normal"};">Remaining Balance Due:</td>
                <td style="padding: 6px 0; text-align: right; color: ${balanceDueMinor > 0 ? "#b45309" : "#64748b"}; font-weight: ${balanceDueMinor > 0 ? "bold" : "normal"};">${balanceFormatted}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 24px 0 0;">
            This is a computer-generated fee receipt issued by ${orgName}.
          </p>
        </div>
      `;

      await transport.sendMail({
        from,
        to,
        subject: `Fee Payment Receipt ${receiptNumber} - ${studentName} [${monthLabel}]`,
        text: `Dear Parent/Student,\n\nFee payment of ${paidFormatted} has been recorded for ${studentName} (${monthLabel}).\nReceipt Number: ${receiptNumber}\nRemaining Balance Due: ${balanceFormatted}\n\nThank you,\n${orgName}`,
        html,
      });
    } catch (err) {
      console.error("Failed to send fee receipt email:", err);
    }
  }

  async getAttendance(
    organisationId: string,
    userId: string,
    input: { date: Date; standard?: string; batch?: string },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await this.autoSyncStudents(tx, organisationId);
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
        const existing = recordMap.get(std.id);
        const status: AttendanceStatus = existing?.status ?? "PRESENT";
        const remarks = existing?.remarks ?? "";

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
          remarks,
          recordedAt: existing?.updatedAt ? existing.updatedAt.toISOString() : null,
        };
      });

      const totalStudents = students.length;
      const attendancePercentage =
        totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

      return {
        date: dateOnly.toISOString().slice(0, 10),
        totalStudents,
        presentCount,
        absentCount,
        leaveCount,
        attendancePercentage,
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

      const results = [];

      for (const record of input.records) {
        const student = await tx.studentProfile.findFirst({
          where: { id: record.studentProfileId, organisationId },
        });
        if (!student) continue;

        const row = await tx.attendanceRecord.upsert({
          where: {
            organisationId_studentProfileId_date: {
              organisationId,
              studentProfileId: record.studentProfileId,
              date: dateOnly,
            },
          },
          create: {
            organisationId,
            studentProfileId: record.studentProfileId,
            personId: student.personId,
            date: dateOnly,
            status: record.status as AttendanceStatus,
            remarks: record.remarks?.trim() || null,
            recordedById: userId,
          },
          update: {
            status: record.status as AttendanceStatus,
            remarks: record.remarks?.trim() || null,
            recordedById: userId,
          },
        });
        results.push(row);
      }

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "attendance.batch_recorded",
          entityType: "attendance_record",
          metadata: {
            date: input.date,
            count: results.length,
          },
        },
      });

      return {
        date: dateOnly.toISOString().slice(0, 10),
        savedCount: results.length,
      };
    });
  }

  async getMonthlyAttendanceSummary(
    organisationId: string,
    userId: string,
    month: string,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await this.autoSyncStudents(tx, organisationId);
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const monthLabel = formatMonthLabel(targetMonth);

      const [yearStr, monthStr] = targetMonth.split("-");
      const year = Number(yearStr);
      const monthIdx = Number(monthStr) - 1;

      const startDate = new Date(year, monthIdx, 1);
      const endDate = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);

      // Fetch all active students
      const students = await tx.studentProfile.findMany({
        where: {
          organisationId,
          status: "ACTIVE",
        },
        orderBy: [{ standard: "asc" }, { rollNumber: "asc" }],
        include: {
          person: {
            select: { displayName: true },
          },
        },
      });

      // Fetch all attendance records in this month range
      const records = await tx.attendanceRecord.findMany({
        where: {
          organisationId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Group records by student
      const recordsByStudent = new Map<string, typeof records>();
      const distinctWorkingDates = new Set<string>();

      for (const rec of records) {
        const dateKey = rec.date.toISOString().slice(0, 10);
        distinctWorkingDates.add(dateKey);

        const list = recordsByStudent.get(rec.studentProfileId) || [];
        list.push(rec);
        recordsByStudent.set(rec.studentProfileId, list);
      }

      const totalWorkingDays = distinctWorkingDates.size;

      const summaryList = students.map((std) => {
        const studentRecords = recordsByStudent.get(std.id) || [];
        let presentDays = 0;
        let absentDays = 0;
        let leaveDays = 0;

        for (const r of studentRecords) {
          if (r.status === "PRESENT") presentDays++;
          else if (r.status === "ABSENT") absentDays++;
          else if (r.status === "LEAVE") leaveDays++;
        }

        const studentTotal = presentDays + absentDays + leaveDays;
        const denominator = studentTotal > 0 ? studentTotal : totalWorkingDays;
        const percentage = denominator > 0 ? Math.round((presentDays / denominator) * 100) : 0;

        return {
          studentProfileId: std.id,
          displayName: std.person.displayName,
          rollNumber: std.rollNumber,
          standard: std.standard,
          batch: std.batch,
          totalWorkingDays: denominator,
          presentDays,
          absentDays,
          leaveDays,
          percentage,
        };
      });

      return {
        month: targetMonth,
        monthLabel,
        totalWorkingDays,
        students: summaryList,
      };
    });
  }
}
