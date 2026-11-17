import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readApiResponse, isAssetState } from "../lib/api-response";
import { emptyState } from "../lib/domain";
import { assertRuntimeConfiguration } from "../lib/runtime-config";

test("Firebase Admin loads when CommonJS require(esm) is disabled by the runtime", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--no-experimental-require-module",
      "-e",
      "require('firebase-admin/auth');require('firebase-admin/firestore');",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test("empty, HTML and malformed API responses show actionable errors", async () => {
  await assert.rejects(
    () => readApiResponse(new Response(null, { status: 500 })),
    /empty response \(HTTP 500\)/,
  );
  await assert.rejects(
    () =>
      readApiResponse(new Response("<html>Failure</html>", { status: 502 })),
    /invalid response \(HTTP 502\)/,
  );
  await assert.rejects(
    () => readApiResponse(new Response("{", { status: 200 })),
    /invalid response/,
  );
  await assert.rejects(
    () =>
      readApiResponse(
        Response.json({ error: "Configure Firestore" }, { status: 503 }),
      ),
    /Configure Firestore/,
  );
  assert.deepEqual(await readApiResponse(Response.json({ ok: true })), {
    ok: true,
  });
});
test("unexpected successful responses cannot replace workspace state", () => {
  for (const value of [null, {}, { ok: true }, { version: 1, assets: [] }])
    assert.equal(isAssetState(value), false);
  assert.equal(isAssetState(emptyState()), true);
});
test("Vercel local storage and incomplete cloud configuration fail clearly without filesystem access", () => {
  assert.doesNotThrow(() => assertRuntimeConfiguration({ AMS_STORE: "local" }));
  assert.throws(
    () => assertRuntimeConfiguration({ VERCEL: "1" }),
    /localhost-only/,
  );
  assert.throws(
    () => assertRuntimeConfiguration({ VERCEL: "1", AMS_STORE: "firestore" }),
    /FIREBASE_PROJECT_ID/,
  );
  const env = {
    VERCEL: "1",
    AMS_STORE: "firestore",
    FIREBASE_PROJECT_ID: "separate-demo",
    AMS_FIREBASE_PROJECT_CONFIRM: "separate-demo",
    SESSION_SECRET: "x".repeat(32),
    FIREBASE_ADMIN_CLIENT_EMAIL: "demo@example.test",
    FIREBASE_ADMIN_PRIVATE_KEY: "configured-separately",
  };
  assert.doesNotThrow(() => assertRuntimeConfiguration(env));
  assert.throws(
    () => assertRuntimeConfiguration({ ...env, SESSION_SECRET: "short" }),
    /32 characters/,
  );
  assert.throws(
    () =>
      assertRuntimeConfiguration({
        ...env,
        AMS_FIREBASE_PROJECT_CONFIRM: "other",
      }),
    /same separate demo project/,
  );
  assert.throws(
    () =>
      assertRuntimeConfiguration({
        ...env,
        FIRESTORE_EMULATOR_HOST: "localhost:8080",
      }),
    /Remove emulator/,
  );
});
