export type InvoiceLineInput = {
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxRateBps: number;
};
export function calculateInvoice(items: InvoiceLineInput[]) {
  const lines = items.map((item) => {
    const baseMinor = Math.round(item.quantity * item.unitPriceMinor);
    if (item.discountMinor > baseMinor)
      throw new Error("Line discount cannot exceed its base amount.");
    const taxableMinor = baseMinor - item.discountMinor;
    const taxMinor = Math.round((taxableMinor * item.taxRateBps) / 10_000);
    return {
      ...item,
      taxMinor,
      lineTotalMinor: taxableMinor + taxMinor,
      baseMinor,
    };
  });
  return {
    lines,
    subtotalMinor: lines.reduce((sum, line) => sum + line.baseMinor, 0),
    discountMinor: lines.reduce((sum, line) => sum + line.discountMinor, 0),
    taxMinor: lines.reduce((sum, line) => sum + line.taxMinor, 0),
    grandTotalMinor: lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
  };
}
export function formatMoney(minor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    minor / 100,
  );
}
