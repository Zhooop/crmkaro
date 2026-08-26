import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { RequirePermissions, RequireService } from "../access/access.metadata.js";
import { ActiveOrganisationGuard } from "../access/active-organisation.guard.js";
import { PermissionGuard } from "../access/permission.guard.js";
import { ServiceEntitlementGuard } from "../access/service-entitlement.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SessionGuard } from "../auth/session.guard.js";
import { parseBody } from "../common/http/parse-body.js";
import { PeopleService } from "./people.service.js";
import { csvImportSchema, duplicateSchema, personBodySchema, personTypeSchema, personUpdateSchema, tagSchema } from "./people.schemas.js";

@Controller("people")
@UseGuards(SessionGuard, ActiveOrganisationGuard, PermissionGuard, ServiceEntitlementGuard)
@RequireService("people")
export class PeopleController {
  constructor(@Inject(PeopleService) private readonly people: PeopleService) {}
  private context(request: AuthenticatedRequest) { return [request.auth.activeOrganisationId!, request.auth.userId] as const; }

  @Get()
  @RequirePermissions("people.read")
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string | undefined>) {
    const input = z.object({ search: z.string().trim().max(180).optional(), status: z.enum(["ACTIVE","ARCHIVED"]).optional(), type: personTypeSchema.optional(), tagId: z.string().uuid().optional(), cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).catch(25) }).parse(query);
    return this.people.list(...this.context(request), input);
  }

  @Post("duplicates")
  @RequirePermissions("people.read")
  duplicates(@Req() request: AuthenticatedRequest, @Body() body: unknown) { const input = parseBody(duplicateSchema, body); return this.people.findDuplicates(...this.context(request), input.email, input.phone); }

  @Get("tags")
  @RequirePermissions("people.read")
  tags(@Req() request: AuthenticatedRequest) { return this.people.listTags(...this.context(request)); }

  @Post("tags")
  @RequirePermissions("people.update")
  createTag(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.people.createTag(...this.context(request), parseBody(tagSchema, body)); }

  @Post("import")
  @RequirePermissions("people.import")
  importCsv(@Req() request: AuthenticatedRequest, @Body() body: unknown) { const input = parseBody(csvImportSchema, body); return this.people.importCsv(...this.context(request), input.csv, input.preview); }

  @Get("export")
  @RequirePermissions("people.export")
  async exportCsv(@Req() request: AuthenticatedRequest, @Res() response: Response) { const csv = await this.people.exportCsv(...this.context(request)); response.setHeader("content-type", "text/csv; charset=utf-8"); response.setHeader("content-disposition", 'attachment; filename="people.csv"'); response.send(`\uFEFF${csv}`); }

  @Post()
  @RequirePermissions("people.create")
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.people.create(...this.context(request), parseBody(personBodySchema, body)); }

  @Get(":personId")
  @RequirePermissions("people.read")
  get(@Req() request: AuthenticatedRequest, @Param("personId", new ParseUUIDPipe({ version: "4" })) id: string) { return this.people.get(...this.context(request), id); }

  @Patch(":personId")
  @RequirePermissions("people.update")
  update(@Req() request: AuthenticatedRequest, @Param("personId", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: unknown) { return this.people.update(...this.context(request), id, parseBody(personUpdateSchema, body)); }

  @Post(":personId/archive")
  @RequirePermissions("people.archive")
  archive(@Req() request: AuthenticatedRequest, @Param("personId", new ParseUUIDPipe({ version: "4" })) id: string) { return this.people.archive(...this.context(request), id); }
}
