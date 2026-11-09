import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "better-auth/crypto";

test("Better Auth password hash verifies only the supplied password", async () => {
  const password = "Local-Test-Only-Not-A-Real-Secret-2026!";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword({ hash, password }), true);
  assert.equal(await verifyPassword({ hash, password: `${password}wrong` }), false);
});
