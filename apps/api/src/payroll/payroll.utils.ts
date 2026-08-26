export function calculateSalary(
  basicMinor: number,
  allowancesMinor: number,
  deductionsMinor: number,
) {
  const grossMinor = basicMinor + allowancesMinor;
  if (deductionsMinor > grossMinor)
    throw new Error("Deductions cannot exceed gross salary.");
  return { grossMinor, netMinor: grossMinor - deductionsMinor };
}
