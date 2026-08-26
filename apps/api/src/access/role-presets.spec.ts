import assert from "node:assert/strict";
import test from "node:test";
import { permissions, rolePresets } from "@crmkaro/permissions";

test("owner has the complete permission catalogue", () => {
  assert.deepEqual(new Set(rolePresets.owner.permissions), new Set(permissions));
});

test("only owner can manage organisation service entitlements", () => {
  assert.equal(rolePresets.owner.permissions.includes("organisation.service.manage"), true);
  for (const [code, preset] of Object.entries(rolePresets)) {
    if (code !== "owner") assert.equal((preset.permissions as readonly string[]).includes("organisation.service.manage"), false);
  }
});

test("financial and salary permissions remain separated by preset", () => {
  assert.equal((rolePresets.accountant.permissions as readonly string[]).includes("finance.payment.create"), true);
  assert.equal((rolePresets.sales.permissions as readonly string[]).includes("finance.payment.create"), false);
  assert.equal((rolePresets.hr.permissions as readonly string[]).includes("payroll.salary.view"), true);
  assert.equal((rolePresets.staff.permissions as readonly string[]).includes("payroll.salary.view"), false);
});
