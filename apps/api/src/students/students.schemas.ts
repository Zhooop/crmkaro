import { z } from "zod";

const optionalText = (length: number) =>
  z.string().trim().max(length).optional().nullable();

export const feeFrequencySchema = z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]);
export const studentStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const attendanceStatusSchema = z.enum(["PRESENT", "ABSENT", "LEAVE"]);

export const studentAdmissionSchema = z.object({
  displayName: z.string().trim().min(2).max(180),
  primaryPhone: optionalText(32),
  alternatePhone: optionalText(32),
  email: z.string().trim().email().max(320).optional().nullable(),
  address: z.record(z.string(), z.string().trim().max(300)).optional().nullable(),
  notes: optionalText(5000),
  rollNumber: optionalText(40),
  standard: z.string().trim().min(1).max(100),
  batch: optionalText(100),
  guardianName: optionalText(180),
  guardianPhone: optionalText(32),
  guardianRelation: optionalText(60),
  feeFrequency: feeFrequencySchema.default("MONTHLY"),
  feeAmountMinor: z.coerce.number().int().min(0).max(2_000_000_000).default(0),
  billingStartDate: z.coerce.date().default(() => new Date()),
  admissionDate: z.coerce.date().default(() => new Date()),
});

export const studentUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(180).optional(),
  primaryPhone: optionalText(32),
  alternatePhone: optionalText(32),
  email: z.string().trim().email().max(320).optional().nullable(),
  address: z.record(z.string(), z.string().trim().max(300)).optional().nullable(),
  notes: optionalText(5000),
  rollNumber: optionalText(40),
  standard: z.string().trim().min(1).max(100).optional(),
  batch: optionalText(100),
  guardianName: optionalText(180),
  guardianPhone: optionalText(32),
  guardianRelation: optionalText(60),
  feeFrequency: feeFrequencySchema.optional(),
  feeAmountMinor: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  status: studentStatusSchema.optional(),
});

export const collectFeeSchema = z.object({
  studentProfileId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  amountMinor: z.coerce.number().int().min(0).max(2_000_000_000),
  paymentMethod: z.string().trim().min(1).max(60).default("UPI"),
  reference: optionalText(160),
  notes: optionalText(1000),
  receivedAt: z.coerce.date().default(() => new Date()),
});

export const recordAttendanceItemSchema = z.object({
  studentProfileId: z.string().uuid(),
  status: attendanceStatusSchema,
  remarks: optionalText(240),
});

export const recordAttendanceBatchSchema = z.object({
  date: z.coerce.date().default(() => new Date()),
  records: z.array(recordAttendanceItemSchema).min(1).max(500),
});

export type StudentAdmissionInput = z.infer<typeof studentAdmissionSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type CollectFeeInput = z.infer<typeof collectFeeSchema>;
export type RecordAttendanceBatchInput = z.infer<typeof recordAttendanceBatchSchema>;
