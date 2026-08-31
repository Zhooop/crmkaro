import {
  Body,
  Controller,
  Delete,
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
import { ActiveOrganisationGuard } from "../access/active-organisation.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SessionGuard } from "../auth/session.guard.js";
import { parseBody } from "../common/http/parse-body.js";
import { GroupsService } from "./groups.service.js";
import {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
} from "./groups.schemas.js";

@Controller("groups")
@UseGuards(SessionGuard, ActiveOrganisationGuard)
export class GroupsController {
  constructor(@Inject(GroupsService) private readonly service: GroupsService) {}

  private context(request: AuthenticatedRequest) {
    return [request.auth.activeOrganisationId!, request.auth.userId] as const;
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query("search") search?: string,
    @Query("status") status?: "ACTIVE" | "INACTIVE" | "ALL",
  ) {
    const [organisationId, userId] = this.context(request);
    return this.service.list(organisationId, userId, { search, status });
  }

  @Get(":id")
  get(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const [organisationId, userId] = this.context(request);
    return this.service.get(organisationId, userId, id);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() rawBody: unknown,
  ) {
    const [organisationId, userId] = this.context(request);
    const body = parseBody(createGroupSchema, rawBody);
    return this.service.create(organisationId, userId, body);
  }

  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ) {
    const [organisationId, userId] = this.context(request);
    const body = parseBody(updateGroupSchema, rawBody);
    return this.service.update(organisationId, userId, id, body);
  }

  @Post(":id/members")
  addMember(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) groupId: string,
    @Body() rawBody: unknown,
  ) {
    const [organisationId, userId] = this.context(request);
    const body = parseBody(addGroupMemberSchema, rawBody);
    return this.service.addMember(organisationId, userId, groupId, body);
  }

  @Delete(":id/members/:personId")
  removeMember(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) groupId: string,
    @Param("personId", ParseUUIDPipe) personId: string,
  ) {
    const [organisationId, userId] = this.context(request);
    return this.service.removeMember(organisationId, userId, groupId, personId);
  }

  @Delete(":id")
  delete(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const [organisationId, userId] = this.context(request);
    return this.service.delete(organisationId, userId, id);
  }
}
