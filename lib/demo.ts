import { applyCommand, emptyState, type State } from "./domain";
export function seedDemo(existing: State = emptyState()): State {
  let s = structuredClone(existing);
  if (!s.employees.length)
    s.employees = [
      {
        id: "emp-rahul",
        displayName: "Rahul Sharma",
        department: "Engineering",
      },
      { id: "emp-priya", displayName: "Priya Mehta", department: "Design" },
      { id: "emp-arjun", displayName: "Arjun Patel", department: "Operations" },
      { id: "emp-neha", displayName: "Neha Kapoor", department: "Finance" },
      {
        id: "emp-vikram",
        displayName: "Vikram Rao",
        department: "Engineering",
      },
    ];
  const run = (c: unknown, key: string) => {
    s = applyCommand(
      s,
      c,
      key,
      "Demo administrator",
      "2026-11-10T09:00:00.000Z",
    );
  };
  [
    ["Laptops", "LAP"],
    ["Monitors", "MON"],
    ["Peripherals", "PER"],
    ["Networking", "NET"],
  ].forEach(([categoryName, categoryCode], i) =>
    run(
      { type: "category.save", categoryName, categoryCode },
      `demo-category-${i}`,
    ),
  );
  ["ABC Technologies", "Nova IT Supplies"].forEach((vendorName, i) =>
    run(
      {
        type: "vendor.save",
        vendorName,
        vendorCode: `V00${i + 1}`,
        email: i ? "hello@nova.example" : "support@abc.example",
        phone: i ? "+91 55500 00202" : "+91 55500 00101",
      },
      `demo-vendor-${i}`,
    ),
  );
  const names = [
    "Dell Latitude 5440",
    "MacBook Air M2",
    "Lenovo ThinkPad E14",
    "HP ProBook 440",
    "Dell UltraSharp 27",
    "LG UltraFine 24",
    "Samsung ViewFinity",
    "Logitech MX Keys",
    "Logitech MX Master 3",
    "Poly Blackwire 5220",
    "Cisco Business Switch",
    "TP-Link Archer AX55",
  ];
  names.forEach((assetName, i) =>
    run(
      {
        type: "asset.create",
        assetName,
        manufacturer: assetName.split(" ")[0],
        model: assetName.split(" ").slice(1).join(" "),
        assetCategoryId: `demo-category-${i < 4 ? 0 : i < 7 ? 1 : i < 10 ? 2 : 3}`,
        serialNumber: `DEMO-${String(i + 1).padStart(5, "0")}`,
        vendorId: `demo-vendor-${i % 2}`,
        purchaseOrRentalPrice: [
          72000, 98000, 65000, 58000, 32000, 18000, 24000, 9500, 8500, 6500,
          22000, 7500,
        ][i],
        procuredOn: "2026-10-01",
      },
      `demo-asset-${String(i + 1).padStart(3, "0")}`,
    ),
  );
  [1, 2, 3, 4, 7, 8].forEach((i, j) =>
    run(
      {
        type: "asset.assign",
        assetId: `demo-asset-${String(i + 1).padStart(3, "0")}`,
        employeeId: s.employees[j % 5].id,
        notes: "Demonstration allocation",
      },
      `demo-allocation-${i}`,
    ),
  );
  run(
    {
      type: "repair.create",
      assetId: "demo-asset-007",
      issue: "Display flickering during use",
      reportedOn: "2026-11-10",
      vendorId: "demo-vendor-0",
      estimatedCost: 2500,
      notes: "Inspection requested",
    },
    "demo-repair-007",
  );
  return s;
}
