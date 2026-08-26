import assert from "node:assert/strict";
import test from "node:test";
import { stockDelta } from "./inventory.utils.js";

test("stock movements apply the correct direction", () => {
  assert.equal(stockDelta("PURCHASE", 5), 5);
  assert.equal(stockDelta("SALE", 5), -5);
  assert.equal(stockDelta("RETURN_IN", 2), 2);
  assert.equal(stockDelta("ADJUSTMENT_OUT", 2), -2);
});
