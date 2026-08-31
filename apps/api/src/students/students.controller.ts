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
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { RequirePermissions, RequireService } from "../access/access.metadata.js";
import { ActiveOrganisationGuard } from "../access/active-organisation.guard.js";
import { PermissionGuard } from "../access/permission.guard.js";
import { ServiceEntitlementGuard } from "../access/service-entitlement.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SessionGuard } from "../auth/session.guard.js";
import { parseBody } from "../common/http/parse-body.js";
import { StudentsService } from "./students.service.js";
import {
  collectFeeSchema,
  recordAttendanceBatchSchema,
  studentAdmissionSchema,
  studentStatusSchema,
  studentUpdateSchema,
} from "./students.schemas.js";

@Controller("students")
@UseGuards(
  SessionGuard,
  ActiveOrganisationGuard,
  PermissionGuard,
  ServiceEntitlementGuard,
)
@RequireService("people")
export class StudentsController {
  constructor(
    @Inject(StudentsService) private readonly students: StudentsService,
  ) {}

  private context(request: AuthenticatedRequest) {
    return [
      request.auth.activeOrganisationId!,
      request.auth.userId,
    ] as const;
  }

  @Get()
  @RequirePermissions("people.read")
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    const input = z
      .object({
        search: z.string().trim().max(180).optional(),
        standard: z.string().trim().max(100).optional(),
        batch: z.string().trim().max(100).optional(),
        status: studentStatusSchema.optional(),
        cursor: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).catch(100),
      })
      .parse(query);

    return this.students.list(...this.context(request), input);
  }

  @Post()
  @RequirePermissions("people.create")
  createAdmission(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = parseBody(studentAdmissionSchema, body);
    return this.students.createAdmission(...this.context(request), input);
  }

  @Get("recurring-fees")
  @RequirePermissions("finance.invoice.read")
  getRecurringFees(
    @Req() request: AuthenticatedRequest,
    @Query("month") month?: string,
  ) {
    return this.students.getRecurringFeesDashboard(
      ...this.context(request),
      month || new Date().toISOString().slice(0, 7),
    );
  }

  @Post("collect-fee")
  @RequirePermissions("finance.payment.create")
  collectFee(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = parseBody(collectFeeSchema, body);
    return this.students.collectFee(...this.context(request), input);
  }

  @Get("attendance")
  @RequirePermissions("people.read")
  getAttendance(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    const input = z
      .object({
        date: z.coerce.date().default(() => new Date()),
        standard: z.string().trim().max(100).optional(),
        batch: z.string().trim().max(100).optional(),
      })
      .parse(query);

    return this.students.getAttendance(...this.context(request), input);
  }

  @Post("attendance")
  @RequirePermissions("people.update")
  recordAttendance(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = parseBody(recordAttendanceBatchSchema, body);
    return this.students.recordAttendanceBatch(...this.context(request), input);
  }

  @Get("attendance/summary")
  @RequirePermissions("people.read")
  getMonthlyAttendanceSummary(
    @Req() request: AuthenticatedRequest,
    @Query("month") month?: string,
  ) {
    return this.students.getMonthlyAttendanceSummary(
      ...this.context(request),
      month || new Date().toISOString().slice(0, 7),
    );
  }

  @Get(":studentId")
  @RequirePermissions("people.read")
  get(
    @Req() request: AuthenticatedRequest,
    @Param("studentId", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.students.get(...this.context(request), id);
  }

  @Patch(":studentId")
  @RequirePermissions("people.update")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("studentId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(studentUpdateSchema, body);
    return this.students.update(...this.context(request), id, input);
  }

  @Post(":studentId/status")
  @RequirePermissions("people.update")
  toggleStatus(
    @Req() request: AuthenticatedRequest,
    @Param("studentId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      z.object({ status: studentStatusSchema }),
      body,
    );
    return this.students.toggleStatus(
      ...this.context(request),
      id,
      input.status,
    );
  }
}
