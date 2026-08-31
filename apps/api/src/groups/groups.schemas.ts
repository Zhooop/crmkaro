import { z } from "zod";

const optionalText = (length: number) =>
  z.string().trim().max(length).optional().nullable();

export const groupMemberInputSchema = z.object({
  personId: z.string().uuid(),
  customFeeMinor: z.coerce.number().int().min(0).max(2_000_000_000).optional().nullable(),
  startDate: z.coerce.date().default(() => new Date()),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: optionalText(40),
  description: optionalText(500),
  color: z.string().trim().max(30).default("#3b82f6"),
  feeAmountMinor: z.coerce.number().int().min(0).max(2_000_000_000).default(0),
  feeFrequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).default("MONTHLY"),
  billingType: z.string().trim().max(40).default("Fixed"),
  collectionDay: optionalText(60).default("1st day of month"),
  startDate: z.coerce.date().default(() => new Date()),
  endDate: z.coerce.date().optional().nullable(),
  workingDays: z.string().trim().max(60).default("T,Th,S"),
  members: z.array(groupMemberInputSchema).default([]),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  code: optionalText(40),
  description: optionalText(500),
  color: z.string().trim().max(30).optional(),
  feeAmountMinor: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  feeFrequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).optional(),
  billingType: z.string().trim().max(40).optional(),
  collectionDay: optionalText(60),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional().nullable(),
  workingDays: z.string().trim().max(60).optional(),
  isActive: z.boolean().optional(),
});

export const addGroupMemberSchema = z.object({
  personId: z.string().uuid(),
  customFeeMinor: z.coerce.number().int().min(0).max(2_000_000_000).optional().nullable(),
  startDate: z.coerce.date().default(() => new Date()),
});

export const batchAddGroupMembersSchema = z.object({
  members: z.array(addGroupMemberSchema).min(1).max(500),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;
export type BatchAddGroupMembersInput = z.infer<typeof batchAddGroupMembersSchema>;
