import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AccessController } from "./access.controller.js";
import { AccessService } from "./access.service.js";
import { ActiveOrganisationGuard } from "./active-organisation.guard.js";
import { PermissionGuard } from "./permission.guard.js";
import { ServiceEntitlementGuard } from "./service-entitlement.guard.js";

@Module({
  imports: [AuthModule],
  controllers: [AccessController],
  providers: [AccessService, ActiveOrganisationGuard, PermissionGuard, ServiceEntitlementGuard],
  exports: [ActiveOrganisationGuard, PermissionGuard, ServiceEntitlementGuard],
})
export class AccessModule {}
