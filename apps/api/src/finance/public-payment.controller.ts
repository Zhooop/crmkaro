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

    let payoutDetails: {
      upiId: string | null;
      bankName: string | null;
      accountHolderName: string | null;
      ifscCode: string | null;
      accountNumberMasked: string | null;
      gatewayMode: string;
      isVerified: boolean;
    } | null = null;
    let customKeyId: string | null = null;

    try {
      const pRows: any[] = await withPlatformAdmin(this.database, async (tx) => {
        return tx.$queryRawUnsafe(
          `SELECT * FROM "organisation_payout_settings" WHERE "organisation_id" = $1::uuid LIMIT 1`,
          invoice.organisationId,
        );
      });
      const p = pRows[0] || null;
      if (p) {
        payoutDetails = {
          upiId: p.upi_id || null,
          bankName: p.bank_name || null,
          accountHolderName: p.account_holder_name || null,
          ifscCode: p.ifsc_code || null,
          accountNumberMasked: p.account_number
            ? p.account_number.length > 4
              ? `••••••••${p.account_number.slice(-4)}`
              : p.account_number
            : null,
          gatewayMode: p.gateway_mode || "PLATFORM_ROUTE",
          isVerified: Boolean(p.is_verified),
        };
        if (p.gateway_mode === "CUSTOM_KEYS" && p.custom_razorpay_key_id) {
          customKeyId = p.custom_razorpay_key_id;
        }
      }
    } catch {
      // ignore if table not created yet
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
      payoutDetails,
      customer: invoice.person,
      items: invoice.items,
      latestReceipt: invoice.payments[0] || null,
      razorpayKeyId: customKeyId || this.razorpay.getKeyId(),
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

    let customKeyId: string | null = null;
    try {
      const pRows: any[] = await withPlatformAdmin(this.database, async (tx) => {
        return tx.$queryRawUnsafe(
          `SELECT * FROM "organisation_payout_settings" WHERE "organisation_id" = $1::uuid LIMIT 1`,
          invoice.organisationId,
        );
      });
      const p = pRows[0] || null;
      if (p?.gateway_mode === "CUSTOM_KEYS" && p.custom_razorpay_key_id) {
        customKeyId = p.custom_razorpay_key_id;
      }
    } catch {
      // ignore
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
      keyId: customKeyId || this.razorpay.getKeyId(),
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
