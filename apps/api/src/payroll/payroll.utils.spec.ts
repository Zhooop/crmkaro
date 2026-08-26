import assert from "node:assert/strict";
import test from "node:test";
import { calculateSalary } from "./payroll.utils.js";

test("calculates gross and net salary in minor units", () => {
  assert.deepEqual(calculateSalary(50_000, 10_000, 5_000), {
    grossMinor: 60_000,
    netMinor: 55_000,
  });
});

test("rejects deductions above gross salary", () => {
  assert.throws(() => calculateSalary(1_000, 0, 1_001), /cannot exceed/);
});
