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
import { CrmService } from "./crm.service.js";
import {
  conversionSchema,
  followUpSchema,
  followUpUpdateSchema,
  leadSchema,
  leadCsvSchema,
  leadUpdateSchema,
  noteSchema,
  pipelineSchema,
  stagesSchema,
} from "./crm.schemas.js";

@Controller("crm")
@UseGuards(
  SessionGuard,
  ActiveOrganisationGuard,
  PermissionGuard,
  ServiceEntitlementGuard,
)
@RequireService("crm")
export class CrmController {
  constructor(@Inject(CrmService) private readonly crm: CrmService) {}
  private context(request: AuthenticatedRequest) {
    return [request.auth.activeOrganisationId!, request.auth.userId] as const;
  }

  @Get("pipelines")
  @RequirePermissions("crm.lead.read")
  pipelines(@Req() request: AuthenticatedRequest) {
    return this.crm.pipelines(...this.context(request));
  }
  @Post("pipelines")
  @RequirePermissions("organisation.settings.update")
  createPipeline(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.crm.createPipeline(
      ...this.context(request),
      parseBody(pipelineSchema, body),
    );
  }
  @Patch("pipelines/:pipelineId/stages")
  @RequirePermissions("organisation.settings.update")
  stages(
    @Req() request: AuthenticatedRequest,
    @Param("pipelineId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.crm.updateStages(
      ...this.context(request),
      id,
      parseBody(stagesSchema, body).stages,
    );
  }

  @Get("metrics")
  @RequirePermissions("crm.lead.read")
  metrics(@Req() request: AuthenticatedRequest) {
    return this.crm.metrics(...this.context(request));
  }
  @Post("leads/import")
  @RequirePermissions("crm.lead.create")
  importCsv(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.crm.importCsv(
      ...this.context(request),
      parseBody(leadCsvSchema, body),
    );
  }
  @Get("leads")
  @RequirePermissions("crm.lead.read")
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    const input = z
      .object({
        search: z.string().trim().max(180).optional(),
        pipelineId: z.string().uuid().optional(),
        stageId: z.string().uuid().optional(),
        ownerMembershipId: z.string().uuid().optional(),
        source: z.string().trim().max(80).optional(),
        status: z.enum(["OPEN", "CONVERTED", "LOST"]).optional(),
        cursor: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).catch(25),
      })
      .parse(query);
    return this.crm.list(...this.context(request), input);
  }
  @Post("leads")
  @RequirePermissions("crm.lead.create")
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.crm.create(
      ...this.context(request),
      parseBody(leadSchema, body),
    );
  }
  @Get("leads/:leadId")
  @RequirePermissions("crm.lead.read")
  get(
    @Req() request: AuthenticatedRequest,
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.crm.get(...this.context(request), id);
  }
  @Patch("leads/:leadId")
  @RequirePermissions("crm.lead.update")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.crm.update(
      ...this.context(request),
      id,
      parseBody(leadUpdateSchema, body),
    );
  }
  @Post("leads/:leadId/notes")
  @RequirePermissions("crm.lead.update")
  note(
    @Req() request: AuthenticatedRequest,
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.crm.addNote(
      ...this.context(request),
      id,
      parseBody(noteSchema, body).body,
    );
  }
  @Post("leads/:leadId/follow-ups")
  @RequirePermissions("crm.lead.update")
  followUp(
    @Req() request: AuthenticatedRequest,
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.crm.scheduleFollowUp(
      ...this.context(request),
      id,
      parseBody(followUpSchema, body),
    );
  }
  @Patch("follow-ups/:followUpId")
  @RequirePermissions("crm.lead.update")
  updateFollowUp(
    @Req() request: AuthenticatedRequest,
    @Param("followUpId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.crm.updateFollowUp(
      ...this.context(request),
      id,
      parseBody(followUpUpdateSchema, body),
    );
  }
  @Post("leads/:leadId/convert")
  @RequirePermissions("crm.lead.convert")
  convert(
    @Req() request: AuthenticatedRequest,
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.crm.convert(
      ...this.context(request),
      id,
      parseBody(conversionSchema, body).personId,
    );
  }
}
