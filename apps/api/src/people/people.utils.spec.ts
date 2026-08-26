import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, normaliseEmail, normalisePhone, parseCsv } from "./people.utils.js";

test("normalises email and phone for duplicate matching", () => {
  assert.equal(normaliseEmail(" User@Example.COM "), "user@example.com");
  assert.equal(normalisePhone("+91 98765-43210"), "+919876543210");
});

test("parses quoted CSV fields", () => {
  assert.deepEqual(parseCsv('name,notes\r\n"Sharma, Ana","Said ""hello"""'), [["name", "notes"], ["Sharma, Ana", 'Said "hello"']]);
});

test("neutralises spreadsheet formula injection", () => {
  assert.equal(csvCell("=HYPERLINK(\"bad\")"), '"\'=HYPERLINK(""bad"")"');
});
