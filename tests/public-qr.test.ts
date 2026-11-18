import { test } from "node:test";
import assert from "node:assert/strict";
import { newQrToken, qrTokenHash } from "../lib/qr-token";
import { QR_TOKEN_PATTERN, publicAssetCard } from "../lib/public-asset";
import { applyCommand } from "../lib/domain";
import { seedDemo } from "../lib/demo";

test("public QR tokens are random, 256-bit values and lookup keys are hashes", () => {
  const tokens = Array.from({ length: 100 }, newQrToken);
  assert.equal(new Set(tokens).size, 100);
  for (const token of tokens) {
    assert.match(token, QR_TOKEN_PATTERN);
    assert.equal(Buffer.from(token, "base64url").length, 32);
    assert.match(qrTokenHash(token), /^[a-f0-9]{64}$/);
    assert.notEqual(qrTokenHash(token), token);
  }
});
test("public projection includes only approved asset fields and no internal IDs", () => {
  const s = seedDemo();
  const a = s.assets[0];
  Object.assign(a, {
    employeeId: "private-employee",
    purchaseOrRentalPrice: 72000,
    internalNotes: "PRIVATE NOTES",
    email: "private@example.test",
    qrToken: newQrToken(),
  });
  const card = publicAssetCard(s, a);
  assert.deepEqual(Object.keys(card).sort(), [
    "assetId",
    "brand",
    "category",
    "condition",
    "model",
    "name",
    "status",
  ]);
  assert.equal(card.assetId, a.assetCode);
  assert.notEqual(card.assetId, a.id);
  assert.equal(card.brand, "Dell");
  assert.equal(card.model, "Latitude 5440");
  for (const secret of [
    "private-employee",
    "PRIVATE NOTES",
    "private@example.test",
    a.qrToken!,
    a.id,
    "72000",
  ])
    assert.equal(JSON.stringify(card).includes(secret), false);
});
test("generate is idempotent, rotation replaces the token, and revocation removes access", () => {
  let s = seedDemo();
  const assetId = s.assets[0].id;
  const first = newQrToken();
  const second = newQrToken();
  s = applyCommand(
    s,
    { type: "qr.generate", assetId, qrToken: "client-chosen-token" },
    "public-qr-generate",
    "Admin",
    undefined,
    { qrToken: first },
  );
  assert.equal(s.assets[0].qrToken, first);
  s = applyCommand(
    s,
    { type: "qr.generate", assetId },
    "public-qr-generate-again",
    "Admin",
    undefined,
    { qrToken: newQrToken() },
  );
  assert.equal(s.assets[0].qrToken, first);
  assert.equal(
    s.events.filter(
      (e) => e.eventType === "QR Generated" && e.assetId === assetId,
    ).length,
    1,
  );
  s = applyCommand(
    s,
    { type: "qr.regenerate", assetId },
    "public-qr-regenerate",
    "Admin",
    undefined,
    { qrToken: second },
  );
  assert.equal(s.assets[0].qrToken, second);
  s = applyCommand(
    s,
    { type: "qr.revoke", assetId },
    "public-qr-revoke",
    "Admin",
  );
  assert.equal(s.assets[0].qrToken, null);
  assert.ok(s.assets[0].qrRevokedAt);
  const count = s.events.length;
  s = applyCommand(
    s,
    { type: "qr.revoke", assetId },
    "public-qr-revoke-again",
    "Admin",
  );
  assert.equal(s.events.length, count);
  s = applyCommand(
    s,
    { type: "qr.generate", assetId },
    "public-qr-enable",
    "Admin",
    undefined,
    { qrToken: newQrToken() },
  );
  assert.ok(s.assets[0].qrToken);
  assert.equal(s.assets[0].qrRevokedAt, null);
});
test("token generation is server controlled and legacy labels can be replaced without duplicate history", () => {
  let s = seedDemo();
  const assetId = s.assets[0].id;
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "qr.generate", assetId },
        "missing-token-request",
        "Admin",
      ),
    /server-generated/,
  );
  s.assets[0].qrGeneratedAt = "2026-11-10T10:00:00Z";
  s = applyCommand(
    s,
    { type: "qr.generate", assetId },
    "legacy-token-request",
    "Admin",
    undefined,
    { qrToken: newQrToken() },
  );
  assert.equal(s.events.at(-1)?.eventType, "QR Link Regenerated");
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "qr.generate", assetId: s.assets[1].id },
        "duplicate-token-request",
        "Admin",
        undefined,
        { qrToken: s.assets[0].qrToken! },
      ),
    /collision/,
  );
});
