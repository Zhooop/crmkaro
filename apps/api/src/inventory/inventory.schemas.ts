import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export const productSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(180),
  unit: z.string().trim().min(1).max(30).default("unit"),
  purchasePriceMinor: z
    .number()
    .int()
    .min(0)
    .max(2_000_000_000)
    .optional()
    .nullable(),
  salePriceMinor: z
    .number()
    .int()
    .min(0)
    .max(2_000_000_000)
    .optional()
    .nullable(),
  lowStockThreshold: z.number().min(0).max(1_000_000_000).default(0),
  openingStock: z.number().min(0).max(1_000_000_000).default(0),
});
export const stockMovementSchema = z.object({
  type: z.enum([
    "PURCHASE",
    "SALE",
    "RETURN_IN",
    "RETURN_OUT",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
  ]),
  quantity: z.number().positive().max(1_000_000_000),
  unitCostMinor: z
    .number()
    .int()
    .min(0)
    .max(2_000_000_000)
    .optional()
    .nullable(),
  reference: optionalText(160),
  notes: optionalText(500),
  allowNegative: z.boolean().default(false),
});
export type ProductInput = z.infer<typeof productSchema>;
export type MovementInput = z.infer<typeof stockMovementSchema>;
