import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import type { Permission } from "@crmkaro/permissions";
import { DATABASE } from "../database/database.module.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { PERMISSIONS_KEY } from "./access.metadata.js";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(DATABASE) private readonly database: DatabaseClient) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organisationId = request.auth.activeOrganisationId;
    if (!organisationId || !request.auth.roleId) throw new ForbiddenException("Organisation access is required.");
    const count = await withTenant(this.database, organisationId, request.auth.userId, (tx) =>
      tx.rolePermission.count({ where: { roleId: request.auth.roleId, permission: { code: { in: required } } } }),
    );
    if (count !== new Set(required).size) throw new ForbiddenException("You do not have permission for this action.");
    return true;
  }
}
