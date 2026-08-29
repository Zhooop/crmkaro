import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { ActiveOrganisationGuard } from "../access/active-organisation.guard.js";
import { PermissionGuard } from "../access/permission.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SessionGuard } from "../auth/session.guard.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
@UseGuards(SessionGuard, ActiveOrganisationGuard, PermissionGuard)
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get()
  async summary(@Req() request: AuthenticatedRequest) {
    const dashboard = await this.dashboard.summary(
      request.auth.activeOrganisationId!,
      request.auth.userId,
      request.auth.roleId!,
    );
    return {
      ...dashboard,
      user: {
        id: request.auth.userId,
        email: request.auth.email,
        name: request.auth.name,
        isNewUser: Boolean(dashboard.isNewUser),
      },
      generatedAt: new Date(),
    };
  }
}
