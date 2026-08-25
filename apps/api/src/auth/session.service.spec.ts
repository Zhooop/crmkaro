import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashToken } from "./session.service.js";

describe("hashToken", () => {
  it("creates a deterministic SHA-256 digest without retaining the session token", () => {
    const token = "private-session-token";
    const digest = hashToken(token);

    assert.equal(digest.length, 64);
    assert.equal(digest, hashToken(token));
    assert.notEqual(digest, token);
    assert.notEqual(digest, hashToken(`${token}-different`));
  });
});
