import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
import {
  categorySchema,
  productSchema,
  stockMovementSchema,
} from "./inventory.schemas.js";
import { InventoryService } from "./inventory.service.js";

@Controller("inventory")
@UseGuards(
  SessionGuard,
  ActiveOrganisationGuard,
  PermissionGuard,
  ServiceEntitlementGuard,
)
@RequireService("inventory")
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}
  private context(request: AuthenticatedRequest) {
    return [request.auth.activeOrganisationId!, request.auth.userId] as const;
  }
  @Get("categories") @RequirePermissions("inventory.product.read") categories(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.categories(...this.context(request));
  }
  @Post("categories")
  @RequirePermissions("inventory.product.manage")
  createCategory(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.inventory.createCategory(
      ...this.context(request),
      parseBody(categorySchema, body).name,
    );
  }
  @Get("products") @RequirePermissions("inventory.product.read") products(
    @Req() request: AuthenticatedRequest,
    @Query("search") search?: string,
    @Query("lowStock") lowStock?: string,
  ) {
    return this.inventory.products(
      ...this.context(request),
      search ? z.string().trim().max(180).parse(search) : undefined,
      lowStock === "true",
    );
  }
  @Post("products")
  @RequirePermissions("inventory.product.manage")
  createProduct(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.inventory.createProduct(
      ...this.context(request),
      parseBody(productSchema, body),
    );
  }
  @Get("movements") @RequirePermissions("inventory.product.read") movements(
    @Req() request: AuthenticatedRequest,
    @Query("productId") productId?: string,
  ) {
    return this.inventory.movements(
      ...this.context(request),
      productId ? z.string().uuid().parse(productId) : undefined,
    );
  }
  @Post("products/:productId/movements")
  @RequirePermissions("inventory.stock.manage")
  move(
    @Req() request: AuthenticatedRequest,
    @Param("productId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: unknown,
  ) {
    return this.inventory.move(
      ...this.context(request),
      request.auth.roleId!,
      id,
      parseBody(stockMovementSchema, body),
    );
  }
  @Get("reports/summary") @RequirePermissions("inventory.product.read") report(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventory.report(...this.context(request));
  }
}
