export function stockDelta(type: string, quantity: number) {
  return ["SALE", "RETURN_OUT", "ADJUSTMENT_OUT"].includes(type)
    ? -quantity
    : quantity;
}
