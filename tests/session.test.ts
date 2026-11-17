import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serializeSessionCookie,
  parseSessionCookie,
  getSessionCookieName,
} from "../modules/auth-session/session-cookie";
import type { AppSession } from "../modules/auth-session/types";
test("reused signed sessions reject tampering and ambiguous formats", async () => {
  const session: AppSession = {
    scope: "tenant",
    userId: "test-user",
    tenantId: "test-tenant",
    membershipId: "test-member",
    role: "tenant_admin",
    email: "admin@example.test",
    displayName: "Test Admin",
  };
  const value = await serializeSessionCookie(session);
  assert.deepEqual(await parseSessionCookie(value), session);
  await assert.rejects(() => parseSessionCookie(`${value}junk`));
  await assert.rejects(() => parseSessionCookie(`${value}.extra`));
  await assert.rejects(() => parseSessionCookie("invalid"));
  assert.equal(getSessionCookieName(), "ams_session");
});
