import { z } from "zod";

const money = z.number().int().min(0).max(2_000_000_000);
export const employeeSchema = z.object({
  personId: z.string().uuid(),
  employeeCode: z.string().trim().min(1).max(40),
  department: z.string().trim().max(100).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  joiningDate: z.coerce.date(),
});
export const salaryStructureSchema = z
  .object({
    effectiveFrom: z.coerce.date(),
    basicMinor: money,
    allowancesMinor: money.default(0),
    deductionsMinor: money.default(0),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default("INR"),
    components: z.record(z.string(), money).optional(),
  })
  .refine(
    (value) =>
      value.deductionsMinor <= value.basicMinor + value.allowancesMinor,
    "Deductions cannot exceed gross salary.",
  );
export const payrollRunSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
});
export const payrollPaymentSchema = z.object({
  paymentReference: z.string().trim().min(1).max(160),
});
export const employeeExitSchema = z.object({ exitDate: z.coerce.date() });

export type EmployeeInput = z.infer<typeof employeeSchema>;
export type SalaryStructureInput = z.infer<typeof salaryStructureSchema>;
