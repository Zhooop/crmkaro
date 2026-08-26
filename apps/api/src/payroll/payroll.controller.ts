import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
  employeeExitSchema,
  employeeSchema,
  payrollPaymentSchema,
  payrollRunSchema,
  salaryStructureSchema,
} from "./payroll.schemas.js";
import { PayrollService } from "./payroll.service.js";

@Controller("payroll")
@UseGuards(
  SessionGuard,
  ActiveOrganisationGuard,
  PermissionGuard,
  ServiceEntitlementGuard,
)
@RequireService("payroll")
export class PayrollController {
  constructor(
    @Inject(PayrollService) private readonly payroll: PayrollService,
  ) {}
  private context(request: AuthenticatedRequest) {
    return [request.auth.activeOrganisationId!, request.auth.userId] as const;
  }
  @Get("employees") @RequirePermissions("payroll.employee.read") employees(
    @Req() request: AuthenticatedRequest,
    @Query("status") status?: string,
  ) {
    return this.payroll.listEmployees(
      ...this.context(request),
      status ? z.enum(["ACTIVE", "EXITED"]).parse(status) : undefined,
    );
  }
  @Post("employees")
  @RequirePermissions("payroll.employee.manage")
  createEmployee(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.payroll.createEmployee(
      ...this.context(request),
      parseBody(employeeSchema, body),
    );
  }
  @Post("employees/:employeeId/exit")
  @RequirePermissions("payroll.employee.manage")
  exitEmployee(
    @Req() request: AuthenticatedRequest,
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.payroll.exitEmployee(
      ...this.context(request),
      id,
      parseBody(employeeExitSchema, body).exitDate,
    );
  }
  @Post("employees/:employeeId/salary-structures")
  @RequirePermissions("payroll.employee.manage")
  salary(
    @Req() request: AuthenticatedRequest,
    @Param("employeeId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.payroll.addSalary(
      ...this.context(request),
      id,
      parseBody(salaryStructureSchema, body),
    );
  }
  @Get("runs") @RequirePermissions("payroll.salary.view") runs(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payroll.listRuns(...this.context(request));
  }
  @Post("runs") @RequirePermissions("payroll.run.prepare") prepare(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = parseBody(payrollRunSchema, body);
    return this.payroll.prepareRun(
      ...this.context(request),
      input.year,
      input.month,
    );
  }
  @Post("runs/:runId/approve")
  @RequirePermissions("payroll.run.approve")
  approve(
    @Req() request: AuthenticatedRequest,
    @Param("runId", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.payroll.approveRun(...this.context(request), id);
  }
  @Post("runs/:runId/mark-paid")
  @RequirePermissions("payroll.run.markPaid")
  paid(
    @Req() request: AuthenticatedRequest,
    @Param("runId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.payroll.markPaid(
      ...this.context(request),
      id,
      parseBody(payrollPaymentSchema, body).paymentReference,
    );
  }
  @Get("runs/:runId/employees/:employeeId/payslip")
  @RequirePermissions("payroll.salary.view")
  async payslip(
    @Req() request: AuthenticatedRequest,
    @Param("runId", new ParseUUIDPipe({ version: "4" })) runId: string,
    @Param("employeeId", new ParseUUIDPipe({ version: "4" }))
    employeeId: string,
    @Res() response: Response,
  ) {
    const pdf = await this.payroll.payslip(
      ...this.context(request),
      runId,
      employeeId,
    );
    response.setHeader("content-type", "application/pdf");
    response.send(pdf);
  }
  @Get("reports") @RequirePermissions("payroll.salary.view") report(
    @Req() request: AuthenticatedRequest,
    @Query("year") year: string,
  ) {
    return this.payroll.report(
      ...this.context(request),
      z.coerce.number().int().min(2000).max(2200).parse(year),
    );
  }
}
