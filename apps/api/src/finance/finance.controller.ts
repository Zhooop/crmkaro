import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import {
  RequirePermissions,
  RequireService,
} from "../access/access.metadata.js";
import { ActiveOrganisationGuard } from "../access/active-organisation.guard.js";
import { PermissionGuard } from "../access/permission.guard.js";
import { ServiceEntitlementGuard } from "../access/service-entitlement.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SessionGuard } from "../auth/session.guard.js";
import { parseBody } from "../common/http/parse-body.js";
import {
  expenseSchema,
  invoiceSchema,
  paymentSchema,
  refundSchema,
  updateInvoiceSchema,
} from "./finance.schemas.js";
import { FinanceService } from "./finance.service.js";

@Controller("finance")
@UseGuards(
  SessionGuard,
  ActiveOrganisationGuard,
  PermissionGuard,
  ServiceEntitlementGuard,
)
@RequireService("finance")
export class FinanceController {
  constructor(
    @Inject(FinanceService) private readonly finance: FinanceService,
  ) {}
  private context(request: AuthenticatedRequest) {
    return [request.auth.activeOrganisationId!, request.auth.userId] as const;
  }
  @Get("invoices")
  @RequirePermissions("finance.invoice.read")
  invoices(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    const input = z
      .object({
        status: z
          .enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"])
          .optional(),
        personId: z.string().uuid().optional(),
        cursor: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).catch(25),
      })
      .parse(query);
    return this.finance.listInvoices(...this.context(request), input);
  }
  @Post("invoices")
  @RequirePermissions("finance.invoice.manage")
  createInvoice(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.createInvoice(
      ...this.context(request),
      parseBody(invoiceSchema, body),
    );
  }
  @Get("invoices/:invoiceId")
  @RequirePermissions("finance.invoice.read")
  invoice(
    @Req() request: AuthenticatedRequest,
    @Param("invoiceId", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.finance.getInvoice(...this.context(request), id);
  }
  @Patch("invoices/:invoiceId")
  @RequirePermissions("finance.invoice.manage")
  updateInvoice(
    @Req() request: AuthenticatedRequest,
    @Param("invoiceId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.finance.updateInvoice(
      ...this.context(request),
      id,
      parseBody(updateInvoiceSchema, body),
    );
  }
  @Post("invoices/:invoiceId/issue")
  @RequirePermissions("finance.invoice.manage")
  issue(
    @Req() request: AuthenticatedRequest,
    @Param("invoiceId", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.finance.issueInvoice(...this.context(request), id);
  }
  @Post("invoices/:invoiceId/void")
  @RequirePermissions("finance.invoice.manage")
  voidInvoice(
    @Req() request: AuthenticatedRequest,
    @Param("invoiceId", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.finance.voidInvoice(...this.context(request), id);
  }
  @Get("invoices/:invoiceId/pdf")
  @RequirePermissions("finance.invoice.read")
  async pdf(
    @Req() request: AuthenticatedRequest,
    @Param("invoiceId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Res() response: Response,
  ) {
    const pdf = await this.finance.invoicePdf(...this.context(request), id);
    response.setHeader("content-type", "application/pdf");
    response.setHeader(
      "content-disposition",
      `inline; filename="invoice-${id}.pdf"`,
    );
    response.send(pdf);
  }
  @Get("payments")
  @RequirePermissions("finance.payment.read")
  payments(
    @Req() request: AuthenticatedRequest,
    @Query("personId") personId?: string,
  ) {
    return this.finance.listPayments(
      ...this.context(request),
      personId ? z.string().uuid().parse(personId) : undefined,
    );
  }
  @Post("payments")
  @RequirePermissions("finance.payment.create")
  createPayment(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.createPayment(
      ...this.context(request),
      parseBody(paymentSchema, body),
    );
  }
  @Post("payments/:paymentId/refunds")
  @RequirePermissions("finance.payment.refund")
  refund(
    @Req() request: AuthenticatedRequest,
    @Param("paymentId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.finance.refundPayment(
      ...this.context(request),
      id,
      parseBody(refundSchema, body),
    );
  }
  @Get("expenses")
  @RequirePermissions("finance.invoice.read")
  expenses(@Req() request: AuthenticatedRequest) {
    return this.finance.listExpenses(...this.context(request));
  }
  @Post("expenses")
  @RequirePermissions("finance.expense.manage")
  createExpense(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.createExpense(
      ...this.context(request),
      parseBody(expenseSchema, body),
    );
  }
  @Post("expenses/:expenseId/void")
  @RequirePermissions("finance.expense.manage")
  voidExpense(
    @Req() request: AuthenticatedRequest,
    @Param("expenseId", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.finance.voidExpense(...this.context(request), id);
  }
  @Get("reports/summary")
  @RequirePermissions("finance.invoice.read", "finance.payment.read")
  report(
    @Req() request: AuthenticatedRequest,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    const schema = z.coerce.date();
    return this.finance.report(
      ...this.context(request),
      schema.parse(from),
      schema.parse(to),
    );
  }
}
