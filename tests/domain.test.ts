import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  dashboardCounts,
  resolveAssetQr,
  repairStages,
} from "../lib/domain";
import { seedDemo } from "../lib/demo";

test("seed is repeatable and contains fictional scenario prerequisites", () => {
  const s = seedDemo();
  assert.equal(s.assets.length, 12);
  assert.equal(s.employees.length, 5);
  assert.equal(s.vendors.length, 2);
  assert.deepEqual(seedDemo(s), s);
  assert.equal(s.assets[0].assetName, "Dell Latitude 5440");
  assert.equal(dashboardCounts(s).total, 12);
});
test("complete Dell QR → Rahul → battery repair → return lifecycle without duplicate events", () => {
  let s = seedDemo();
  const a = s.assets[0];
  const run = (c: unknown, key: string) => {
    s = applyCommand(s, c, key, "IT administrator");
  };
  run({ type: "qr.generate", assetId: a.id }, "test-qr-0001");
  run({ type: "qr.generate", assetId: a.id }, "test-qr-0002");
  assert.equal(
    s.events.filter((e) => e.assetId === a.id && e.eventType === "QR Generated")
      .length,
    1,
  );
  const assign = {
    type: "asset.assign",
    assetId: a.id,
    employeeId: "emp-rahul",
    notes: "",
  };
  run(assign, "test-assign-1");
  const prior = structuredClone(s);
  run(assign, "test-assign-1");
  assert.deepEqual(s, prior);
  run(
    {
      type: "repair.create",
      assetId: a.id,
      issue: "Battery no longer holds charge",
      reportedOn: "2026-11-10",
      vendorId: "demo-vendor-0",
      estimatedCost: 3500,
      notes: "Battery replacement",
    },
    "test-repair-1",
  );
  assert.equal(s.assets[0].status, "under_maintenance");
  assert.equal(s.assets[0].employeeId, "emp-rahul");
  for (const stage of repairStages.slice(1))
    run(
      {
        type: "repair.advance",
        repairId: "test-repair-1",
        status: stage,
        actualCost: 3200,
        notes: "Battery replaced and verified",
      },
      `test-stage-${stage.replaceAll(" ", "-")}`,
    );
  assert.equal(s.assets[0].status, "allocated");
  assert.equal(s.assets[0].conditionStatus, "repaired");
  run(
    {
      type: "asset.return",
      assetId: a.id,
      notes: "Received in working condition",
    },
    "test-return-1",
  );
  assert.equal(s.assets[0].status, "available");
  assert.equal(s.assets[0].employeeId, null);
  assert.deepEqual(
    s.events.filter((e) => e.assetId === a.id).map((e) => e.eventType),
    [
      "Asset Created",
      "QR Generated",
      "Asset Assigned",
      "Damage Reported",
      "Sent to Vendor",
      "Under Repair",
      "Repair Completed",
      "Returned from Repair",
      "Asset Returned",
    ],
  );
  assert.equal(
    s.repairs.find((r) => r.id === "test-repair-1")?.actualCost,
    3200,
  );
  run(
    { type: "asset.retire", assetId: a.id, notes: "End of service" },
    "test-retire-1",
  );
  assert.equal(s.assets[0].status, "retired");
});
test("validation rejects invalid references, duplicate serials, costs and dates", () => {
  const s = seedDemo();
  const create = {
    type: "asset.create",
    assetName: "New laptop",
    assetCategoryId: s.categories[0].id,
    serialNumber: s.assets[0].serialNumber,
    vendorId: s.vendors[0].id,
    purchaseOrRentalPrice: 500,
    procuredOn: "2026-10-01",
  };
  assert.throws(
    () => applyCommand(s, create, "test-create-1", "Admin"),
    /Serial number already exists/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { ...create, serialNumber: "unique", vendorId: "no-vendor" },
        "test-create-1",
        "Admin",
      ),
    /existing vendor/,
  );
  assert.throws(() =>
    applyCommand(
      s,
      { ...create, purchaseOrRentalPrice: -1 },
      "test-create-1",
      "Admin",
    ),
  );
  assert.throws(() =>
    applyCommand(
      s,
      { ...create, procuredOn: "2026-02-30" },
      "test-create-1",
      "Admin",
    ),
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "asset.assign", assetId: "missing", employeeId: "emp-rahul" },
        "test-assign-1",
        "Admin",
      ),
    /not found/,
  );
});
test("repair transitions and asset state invariants are enforced", () => {
  const s = seedDemo();
  const a = s.assets.find((x) => x.id === "demo-asset-007")!;
  const attempt = (c: unknown) => applyCommand(s, c, "test-invalid-1", "Admin");
  assert.throws(
    () =>
      attempt({
        type: "repair.create",
        assetId: a.id,
        issue: "Second damage",
        reportedOn: "2026-11-10",
        vendorId: s.vendors[0].id,
        estimatedCost: 1,
      }),
    /open repair/,
  );
  assert.throws(
    () =>
      attempt({
        type: "repair.advance",
        repairId: "demo-repair-007",
        status: "Repaired",
        actualCost: 1,
      }),
    /one stage/,
  );
  assert.throws(
    () =>
      attempt({ type: "asset.assign", assetId: a.id, employeeId: "emp-rahul" }),
    /current state/,
  );
  assert.throws(
    () => attempt({ type: "asset.retire", assetId: a.id, notes: "Retirement" }),
    /finish repairs/,
  );
  assert.throws(
    () => attempt({ type: "asset.return", assetId: s.assets[0].id }),
    /assigned asset/,
  );
  let next = applyCommand(
    s,
    {
      type: "repair.advance",
      repairId: "demo-repair-007",
      status: "Sent to Vendor",
      actualCost: null,
    },
    "test-stage-001",
    "Admin",
  );
  next = applyCommand(
    next,
    {
      type: "repair.advance",
      repairId: "demo-repair-007",
      status: "Under Repair",
      actualCost: null,
    },
    "test-stage-002",
    "Admin",
  );
  assert.throws(
    () =>
      applyCommand(
        next,
        {
          type: "repair.advance",
          repairId: "demo-repair-007",
          status: "Repaired",
          actualCost: null,
        },
        "test-stage-003",
        "Admin",
      ),
    /Actual repair cost/,
  );
});
test("transfers close prior allocations and preserve history", () => {
  let s = seedDemo();
  const a = s.assets[1];
  s = applyCommand(
    s,
    {
      type: "asset.assign",
      assetId: a.id,
      employeeId: "emp-vikram",
      notes: "Team transfer",
    },
    "test-transfer-01",
    "Admin",
  );
  assert.equal(
    s.allocations.filter((x) => x.assetId === a.id && x.status === "active")
      .length,
    1,
  );
  assert.equal(
    s.allocations.find((x) => x.assetId === a.id && x.status === "replaced")
      ?.actualReturnDate !== null,
    true,
  );
  assert.equal(s.events.at(-1)?.eventType, "Asset Transferred");
});
test("category counters and uniqueness remain governed", () => {
  const s = seedDemo();
  const snapshot = structuredClone(s);
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "category.save", categoryName: "Other", categoryCode: "LAP" },
        "test-category-1",
        "Admin",
      ),
    /already exists/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "category.save",
          id: s.categories[0].id,
          categoryName: "Laptops",
          categoryCode: "NEW",
        },
        "test-category-1",
        "Admin",
      ),
    /locked/,
  );
  assert.deepEqual(s, snapshot);
});
test("invalid, external and non-asset QR payloads never navigate", () => {
  const origin = "https://demo.example";
  assert.equal(
    resolveAssetQr(`${origin}/assets/opaque-123`, origin),
    "/assets/opaque-123",
  );
  for (const input of [
    "javascript:alert(1)",
    "https://evil.example/assets/a",
    "garbage",
    `${origin}/api/state`,
    `${origin}/assets/a?x=1`,
    `${origin}/assets/a#foo`,
  ])
    assert.throws(() => resolveAssetQr(input, origin));
});
