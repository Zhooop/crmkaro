import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { rolePresets } from "@crmkaro/permissions";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { parseBody } from "../common/http/parse-body.js";
import { RequirePermissions } from "./access.metadata.js";
import { ActiveOrganisationGuard } from "./active-organisation.guard.js";
import { PermissionGuard } from "./permission.guard.js";
import { ServiceEntitlementGuard } from "./service-entitlement.guard.js";
import { AccessService } from "./access.service.js";

const roleSchema = z.object({ roleCode: z.enum(Object.keys(rolePresets) as [keyof typeof rolePresets, ...(keyof typeof rolePresets)[]]) });

@Controller("access")
@UseGuards(SessionGuard, ActiveOrganisationGuard, PermissionGuard, ServiceEntitlementGuard)
export class AccessController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}
  private context(request: AuthenticatedRequest) { return [request.auth.activeOrganisationId!, request.auth.userId] as const; }

  @Get("permissions")
  @RequirePermissions("organisation.member.manage")
  permissions() { return this.access.listPermissions(); }

  @Get("roles")
  @RequirePermissions("organisation.member.manage")
  roles(@Req() request: AuthenticatedRequest) { return this.access.listRoles(...this.context(request)); }

  @Patch("memberships/:membershipId/role")
  @RequirePermissions("organisation.member.manage")
  assignRole(@Param("membershipId", new ParseUUIDPipe({ version: "4" })) membershipId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    const { roleCode } = parseBody(roleSchema, body);
    return this.access.assignRole(...this.context(request), membershipId, roleCode);
  }

  @Get("services")
  @RequirePermissions("organisation.settings.read")
  services(@Req() request: AuthenticatedRequest) { return this.access.listServices(...this.context(request)); }

  @Post("services/:serviceCode/enable")
  @RequirePermissions("organisation.service.manage")
  enable(@Param("serviceCode") code: string, @Req() request: AuthenticatedRequest) { return this.access.setServiceStatus(...this.context(request), code, true); }

  @Post("services/:serviceCode/disable")
  @RequirePermissions("organisation.service.manage")
  disable(@Param("serviceCode") code: string, @Req() request: AuthenticatedRequest) { return this.access.setServiceStatus(...this.context(request), code, false); }

  @Get("audit")
  @RequirePermissions("audit.read")
  audit(@Req() request: AuthenticatedRequest, @Query("limit") limit?: string, @Query("cursor") cursor?: string, @Query("action") action?: string) {
    const parsedLimit = z.coerce.number().int().min(1).max(100).catch(25).parse(limit);
    const parsedCursor = cursor ? z.string().uuid().parse(cursor) : undefined;
    return this.access.listAudit(...this.context(request), parsedLimit, parsedCursor, action);
  }
}
