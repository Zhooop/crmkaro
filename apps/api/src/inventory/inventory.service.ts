import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";
import type { MovementInput, ProductInput } from "./inventory.schemas.js";
import { stockDelta } from "./inventory.utils.js";

@Injectable()
export class InventoryService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}
  categories(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, (tx) =>
      tx.productCategory.findMany({
        where: { organisationId },
        orderBy: { name: "asc" },
      }),
    );
  }
  createCategory(organisationId: string, userId: string, name: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const category = await tx.productCategory.create({
        data: { organisationId, name },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "inventory.category_created",
          entityType: "product_category",
          entityId: category.id,
        },
      });
      return category;
    });
  }
  products(
    organisationId: string,
    userId: string,
    search?: string,
    lowStock?: boolean,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const items = await tx.product.findMany({
        where: {
          organisationId,
          isActive: true,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { sku: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: { category: true },
        orderBy: { name: "asc" },
      });
      return lowStock
        ? items.filter((item) => item.currentStock.lte(item.lowStockThreshold))
        : items;
    });
  }
  createProduct(organisationId: string, userId: string, input: ProductInput) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      if (input.categoryId) {
        const category = await tx.productCategory.findFirst({
          where: { id: input.categoryId, organisationId },
        });
        if (!category) throw new BadRequestException("Category not found.");
      }
      const { openingStock, ...data } = input;
      const product = await tx.product.create({
        data: {
          organisationId,
          ...data,
          currentStock: openingStock,
          movements:
            openingStock > 0
              ? {
                  create: {
                    organisationId,
                    recordedById: userId,
                    type: "OPENING",
                    quantity: openingStock,
                    stockAfter: openingStock,
                  },
                }
              : undefined,
        },
        include: { category: true },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "inventory.product_created",
          entityType: "product",
          entityId: product.id,
          metadata: { sku: product.sku, openingStock },
        },
      });
      return product;
    });
  }
  movements(organisationId: string, userId: string, productId?: string) {
    return withTenant(this.database, organisationId, userId, (tx) =>
      tx.stockMovement.findMany({
        where: { organisationId, productId },
        include: { product: { select: { id: true, sku: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    );
  }
  move(
    organisationId: string,
    userId: string,
    roleId: string,
    productId: string,
    input: MovementInput,
  ) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid AND organisation_id = ${organisationId}::uuid FOR UPDATE`;
      const product = await tx.product.findFirst({
        where: { id: productId, organisationId, isActive: true },
      });
      if (!product) throw new NotFoundException("Product not found.");
      const signed = stockDelta(input.type, input.quantity);
      const stockAfter = Number(product.currentStock) + signed;
      if (stockAfter < 0) {
        if (!input.allowNegative)
          throw new BadRequestException("Insufficient stock.");
        const allowed = await tx.rolePermission.count({
          where: {
            roleId,
            permission: { code: "inventory.negativeStock.override" },
          },
        });
        if (!allowed)
          throw new ForbiddenException(
            "Negative stock override permission is required.",
          );
      }
      const movement = await tx.stockMovement.create({
        data: {
          organisationId,
          productId,
          recordedById: userId,
          type: input.type,
          quantity: input.quantity,
          stockAfter,
          unitCostMinor: input.unitCostMinor,
          reference: input.reference,
          notes: input.notes,
        },
      });
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: stockAfter },
      });
      await tx.auditLog.create({
        data: {
          organisationId,
          actorUserId: userId,
          action: "inventory.stock_moved",
          entityType: "stock_movement",
          entityId: movement.id,
          metadata: {
            productId,
            type: input.type,
            quantity: input.quantity,
            stockAfter,
            negativeOverride: stockAfter < 0,
          },
        },
      });
      return movement;
    });
  }
  report(organisationId: string, userId: string) {
    return withTenant(this.database, organisationId, userId, async (tx) => {
      const products = await tx.product.findMany({
        where: { organisationId, isActive: true },
      });
      const lowStock = products.filter((item) =>
        item.currentStock.lte(item.lowStockThreshold),
      );
      return {
        products: products.length,
        lowStock: lowStock.length,
        stockValueMinor: products.reduce(
          (sum, item) =>
            sum +
            Math.round(
              Number(item.currentStock) * (item.purchasePriceMinor ?? 0),
            ),
          0,
        ),
        lowStockItems: lowStock.map(
          ({ id, sku, name, currentStock, lowStockThreshold }) => ({
            id,
            sku,
            name,
            currentStock,
            lowStockThreshold,
          }),
        ),
      };
    });
  }
}
