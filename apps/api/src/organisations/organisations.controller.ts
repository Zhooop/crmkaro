import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody } from "../common/http/parse-body.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { OrganisationsService } from "./organisations.service.js";

const createOrganisationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  businessType: z.string().trim().min(2, "Business type is required").max(80),
  industry: z.string().trim().max(100).optional(),
  timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("INR"),
  serviceCodes: z.array(z.string().trim().min(1)).min(1),
});

const updateOrganisationSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  logoUrl: z.string().nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  businessType: z.string().trim().max(80).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
});

@Controller("organisations")
@UseGuards(SessionGuard)
export class OrganisationsController {
  constructor(@Inject(OrganisationsService) private readonly organisations: OrganisationsService) {}

  @Post()
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.organisations.create(
      request.auth.userId,
      request.auth.sessionId,
      parseBody(createOrganisationSchema, body),
    );
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.organisations.list(request.auth.userId);
  }

  @Post(":organisationId/activate")
  activate(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" })) organisationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organisations.activate(request.auth.userId, request.auth.sessionId, organisationId);
  }

  @Patch(":organisationId")
  update(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" })) organisationId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organisations.update(
      organisationId,
      request.auth.userId,
      parseBody(updateOrganisationSchema, body),
    );
  }
}
