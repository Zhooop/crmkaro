import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient, Prisma } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import PDFDocument from "pdfkit";
import { DATABASE } from "../database/database.module.js";
import type { InvoiceInput, PaymentInput, UpdateInvoiceInput } from "./finance.schemas.js";
import { calculateInvoice, formatMoney } from "./finance.utils.js";
import { CRMKARO_LOGO_BASE64 } from "./crmkaro-logo.base64.js";

const invoiceInclude = {
  person: true,
  items: { orderBy: { position: "asc" as const } },
  payments: {
    orderBy: { receivedAt: "desc" as const },
    include: { refunds: true },
  },
} as const;
@Injectable()
export class FinanceService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}
  private async sequence(
    tx: Prisma.TransactionClient,
    organisationId: string,
    code: string,
  ) {
    const sequence = await tx.organisationSequence.upsert({
      where: { organisationId_code: { organisationId, code } },
      update: { currentValue: { increment: 1 } },
      create: { organisationId, code, currentValue: 1 },
    });
    return sequence.currentValue;
  }
  private async invoice(
    tx: Prisma.TransactionClient,
    organisationId: string,
    id: string,
  ) {
    const invoice = await tx.invoice.findFirst({
      where: { id, organisationId },
      include: invoiceInclude,
    });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    return invoice;
  }

  listInvoices(
    organisationId: string,
    userId: string,
    input: {
      status?: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
      personId?: string;
      cursor?: string;
      limit: number;
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const rows = await tx.invoice.findMany({
        where: {
          organisationId,
          status: input.status,
          personId: input.personId,
        },
        include: {
          person: { select: { id: true, displayName: true, email: true, primaryPhone: true } },
          items: { orderBy: { position: "asc" as const } },
          payments: {
            orderBy: { receivedAt: "desc" as const },
            include: { refunds: true },
          },
        },
        orderBy: [{ issueDate: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const more = rows.length > input.limit,
        items = more ? rows.slice(0, input.limit) : rows;
      const today = new Date();
      return {
        items: items.map((invoice) => ({
          ...invoice,
          overdue:
            invoice.balanceDueMinor > 0 &&
            invoice.dueDate < today &&
            !["DRAFT", "VOID"].includes(invoice.status),
        })),
        nextCursor: more ? (items.at(-1)?.id ?? null) : null,
      };
    });
  }
  getInvoice(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, (tx) =>
      this.invoice(tx, organisationId, id),
    );
  }
  createInvoice(organisationId: string, userId: string, input: InvoiceInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: input.personId, organisationId, status: "ACTIVE" },
      });
      if (!person) throw new BadRequestException("Customer not found.");
      let totals;
      try {
        totals = calculateInvoice(input.items);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
      const number = await this.sequence(tx, organisationId, "invoice");
      const invoiceNumber = `INV-${String(number).padStart(6, "0")}`;
      const invoice = await tx.invoice.create({
        data: {
          organisationId,
          personId: input.personId,
          invoiceNumber,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: input.currency,
          notes: input.notes,
          subtotalMinor: totals.subtotalMinor,
          discountMinor: totals.discountMinor,
          taxMinor: totals.taxMinor,
          grandTotalMinor: totals.grandTotalMinor,
          balanceDueMinor: totals.grandTotalMinor,
          items: {
            create: totals.lines.map((line, index) => ({
              organisationId,
              description: input.items[index]!.description,
              quantity: input.items[index]!.quantity,
              unitPriceMinor: line.unitPriceMinor,
              discountMinor: line.discountMinor,
              taxRateBps: line.taxRateBps,
              taxMinor: line.taxMinor,
              lineTotalMinor: line.lineTotalMinor,
              position: index + 1,
            })),
          },
        },
        include: invoiceInclude,
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "invoice.created",
          entityType: "invoice",
          entityId: invoice.id,
          metadata: { invoiceNumber, grandTotalMinor: totals.grandTotalMinor },
        },
      });
      return invoice;
    });
  }

  updateInvoice(
    organisationId: string,
    userId: string,
    id: string,
    input: UpdateInvoiceInput,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const invoice = await this.invoice(tx, organisationId, id);
      if (invoice.status === "VOID") {
        throw new ConflictException("Voided invoices cannot be edited.");
      }
      if (invoice.status !== "DRAFT" && input.items) {
        if (invoice.paidTotalMinor > 0) {
          throw new ConflictException(
            "Invoices with recorded payments cannot have items modified.",
          );
        }
      }

      if (input.personId && input.personId !== invoice.personId) {
        const person = await tx.person.findFirst({
          where: { id: input.personId, organisationId, status: "ACTIVE" },
        });
        if (!person) throw new BadRequestException("Customer not found.");
      }

      let totalsUpdate: {
        subtotalMinor?: number;
        discountMinor?: number;
        taxMinor?: number;
        grandTotalMinor?: number;
        balanceDueMinor?: number;
      } = {};

      if (input.items && input.items.length > 0) {
        let totals;
        try {
          totals = calculateInvoice(input.items);
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }

        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id, organisationId },
        });

        await tx.invoiceItem.createMany({
          data: totals.lines.map((line, index) => ({
            organisationId,
            invoiceId: id,
            description: input.items![index]!.description,
            quantity: input.items![index]!.quantity,
            unitPriceMinor: line.unitPriceMinor,
            discountMinor: line.discountMinor,
            taxRateBps: line.taxRateBps,
            taxMinor: line.taxMinor,
            lineTotalMinor: line.lineTotalMinor,
            position: index + 1,
          })),
        });

        totalsUpdate = {
          subtotalMinor: totals.subtotalMinor,
          discountMinor: totals.discountMinor,
          taxMinor: totals.taxMinor,
          grandTotalMinor: totals.grandTotalMinor,
          balanceDueMinor: Math.max(0, totals.grandTotalMinor - invoice.paidTotalMinor),
        };
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          ...(input.personId ? { personId: input.personId } : {}),
          ...(input.issueDate ? { issueDate: input.issueDate } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate || invoice.dueDate } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...totalsUpdate,
        },
        include: invoiceInclude,
      });

      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "invoice.updated",
          entityType: "invoice",
          entityId: id,
          metadata: { invoiceNumber: invoice.invoiceNumber, ...totalsUpdate },
        },
      });

      return updated;
    });
  }
  issueInvoice(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const invoice = await this.invoice(tx, organisationId, id);
      if (invoice.status !== "DRAFT")
        throw new ConflictException("Only draft invoices can be issued.");
      const issued = await tx.invoice.update({
        where: { id },
        data: { status: "ISSUED", issuedAt: new Date() },
        include: invoiceInclude,
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "invoice.issued",
          entityType: "invoice",
          entityId: id,
        },
      });
      return issued;
    });
  }
  voidInvoice(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const invoice = await this.invoice(tx, organisationId, id);
      if (invoice.paidTotalMinor > 0)
        throw new ConflictException(
          "An invoice with payments cannot be voided.",
        );
      const result = await tx.invoice.update({
        where: { id },
        data: { status: "VOID", voidedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "invoice.voided",
          entityType: "invoice",
          entityId: id,
        },
      });
      return result;
    });
  }

  listPayments(organisationId: string, userId: string, personId?: string) {
    return withTenant(this.database, organisationId, userId, (tx) =>
      tx.payment.findMany({
        where: { organisationId, personId },
        orderBy: { receivedAt: "desc" },
        include: {
          person: { select: { id: true, displayName: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          refunds: true,
        },
      }),
    );
  }
  createPayment(organisationId: string, userId: string, input: PaymentInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: input.personId, organisationId, status: "ACTIVE" },
      });
      if (!person) throw new BadRequestException("Customer not found.");
      if (input.invoiceId) {
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId}::uuid AND organisation_id = ${organisationId}::uuid FOR UPDATE`;
      }
      const invoice = input.invoiceId
        ? await this.invoice(tx, organisationId, input.invoiceId)
        : null;
      if (invoice && invoice.personId !== input.personId)
        throw new BadRequestException(
          "Invoice does not belong to this customer.",
        );
      if (invoice && ["VOID", "PAID"].includes(invoice.status))
        throw new ConflictException("Invoice is already settled or void.");
      if (
        invoice &&
        !["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status)
      )
        throw new ConflictException("Invoice is not payable.");
      if (invoice && input.amountMinor > invoice.balanceDueMinor)
        throw new BadRequestException("Payment exceeds the invoice balance.");
      const number = await this.sequence(tx, organisationId, "receipt");
      const payment = await tx.payment.create({
        data: {
          organisationId,
          ...input,
          recordedById: userId,
          receiptNumber: `REC-${String(number).padStart(6, "0")}`,
        },
        include: { invoice: true, person: true },
      });
      if (invoice) {
        const paidTotalMinor = (invoice.paidTotalMinor || 0) + input.amountMinor;
        const balanceDueMinor = Math.max(0, invoice.grandTotalMinor - paidTotalMinor);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidTotalMinor,
            balanceDueMinor,
            status: balanceDueMinor === 0 ? "PAID" : "PARTIALLY_PAID",
          },
        });
      }
      await tx.personActivity.create({
        data: {
          organisationId,
          personId: input.personId,
          actorUserId: userId,
          action: "payment.received",
          summary: `Payment ${payment.receiptNumber} received`,
          metadata: { paymentId: payment.id, amountMinor: input.amountMinor },
        },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "payment.received",
          entityType: "payment",
          entityId: payment.id,
          metadata: { amountMinor: input.amountMinor },
        },
      });
      return payment;
    });
  }
  refundPayment(
    organisationId: string,
    userId: string,
    paymentId: string,
    input: { amountMinor: number; reason: string },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId}::uuid AND organisation_id = ${organisationId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organisationId },
      });
      if (!payment) throw new NotFoundException("Payment not found.");
      const available = payment.amountMinor - payment.refundedMinor;
      if (input.amountMinor > available)
        throw new BadRequestException(
          "Refund exceeds the refundable payment amount.",
        );
      const refundedMinor = payment.refundedMinor + input.amountMinor;
      const refund = await tx.paymentRefund.create({
        data: { organisationId, paymentId, issuedById: userId, ...input },
      });
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          refundedMinor,
          status:
            refundedMinor === payment.amountMinor
              ? "REFUNDED"
              : "PARTIALLY_REFUNDED",
        },
      });
      if (payment.invoiceId) {
        const invoice = await this.invoice(
          tx,
          organisationId,
          payment.invoiceId,
        );
        const paidTotalMinor = Math.max(
            0,
            invoice.paidTotalMinor - input.amountMinor,
          ),
          balanceDueMinor = invoice.grandTotalMinor - paidTotalMinor;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidTotalMinor,
            balanceDueMinor,
            status: paidTotalMinor === 0 ? "ISSUED" : "PARTIALLY_PAID",
          },
        });
      }
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "payment.refunded",
          entityType: "payment",
          entityId: paymentId,
          metadata: { refundId: refund.id, amountMinor: input.amountMinor },
        },
      });
      return refund;
    });
  }

  listExpenses(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, (tx) =>
      tx.expense.findMany({
        where: { organisationId },
        orderBy: { expenseDate: "desc" },
      }),
    );
  }
  createExpense(
    organisationId: string,
    userId: string,
    input: {
      category: string;
      vendor?: string | null;
      description: string;
      amountMinor: number;
      currency: string;
      expenseDate: Date;
      reference?: string | null;
    },
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const expense = await tx.expense.create({
        data: { organisationId, recordedById: userId, ...input },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "expense.recorded",
          entityType: "expense",
          entityId: expense.id,
          metadata: { amountMinor: input.amountMinor },
        },
      });
      return expense;
    });
  }
  voidExpense(organisationId: string, userId: string, id: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id, organisationId },
      });
      if (!expense) throw new NotFoundException("Expense not found.");
      if (expense.status === "VOID")
        throw new ConflictException("Expense is already void.");
      const result = await tx.expense.update({
        where: { id },
        data: { status: "VOID", voidedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "expense.voided",
          entityType: "expense",
          entityId: id,
        },
      });
      return result;
    });
  }

  report(organisationId: string, userId: string, from: Date, to: Date) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const invoices = await tx.invoice.aggregate({
        where: {
          organisationId,
          issueDate: { gte: from, lte: to },
          status: { not: "VOID" },
        },
        _sum: {
          grandTotalMinor: true,
          paidTotalMinor: true,
          balanceDueMinor: true,
        },
        _count: true,
      });
      const payments = await tx.payment.aggregate({
        where: { organisationId, receivedAt: { gte: from, lte: to } },
        _sum: { amountMinor: true, refundedMinor: true },
        _count: true,
      });
      const expenses = await tx.expense.aggregate({
        where: {
          organisationId,
          expenseDate: { gte: from, lte: to },
          status: "RECORDED",
        },
        _sum: { amountMinor: true },
        _count: true,
      });
      const revenueMinor =
          (payments._sum.amountMinor ?? 0) - (payments._sum.refundedMinor ?? 0),
        expenseMinor = expenses._sum.amountMinor ?? 0;
      return {
        from,
        to,
        invoices: {
          count: invoices._count,
          billedMinor: invoices._sum.grandTotalMinor ?? 0,
          paidMinor: invoices._sum.paidTotalMinor ?? 0,
          dueMinor: invoices._sum.balanceDueMinor ?? 0,
        },
        payments: { count: payments._count, netReceivedMinor: revenueMinor },
        expenses: { count: expenses._count, totalMinor: expenseMinor },
        netCashMinor: revenueMinor - expenseMinor,
      };
    });
  }

  async invoicePdf(organisationId: string, userId: string, id: string) {
    const invoice = await this.getInvoice(organisationId, userId, id);
    const organisation = await withTenant(
      this.database,
      organisationId,
      userId,
      (tx) => tx.organisation.findUnique({ where: { id: organisationId } }),
    );
    if (!organisation) throw new NotFoundException("Organisation not found.");

    const clean = (val: string | null | undefined): string => {
      if (!val) return "";
      return val
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, "")
        .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    const money = (amountMinor: number, currency = "INR"): string => {
      const amountStr = (amountMinor / 100).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const code = (currency || "INR").toUpperCase();
      if (code === "INR") return `Rs. ${amountStr}`;
      if (code === "USD") return `$${amountStr}`;
      if (code === "EUR") return `EUR ${amountStr}`;
      if (code === "GBP") return `GBP ${amountStr}`;
      return `${code} ${amountStr}`;
    };

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Top decorative primary brand bar
      doc.rect(0, 0, 595.28, 5).fill("#2563eb");

      const startY = 36;
      let hasCustomLogo = false;

      const orgLogo = (organisation as any).logoUrl;
      if (orgLogo) {
        try {
          let imgBuffer: Buffer | null = null;
          if (typeof orgLogo === "string" && orgLogo.startsWith("data:image")) {
            const base64Data = orgLogo.split(",")[1];
            if (base64Data) imgBuffer = Buffer.from(base64Data, "base64");
          }
          if (imgBuffer) {
            doc.image(imgBuffer, 40, startY, { fit: [130, 46] });
            hasCustomLogo = true;
          }
        } catch {
          hasCustomLogo = false;
        }
      }

      if (!hasCustomLogo) {
        // Render monogram badge + Business Name
        const orgInitial = (organisation.name || "C").charAt(0).toUpperCase();
        doc.roundedRect(40, startY, 36, 36, 7).fill("#2563eb");
        doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text(orgInitial, 40, startY + 8, { width: 36, align: "center" });

        doc.fillColor("#0f172a").fontSize(16).font("Helvetica-Bold").text(clean(organisation.name), 86, startY + 2, { width: 230 });
        doc.fillColor("#64748b").fontSize(9).font("Helvetica").text(clean(organisation.businessType || "Business Enterprise"), 86, startY + 22);
      } else {
        doc.fillColor("#0f172a").fontSize(14).font("Helvetica-Bold").text(clean(organisation.name), 180, startY + 6, { width: 150 });
      }

      // Top Right: INVOICE Title, Number, Status Pill
      doc.fillColor("#0f172a").fontSize(22).font("Helvetica-Bold").text("TAX INVOICE", 340, startY, { width: 215, align: "right" });
      doc.fillColor("#2563eb").fontSize(11).font("Helvetica-Bold").text(invoice.invoiceNumber, 340, startY + 25, { width: 215, align: "right" });

      // Status Pill
      const isPaid = invoice.balanceDueMinor <= 0 && invoice.paidTotalMinor > 0;
      const isPartial = invoice.paidTotalMinor > 0 && invoice.balanceDueMinor > 0;
      const statusText = isPaid ? "PAID IN FULL" : isPartial ? "PARTIALLY PAID" : "PAYMENT DUE";
      const statusBg = isPaid ? "#ecfdf5" : isPartial ? "#fffbeb" : "#fef2f2";
      const statusBorder = isPaid ? "#a7f3d0" : isPartial ? "#fde68a" : "#fecaca";
      const statusColor = isPaid ? "#065f46" : isPartial ? "#92400e" : "#991b1b";

      doc.roundedRect(455, startY + 44, 100, 18, 9).fillAndStroke(statusBg, statusBorder);
      doc.fillColor(statusColor).fontSize(7.5).font("Helvetica-Bold").text(statusText, 455, startY + 49, { width: 100, align: "center" });

      // Divider Line
      doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(40, 108).lineTo(555, 108).stroke();

      // Info Cards: Billed To & Invoice Meta
      const cardY = 118;
      const cardHeight = 74;

      // Card 1: Billed To
      doc.roundedRect(40, cardY, 250, cardHeight, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#64748b").fontSize(8).font("Helvetica-Bold").text("BILLED TO / CUSTOMER", 52, cardY + 9);
      doc.fillColor("#0f172a").fontSize(10.5).font("Helvetica-Bold").text(clean(invoice.person.displayName), 52, cardY + 22, { width: 226 });
      if (invoice.person.primaryPhone) {
        doc.fillColor("#334155").fontSize(8.5).font("Helvetica").text(`Phone: ${clean(invoice.person.primaryPhone)}`, 52, cardY + 38);
      }
      if (invoice.person.email) {
        doc.fillColor("#334155").fontSize(8.5).font("Helvetica").text(`Email: ${clean(invoice.person.email)}`, 52, cardY + (invoice.person.primaryPhone ? 51 : 38), { width: 226 });
      }

      // Card 2: Invoice Details
      doc.roundedRect(305, cardY, 250, cardHeight, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#64748b").fontSize(8).font("Helvetica-Bold").text("INVOICE DETAILS", 317, cardY + 9);

      doc.fillColor("#64748b").fontSize(8.5).font("Helvetica").text("Issue Date:", 317, cardY + 23);
      doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold").text(invoice.issueDate.toISOString().slice(0, 10), 385, cardY + 23);

      doc.fillColor("#64748b").fontSize(8.5).font("Helvetica").text("Due Date:", 317, cardY + 37);
      doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold").text(invoice.dueDate.toISOString().slice(0, 10), 385, cardY + 37);

      doc.fillColor("#64748b").fontSize(8.5).font("Helvetica").text("Currency:", 317, cardY + 51);
      doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold").text(`${invoice.currency} (Indian Rupee)`, 385, cardY + 51);

      // Line Items Table
      const tableY = 206;
      doc.roundedRect(40, tableY, 515, 22, 4).fill("#0f172a");

      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
      doc.text("#", 48, tableY + 6, { width: 20 });
      doc.text("ITEM & DESCRIPTION", 75, tableY + 6, { width: 250 });
      doc.text("QTY", 330, tableY + 6, { width: 35, align: "center" });
      doc.text("RATE", 370, tableY + 6, { width: 85, align: "right" });
      doc.text("AMOUNT", 460, tableY + 6, { width: 85, align: "right" });

      let currentY = tableY + 26;

      invoice.items.forEach((item, index) => {
        const isOdd = index % 2 === 1;
        if (isOdd) {
          doc.rect(40, currentY - 3, 515, 22).fill("#f8fafc");
        }

        doc.fillColor("#64748b").fontSize(8.5).font("Helvetica").text((index + 1).toString(), 48, currentY);
        doc.fillColor("#0f172a").fontSize(9).font("Helvetica-Bold").text(clean(item.description), 75, currentY, { width: 250 });
        doc.fillColor("#334155").fontSize(8.5).font("Helvetica").text(item.quantity.toString(), 330, currentY, { width: 35, align: "center" });
        doc.fillColor("#334155").fontSize(8.5).font("Helvetica").text(money(item.unitPriceMinor, invoice.currency), 370, currentY, { width: 85, align: "right" });
        doc.fillColor("#0f172a").fontSize(9).font("Helvetica-Bold").text(money(item.lineTotalMinor, invoice.currency), 460, currentY, { width: 85, align: "right" });

        doc.strokeColor("#f1f5f9").lineWidth(0.8).moveTo(40, currentY + 18).lineTo(555, currentY + 18).stroke();
        currentY += 23;
      });

      // Summary & Totals Breakdown Card
      const totalsY = Math.max(currentY + 15, 340);
      const summaryWidth = 230;
      const summaryX = 325;

      doc.roundedRect(summaryX, totalsY, summaryWidth, 110, 6).fillAndStroke("#f8fafc", "#e2e8f0");

      doc.fillColor("#64748b").fontSize(8.5).font("Helvetica").text("Subtotal", summaryX + 12, totalsY + 10);
      doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold").text(money(invoice.subtotalMinor, invoice.currency), summaryX + 100, totalsY + 10, { width: 118, align: "right" });

      if (invoice.discountMinor > 0) {
        doc.fillColor("#64748b").fontSize(8.5).font("Helvetica").text("Discount", summaryX + 12, totalsY + 24);
        doc.fillColor("#059669").fontSize(8.5).font("Helvetica-Bold").text(`- ${money(invoice.discountMinor, invoice.currency)}`, summaryX + 100, totalsY + 24, { width: 118, align: "right" });
      }

      if (invoice.taxMinor > 0) {
        doc.fillColor("#64748b").fontSize(8.5).font("Helvetica").text("Tax / GST", summaryX + 12, totalsY + 38);
        doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold").text(money(invoice.taxMinor, invoice.currency), summaryX + 100, totalsY + 38, { width: 118, align: "right" });
      }

      doc.strokeColor("#cbd5e1").lineWidth(0.8).moveTo(summaryX + 10, totalsY + 54).lineTo(summaryX + summaryWidth - 10, totalsY + 54).stroke();

      doc.fillColor("#0f172a").fontSize(10.5).font("Helvetica-Bold").text("Grand Total", summaryX + 12, totalsY + 60);
      doc.fillColor("#2563eb").fontSize(10.5).font("Helvetica-Bold").text(money(invoice.grandTotalMinor, invoice.currency), summaryX + 100, totalsY + 60, { width: 118, align: "right" });

      doc.fillColor("#059669").fontSize(9).font("Helvetica-Bold").text("Amount Paid", summaryX + 12, totalsY + 76);
      doc.fillColor("#059669").fontSize(9).font("Helvetica-Bold").text(money(invoice.paidTotalMinor, invoice.currency), summaryX + 100, totalsY + 76, { width: 118, align: "right" });

      const dueColor = invoice.balanceDueMinor > 0 ? "#dc2626" : "#059669";
      doc.fillColor(dueColor).fontSize(10).font("Helvetica-Bold").text("Balance Due", summaryX + 12, totalsY + 92);
      doc.fillColor(dueColor).fontSize(10).font("Helvetica-Bold").text(money(invoice.balanceDueMinor, invoice.currency), summaryX + 100, totalsY + 92, { width: 118, align: "right" });

      // Left Box: Recorded Payment Receipts
      if (invoice.payments && invoice.payments.length > 0) {
        const payBoxX = 40;
        const payBoxWidth = 265;
        doc.roundedRect(payBoxX, totalsY, payBoxWidth, 110, 6).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor("#0f172a").fontSize(8).font("Helvetica-Bold").text("PAYMENT RECEIPTS RECORDED", payBoxX + 12, totalsY + 10);

        let pY = totalsY + 26;
        invoice.payments.slice(0, 3).forEach((p) => {
          doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text(p.receiptNumber, payBoxX + 12, pY);
          doc.fillColor("#64748b").fontSize(7.5).font("Helvetica").text(p.receivedAt.toISOString().slice(0, 10), payBoxX + 90, pY);
          doc.fillColor("#059669").fontSize(8).font("Helvetica-Bold").text(money(p.amountMinor, invoice.currency), payBoxX + 170, pY, { width: 85, align: "right" });
          pY += 16;
        });
      } else if (invoice.notes) {
        const notesBoxX = 40;
        const notesBoxWidth = 265;
        doc.roundedRect(notesBoxX, totalsY, notesBoxWidth, 110, 6).fillAndStroke("#f8fafc", "#e2e8f0");
        doc.fillColor("#0f172a").fontSize(8).font("Helvetica-Bold").text("INVOICE NOTES / TERMS", notesBoxX + 12, totalsY + 10);
        doc.fillColor("#475569").fontSize(8).font("Helvetica").text(clean(invoice.notes), notesBoxX + 12, totalsY + 26, { width: notesBoxWidth - 24, height: 75 });
      }

      // Footer
      const footerY = 760;
      doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(40, footerY).lineTo(555, footerY).stroke();

      // Left footer
      doc.fillColor("#64748b").fontSize(8).font("Helvetica").text(`Thank you for your business! · ${clean(organisation.name)}`, 40, footerY + 10, { width: 280 });
      doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text("This is an electronically generated tax invoice and is valid without a physical signature.", 40, footerY + 22, { width: 300 });

      // Right footer with CRMKaro Logo & branding badge
      const badgeX = 390;
      const badgeY = footerY + 6;
      doc.roundedRect(badgeX, badgeY, 165, 26, 6).fillAndStroke("#f8fafc", "#e2e8f0");

      try {
        const crmLogoBuffer = Buffer.from(CRMKARO_LOGO_BASE64, "base64");
        doc.image(crmLogoBuffer, badgeX + 8, badgeY + 4, { fit: [18, 18] });
      } catch {}

      doc.fillColor("#2563eb").fontSize(8).font("Helvetica-Bold").text("Powered by CRMKaro", badgeX + 32, badgeY + 5);
      doc.fillColor("#64748b").fontSize(6.5).font("Helvetica").text("crmkaro.com · Cloud CRM", badgeX + 32, badgeY + 15);

      doc.end();
    });
  }
}
