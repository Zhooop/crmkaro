import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";

@Injectable()
export class ActiveOrganisationGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organisationId = request.auth.activeOrganisationId;
    if (!organisationId) throw new ForbiddenException("Select an active organisation first.");

    const membership = await withTenant(this.database, organisationId, request.auth.userId, (tx) =>
      tx.organisationMembership.findUnique({
        where: { organisationId_userId: { organisationId, userId: request.auth.userId } },
        include: { role: true },
      }),
    );
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("Organisation membership is not active.");
    }
    request.auth.membershipId = membership.id;
    request.auth.roleId = membership.roleId;
    request.auth.roleCode = membership.role.code;
    return true;
  }
}
