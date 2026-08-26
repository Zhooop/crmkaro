import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SERVICE_KEY } from "./access.metadata.js";

@Injectable()
export class ServiceEntitlementGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(DATABASE) private readonly database: DatabaseClient) {}
  async canActivate(context: ExecutionContext) {
    const serviceCode = this.reflector.getAllAndOverride<string>(SERVICE_KEY, [context.getHandler(), context.getClass()]);
    if (!serviceCode) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organisationId = request.auth.activeOrganisationId;
    if (!organisationId) throw new ForbiddenException("Organisation access is required.");
    const entitlement = await withTenant(this.database, organisationId, request.auth.userId, (tx) =>
      tx.organisationService.findFirst({ where: { organisationId, service: { code: serviceCode }, status: "ACTIVE" } }),
    );
    if (!entitlement) throw new ForbiddenException(`The ${serviceCode} service is not enabled.`);
    return true;
  }
}
