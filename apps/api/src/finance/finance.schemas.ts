import { z } from "zod";
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();
export const invoiceSchema = z
  .object({
    personId: z.string().uuid(),
    issueDate: z.coerce.date().default(() => new Date()),
    dueDate: z.coerce.date().optional().nullable(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .default("INR"),
    notes: optionalText(2000),
    items: z
      .array(
        z
          .object({
            description: z.string().trim().min(1).max(500),
            quantity: z.number().positive().max(1_000_000),
            unitPriceMinor: z.number().int().min(0).max(2_000_000_000),
            discountMinor: z.number().int().min(0).max(2_000_000_000).default(0),
            taxRateBps: z.number().int().min(0).max(10000).optional().default(0),
            taxRateBasisPoints: z.number().int().min(0).max(10000).optional(),
          })
          .transform((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            discountMinor: item.discountMinor,
            taxRateBps: item.taxRateBasisPoints !== undefined ? item.taxRateBasisPoints : item.taxRateBps,
          })),
      )
      .min(1)
      .max(100),
  })
  .transform((value) => {
    const issueDate = value.issueDate || new Date();
    const dueDate = value.dueDate || new Date(issueDate.getTime() + 15 * 86400000);
    return {
      ...value,
      issueDate,
      dueDate,
    };
  })
  .refine(
    (value) => {
      const issueDateStr = new Date(value.issueDate).toISOString().slice(0, 10);
      const dueDateStr = new Date(value.dueDate).toISOString().slice(0, 10);
      return dueDateStr >= issueDateStr;
    },
    { message: "Due date cannot be before issue date.", path: ["dueDate"] },
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
export const expenseSchema = z
  .object({
    category: z.string().trim().min(1).max(100),
    vendor: optionalText(180),
    description: optionalText(500),
    amountMinor: z.number().int().positive().max(2_000_000_000),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .default("INR"),
    expenseDate: z.coerce.date().optional(),
    date: z.coerce.date().optional(),
    reference: optionalText(160),
  })
  .transform((val) => ({
    category: val.category,
    vendor: val.vendor,
    description: val.description?.trim() || val.category,
    amountMinor: val.amountMinor,
    currency: val.currency,
    expenseDate: val.expenseDate || val.date || new Date(),
    reference: val.reference,
  }));

export const updateInvoiceSchema = z.object({
  personId: z.string().uuid().optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  notes: optionalText(2000),
  items: z
    .array(
      z
        .object({
          description: z.string().trim().min(1).max(500),
          quantity: z.number().positive().max(1_000_000),
          unitPriceMinor: z.number().int().min(0).max(2_000_000_000),
          discountMinor: z.number().int().min(0).max(2_000_000_000).default(0),
          taxRateBps: z.number().int().min(0).max(10000).optional().default(0),
          taxRateBasisPoints: z.number().int().min(0).max(10000).optional(),
        })
        .transform((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          discountMinor: item.discountMinor,
          taxRateBps: item.taxRateBasisPoints !== undefined ? item.taxRateBasisPoints : item.taxRateBps,
        })),
    )
    .min(1)
    .max(100)
    .optional(),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;

