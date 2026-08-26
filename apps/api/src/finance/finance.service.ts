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
import type { InvoiceInput, PaymentInput } from "./finance.schemas.js";
import { calculateInvoice, formatMoney } from "./finance.utils.js";

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
          person: { select: { id: true, displayName: true, email: true } },
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
      if (invoice && !["ISSUED", "PARTIALLY_PAID"].includes(invoice.status))
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
        const paidTotalMinor = invoice.paidTotalMinor + input.amountMinor,
          balanceDueMinor = invoice.grandTotalMinor - paidTotalMinor;
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
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: "A4" }),
        chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.fontSize(20).fillColor("#2457D6").text(organisation.name);
      doc.fillColor("#111827").fontSize(24).text("INVOICE", { align: "right" });
      doc
        .fontSize(10)
        .text(invoice.invoiceNumber, { align: "right" })
        .moveDown();
      doc
        .fontSize(11)
        .text(`Bill to: ${invoice.person.displayName}`)
        .text(invoice.person.email ?? "")
        .moveDown()
        .text(`Issue date: ${invoice.issueDate.toISOString().slice(0, 10)}`)
        .text(`Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`)
        .moveDown();
      for (const item of invoice.items)
        doc.text(
          `${item.description}  × ${item.quantity.toString()}   ${formatMoney(item.lineTotalMinor, invoice.currency)}`,
        );
      doc
        .moveDown()
        .fontSize(12)
        .text(
          `Subtotal: ${formatMoney(invoice.subtotalMinor, invoice.currency)}`,
          { align: "right" },
        )
        .text(
          `Discount: ${formatMoney(invoice.discountMinor, invoice.currency)}`,
          { align: "right" },
        )
        .text(`Tax: ${formatMoney(invoice.taxMinor, invoice.currency)}`, {
          align: "right",
        })
        .fontSize(14)
        .text(
          `Total: ${formatMoney(invoice.grandTotalMinor, invoice.currency)}`,
          { align: "right" },
        )
        .text(
          `Balance due: ${formatMoney(invoice.balanceDueMinor, invoice.currency)}`,
          { align: "right" },
        );
      doc.end();
    });
  }
}
