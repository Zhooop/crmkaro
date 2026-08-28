import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { PlatformService } from "./platform.service.js";

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]),
});

const updateServicesSchema = z.object({
  serviceCodes: z.array(z.string()),
});

const createOrgSchema = z.object({
  name: z.string().min(2),
  businessType: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  serviceCodes: z.array(z.string()).optional(),
});

@Controller("platform")
@UseGuards(SessionGuard)
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("overview")
  overview() {
    return this.platform.overview();
  }

  @Get("organisations")
  organisations() {
    return this.platform.listOrganisations();
  }

  @Patch("organisations/:id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = updateStatusSchema.parse(body);
    return this.platform.updateOrganisationStatus(id, input.status, req.auth?.userId);
  }

  @Patch("organisations/:id/services")
  updateServices(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = updateServicesSchema.parse(body);
    return this.platform.updateOrganisationServices(id, input.serviceCodes, req.auth?.userId);
  }

  @Post("organisations")
  createOrganisation(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = createOrgSchema.parse(body);
    return this.platform.createOrganisation(input, req.auth?.userId);
  }

  @Get("audit")
  audit(@Query("limit") limit?: string) {
    const parsedLimit = z.coerce.number().int().min(1).max(100).catch(50).parse(limit);
    return this.platform.listAudit(parsedLimit);
  }

  @Get("health")
  health() {
    return this.platform.getHealth();
  }
}
