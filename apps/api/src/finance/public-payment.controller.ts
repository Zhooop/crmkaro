import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withPlatformAdmin } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import { RazorpayService } from "./razorpay.service.js";

@Controller("public/invoices")
export class PublicPaymentController {
  private readonly logger = new Logger(PublicPaymentController.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    @Inject(RazorpayService) private readonly razorpay: RazorpayService,
  ) {}

  /**
   * Public invoice preview details for customer checkout page.
   */
  @Get(":id")
  async getPublicInvoice(@Param("id", ParseUUIDPipe) id: string) {
    const invoice = await withPlatformAdmin(this.database, async (tx) => {
      return tx.invoice.findUnique({
        where: { id },
        include: {
          organisation: {
            select: {
              id: true,
              name: true,
              businessType: true,
              currency: true,
              timezone: true,
            },
          },
          person: {
            select: {
              id: true,
              displayName: true,
              primaryPhone: true,
              email: true,
            },
          },
          items: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPriceMinor: true,
              discountMinor: true,
              taxMinor: true,
              lineTotalMinor: true,
            },
          },
          payments: {
            where: { status: "COMPLETED" },
            orderBy: { receivedAt: "desc" },
            take: 1,
            select: {
              receiptNumber: true,
              amountMinor: true,
              method: true,
              receivedAt: true,
              reference: true,
            },
          },
        },
      });
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found or expired.");
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      currency: invoice.currency,
      notes: invoice.notes,
      subtotalMinor: invoice.subtotalMinor,
      discountMinor: invoice.discountMinor,
      taxMinor: invoice.taxMinor,
      grandTotalMinor: invoice.grandTotalMinor,
      paidTotalMinor: invoice.paidTotalMinor,
      balanceDueMinor: invoice.balanceDueMinor,
      organisation: invoice.organisation,
      customer: invoice.person,
      items: invoice.items,
      latestReceipt: invoice.payments[0] || null,
      razorpayKeyId: this.razorpay.getKeyId(),
    };
  }

  /**
   * Generates a Razorpay Order ID for the balance due amount.
   */
  @Post(":id/create-razorpay-order")
  async createRazorpayOrder(@Param("id", ParseUUIDPipe) id: string) {
    const invoice = await withPlatformAdmin(this.database, async (tx) => {
      return tx.invoice.findUnique({
        where: { id },
        include: {
          organisation: true,
          person: true,
        },
      });
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }

    if (invoice.status === "PAID" || invoice.balanceDueMinor <= 0) {
      throw new BadRequestException("Invoice is already fully paid.");
    }

    if (invoice.status === "VOID") {
      throw new BadRequestException("This invoice has been voided.");
    }

    const order = await this.razorpay.createOrder({
      amountMinor: invoice.balanceDueMinor,
      currency: invoice.currency || "INR",
      receipt: invoice.invoiceNumber,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.person.displayName,
        organisationId: invoice.organisationId,
      },
    });

    return {
      orderId: order.id,
      amountMinor: order.amount,
      currency: order.currency,
      keyId: this.razorpay.getKeyId(),
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.person.displayName,
      customerPhone: invoice.person.primaryPhone,
      customerEmail: invoice.person.email,
      organisationName: invoice.organisation.name,
    };
  }

  /**
   * Verifies Razorpay payment signature and automatically marks the invoice as PAID.
   */
  @Post(":id/verify-payment")
  async verifyPayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body()
    body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new BadRequestException("Missing Razorpay payment verification parameters.");
    }

    const isValid = this.razorpay.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!isValid) {
      this.logger.error(
        `Invalid payment signature for order ${razorpayOrderId}, payment ${razorpayPaymentId}`,
      );
      throw new BadRequestException("Payment verification failed. Invalid cryptographic signature.");
    }

    // Process payment in a transaction with row lock
    const result = await withPlatformAdmin(this.database, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { organisation: true, person: true },
      });

      if (!invoice) {
        throw new NotFoundException("Invoice not found.");
      }

      await tx.$executeRaw`SELECT set_config('app.current_organisation_id', ${invoice.organisationId}, true)`;

      // Check if already paid with this exact payment id
      const existingPayment = await tx.payment.findFirst({
        where: {
          organisationId: invoice.organisationId,
          reference: razorpayPaymentId,
        },
      });

      if (existingPayment) {
        return {
          status: "already_recorded",
          receiptNumber: existingPayment.receiptNumber,
          amountPaidMinor: existingPayment.amountMinor,
          invoiceNumber: invoice.invoiceNumber,
        };
      }

      // Generate sequence number for receipt
      const sequence = await tx.organisationSequence.upsert({
        where: {
          organisationId_code: {
            organisationId: invoice.organisationId,
            code: "receipt",
          },
        },
        create: {
          organisationId: invoice.organisationId,
          code: "receipt",
          currentValue: 1,
        },
        update: { currentValue: { increment: 1 } },
      });

      const receiptNumber = `REC-${String(sequence.currentValue).padStart(6, "0")}`;
      const amountPaidMinor = invoice.balanceDueMinor;

      // Create Payment record
      const payment = await tx.payment.create({
        data: {
          organisationId: invoice.organisationId,
          invoiceId: invoice.id,
          personId: invoice.personId,
          receiptNumber,
          amountMinor: amountPaidMinor,
          method: "RAZORPAY_ONLINE",
          reference: razorpayPaymentId,
          status: "COMPLETED",
          receivedAt: new Date(),
          notes: `Paid online via Razorpay (Order: ${razorpayOrderId})`,
        },
      });

      // Update invoice status to PAID
      const newPaidTotal = invoice.paidTotalMinor + amountPaidMinor;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidTotalMinor: newPaidTotal,
          balanceDueMinor: 0,
          status: "PAID",
        },
      });

      // Log person activity & audit log
      await tx.personActivity.create({
        data: {
          organisationId: invoice.organisationId,
          personId: invoice.personId,
          action: "payment.received",
          summary: `Online payment ${receiptNumber} of ₹${(amountPaidMinor / 100).toFixed(0)} received via Razorpay`,
          metadata: {
            paymentId: payment.id,
            amountMinor: amountPaidMinor,
            razorpayPaymentId,
            razorpayOrderId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organisationId: invoice.organisationId,
          action: "payment.received.online",
          entityType: "payment",
          entityId: payment.id,
          metadata: {
            invoiceId: invoice.id,
            receiptNumber,
            amountMinor: amountPaidMinor,
            razorpayPaymentId,
          },
        },
      });

      return {
        status: "success",
        receiptNumber,
        amountPaidMinor,
        invoiceNumber: invoice.invoiceNumber,
      };
    });

    this.logger.log(`✅ Razorpay payment settled for invoice ${id}: Receipt ${result.receiptNumber}`);
    return result;
  }
}
