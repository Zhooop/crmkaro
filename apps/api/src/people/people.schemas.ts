import { z } from "zod";

const optionalText = (length: number) => z.string().trim().max(length).optional().nullable();
export const personTypeSchema = z.enum(["CUSTOMER", "STUDENT", "MEMBER", "EMPLOYEE"]);
export const personBodySchema = z.object({
  displayName: z.string().trim().min(2).max(180),
  primaryPhone: optionalText(32), alternatePhone: optionalText(32), email: z.string().trim().email().max(320).optional().nullable(),
  address: z.record(z.string(), z.string().trim().max(300)).optional().nullable(), notes: optionalText(5000),
  types: z.array(personTypeSchema).min(1).max(4), tagIds: z.array(z.string().uuid()).max(20).default([]),
});
export const personUpdateSchema = personBodySchema.partial().refine((body) => Object.keys(body).length > 0, "At least one field is required.");
export const duplicateSchema = z.object({ email: z.string().trim().email().optional(), phone: z.string().trim().max(32).optional() }).refine((body) => body.email || body.phone, "Email or phone is required.");
export const tagSchema = z.object({ name: z.string().trim().min(1).max(80), colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#64748B") });
export const csvImportSchema = z.object({ csv: z.string().min(1).max(1_000_000), preview: z.boolean().default(true) });
export type PersonInput = z.infer<typeof personBodySchema>;
