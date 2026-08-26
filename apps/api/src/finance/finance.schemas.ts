import { z } from "zod";
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();
export const invoiceSchema = z
  .object({
    personId: z.string().uuid(),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .default("INR"),
    notes: optionalText(2000),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(500),
          quantity: z.number().positive().max(1_000_000),
          unitPriceMinor: z.number().int().min(0).max(2_000_000_000),
          discountMinor: z.number().int().min(0).max(2_000_000_000).default(0),
          taxRateBps: z.number().int().min(0).max(10000).default(0),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (value) => value.dueDate >= value.issueDate,
    "Due date cannot be before issue date.",
  );
export const paymentSchema = z.object({
  invoiceId: z.string().uuid().optional().nullable(),
  personId: z.string().uuid(),
  amountMinor: z.number().int().positive().max(2_000_000_000),
  method: z.string().trim().min(1).max(60),
  reference: optionalText(160),
  receivedAt: z.coerce.date(),
  notes: optionalText(1000),
});
export const refundSchema = z.object({
  amountMinor: z.number().int().positive().max(2_000_000_000),
  reason: z.string().trim().min(3).max(500),
});
export const expenseSchema = z.object({
  category: z.string().trim().min(1).max(100),
  vendor: optionalText(180),
  description: z.string().trim().min(1).max(500),
  amountMinor: z.number().int().positive().max(2_000_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .default("INR"),
  expenseDate: z.coerce.date(),
  reference: optionalText(160),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
