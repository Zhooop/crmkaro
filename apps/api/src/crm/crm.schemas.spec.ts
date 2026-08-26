import assert from "node:assert/strict";
import test from "node:test";
import { pipelineSchema } from "./crm.schemas.js";

test("pipeline requires exactly one converted and one lost stage", () => {
  const valid = pipelineSchema.safeParse({ name: "Sales", stages: [
    { name: "New", colour: "#3B82F6" },
    { name: "Won", colour: "#16A34A", isConverted: true },
    { name: "Lost", colour: "#DC4C64", isLost: true },
  ] });
  assert.equal(valid.success, true);
  const invalid = pipelineSchema.safeParse({ name: "Sales", stages: [
    { name: "New", colour: "#3B82F6" }, { name: "Done", colour: "#16A34A" },
  ] });
  assert.equal(invalid.success, false);
});
