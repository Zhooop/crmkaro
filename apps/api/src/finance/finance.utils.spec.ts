import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoice } from "./finance.utils.js";
test("calculates invoice totals in integer minor units", () => {
  const result = calculateInvoice([
    {
      quantity: 2,
      unitPriceMinor: 10000,
      discountMinor: 1000,
      taxRateBps: 1800,
    },
  ]);
  assert.deepEqual(
    {
      subtotal: result.subtotalMinor,
      discount: result.discountMinor,
      tax: result.taxMinor,
      total: result.grandTotalMinor,
    },
    { subtotal: 20000, discount: 1000, tax: 3420, total: 22420 },
  );
});
test("rejects discounts above line value", () =>
  assert.throws(() =>
    calculateInvoice([
      { quantity: 1, unitPriceMinor: 100, discountMinor: 101, taxRateBps: 0 },
    ]),
  ));
