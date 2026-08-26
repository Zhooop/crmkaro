import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();
export const leadSchema = z.object({
  name: z.string().trim().min(2).max(180),
  phone: optionalText(32),
  email: z.string().trim().email().max(320).optional().nullable(),
  source: optionalText(80),
  expectedValueMinor: z
    .number()
    .int()
    .min(0)
    .max(2_000_000_000)
    .optional()
    .nullable(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  ownerMembershipId: z.string().uuid().optional().nullable(),
});
export const leadUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(180).optional(),
    phone: optionalText(32),
    email: z.string().trim().email().max(320).optional().nullable(),
    source: optionalText(80),
    expectedValueMinor: z
      .number()
      .int()
      .min(0)
      .max(2_000_000_000)
      .optional()
      .nullable(),
    stageId: z.string().uuid().optional(),
    ownerMembershipId: z.string().uuid().optional().nullable(),
    lostReason: optionalText(500),
  })
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field is required.",
  );
export const pipelineSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    stages: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          isConverted: z.boolean().default(false),
          isLost: z.boolean().default(false),
        }),
      )
      .min(2)
      .max(20),
  })
  .refine(
    (value) =>
      value.stages.filter((stage) => stage.isConverted).length === 1 &&
      value.stages.filter((stage) => stage.isLost).length === 1,
    "Exactly one converted and one lost stage are required.",
  );
export const stagesSchema = z.object({
  stages: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        isActive: z.boolean(),
      }),
    )
    .min(2)
    .max(20),
});
export const noteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});
export const followUpSchema = z.object({
  dueAt: z.coerce.date(),
  assignedToMembershipId: z.string().uuid().optional().nullable(),
});
export const followUpUpdateSchema = z
  .object({
    dueAt: z.coerce.date().optional(),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
    outcome: optionalText(1000),
  })
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field is required.",
  );
export const conversionSchema = z.object({
  personId: z.string().uuid().optional(),
});
export const leadCsvSchema = z.object({
  csv: z.string().min(1).max(1_000_000),
  preview: z.boolean().default(true),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  ownerMembershipId: z.string().uuid().optional().nullable(),
});
export type LeadInput = z.infer<typeof leadSchema>;
