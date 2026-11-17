import { z } from "zod";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../shared/errors/index";

export type AssetStatus =
  "available" | "allocated" | "under_maintenance" | "retired";
export const repairStages = [
  "Reported",
  "Sent to Vendor",
  "Under Repair",
  "Repaired",
  "Returned",
] as const;
export type RepairStage = (typeof repairStages)[number];
export type Asset = {
  id: string;
  assetName: string;
  assetCode: string;
  assetCategoryId: string;
  serialNumber: string;
  vendorId: string;
  purchaseOrRentalPrice: number;
  procuredOn: string;
  status: AssetStatus;
  conditionStatus: "working" | "not_working" | "repaired";
  employeeId: string | null;
  qrGeneratedAt: string | null;
  createdAt: string;
};
export type Category = {
  id: string;
  categoryName: string;
  categoryCode: string;
  counterNextValue: number;
};
export type Vendor = {
  id: string;
  vendorName: string;
  vendorCode: string;
  email: string;
  phone: string;
};
export type Employee = { id: string; displayName: string; department: string };
export type HistoryEvent = {
  id: string;
  assetId: string;
  eventType: string;
  eventAt: string;
  actor: string;
  notes: string;
};
export type Allocation = {
  id: string;
  assetId: string;
  employeeId: string;
  allocationDate: string;
  actualReturnDate: string | null;
  status: "active" | "returned" | "replaced";
};
export type Repair = {
  id: string;
  assetId: string;
  issue: string;
  reportedOn: string;
  vendorId: string;
  estimatedCost: number;
  actualCost: number | null;
  notes: string;
  status: RepairStage;
  createdAt: string;
};
export type State = {
  version: number;
  assets: Asset[];
  categories: Category[];
  vendors: Vendor[];
  employees: Employee[];
  allocations: Allocation[];
  repairs: Repair[];
  events: HistoryEvent[];
  processed: string[];
};
export const emptyState = (): State => ({
  version: 0,
  assets: [],
  categories: [],
  vendors: [],
  employees: [],
  allocations: [],
  repairs: [],
  events: [],
  processed: [],
});
const id = z.string().min(1).max(100);
const text = z.string().trim().min(2).max(160);
const notes = z.string().trim().max(1500).default("");
const money = z.number().finite().min(0).max(999_999_999);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  )
  .refine(
    (v) =>
      v <= new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
    "Date cannot be in the future",
  );
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("asset.create"),
    assetName: text,
    assetCategoryId: id,
    serialNumber: z.string().trim().min(1).max(120),
    vendorId: id,
    purchaseOrRentalPrice: money,
    procuredOn: date,
  }),
  z.object({
    type: z.literal("asset.edit"),
    assetId: id,
    assetName: text,
    serialNumber: z.string().trim().min(1).max(120),
    vendorId: id,
    purchaseOrRentalPrice: money,
    procuredOn: date,
  }),
  z.object({
    type: z.literal("category.save"),
    id: id.optional(),
    categoryName: text,
    categoryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,16}$/),
  }),
  z.object({
    type: z.literal("vendor.save"),
    id: id.optional(),
    vendorName: text,
    vendorCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,20}$/),
    email: z.union([z.literal(""), z.email()]),
    phone: z.string().trim().max(30),
  }),
  z.object({
    type: z.literal("asset.assign"),
    assetId: id,
    employeeId: id,
    notes,
  }),
  z.object({ type: z.literal("asset.return"), assetId: id, notes }),
  z.object({
    type: z.literal("asset.retire"),
    assetId: id,
    notes: z.string().trim().min(3).max(1500),
  }),
  z.object({ type: z.literal("qr.generate"), assetId: id }),
  z.object({
    type: z.literal("repair.create"),
    assetId: id,
    issue: z.string().trim().min(5).max(1500),
    reportedOn: date,
    vendorId: id,
    estimatedCost: money,
    notes,
  }),
  z.object({
    type: z.literal("repair.advance"),
    repairId: id,
    status: z.enum(repairStages),
    actualCost: money.nullable(),
    notes,
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export function applyCommand(
  state: State,
  raw: unknown,
  key: string,
  actor: string,
  now = new Date().toISOString(),
): State {
  if (!/^[\w-]{8,100}$/.test(key))
    throw new ValidationError("A valid idempotency key is required");
  const c = commandSchema.parse(raw);
  if (state.processed.includes(key)) return state;
  const s = structuredClone(state);
  const event = (assetId: string, eventType: string, detail = "") =>
    s.events.push({
      id: `${key}-${s.events.length}`,
      assetId,
      eventType,
      eventAt: now,
      actor,
      notes: detail,
    });
  const asset = (assetId: string) => {
    const a = s.assets.find((a) => a.id === assetId);
    if (!a) throw new NotFoundError("Asset");
    return a;
  };
  const vendor = (vendorId: string) => {
    if (!s.vendors.some((v) => v.id === vendorId))
      throw new ValidationError("Select an existing vendor");
  };
  const activeRepair = (assetId: string) =>
    s.repairs.some((r) => r.assetId === assetId && r.status !== "Returned");
  if (c.type === "asset.create") {
    const category = s.categories.find((x) => x.id === c.assetCategoryId);
    if (!category) throw new ValidationError("Select an existing category");
    vendor(c.vendorId);
    if (
      s.assets.some(
        (a) => a.serialNumber.toLowerCase() === c.serialNumber.toLowerCase(),
      )
    )
      throw new ConflictError("Serial number already exists");
    const assetCode = `${category.categoryCode}/${String(category.counterNextValue++).padStart(4, "0")}`;
    s.assets.push({
      ...c,
      id: key,
      assetCode,
      status: "available",
      conditionStatus: "working",
      employeeId: null,
      qrGeneratedAt: null,
      createdAt: now,
    });
    event(key, "Asset Created", assetCode);
  } else if (c.type === "asset.edit") {
    const a = asset(c.assetId);
    vendor(c.vendorId);
    if (
      s.assets.some(
        (x) =>
          x.id !== a.id &&
          x.serialNumber.toLowerCase() === c.serialNumber.toLowerCase(),
      )
    )
      throw new ConflictError("Serial number already exists");
    Object.assign(a, {
      assetName: c.assetName,
      serialNumber: c.serialNumber,
      vendorId: c.vendorId,
      purchaseOrRentalPrice: c.purchaseOrRentalPrice,
      procuredOn: c.procuredOn,
    });
    event(a.id, "Asset Updated");
  } else if (c.type === "category.save") {
    const existing = c.id ? s.categories.find((x) => x.id === c.id) : undefined;
    if (c.id && !existing) throw new NotFoundError("Category");
    if (
      s.categories.some(
        (x) =>
          x.id !== c.id &&
          (x.categoryCode === c.categoryCode ||
            x.categoryName.toLowerCase() === c.categoryName.toLowerCase()),
      )
    )
      throw new ConflictError("Category name or code already exists");
    if (
      existing &&
      existing.categoryCode !== c.categoryCode &&
      s.assets.some((a) => a.assetCategoryId === c.id)
    )
      throw new ConflictError("Category code is locked after use");
    if (existing) Object.assign(existing, c);
    else
      s.categories.push({
        id: key,
        categoryName: c.categoryName,
        categoryCode: c.categoryCode,
        counterNextValue: 1,
      });
  } else if (c.type === "vendor.save") {
    const existing = c.id ? s.vendors.find((x) => x.id === c.id) : undefined;
    if (c.id && !existing) throw new NotFoundError("Vendor");
    if (
      s.vendors.some(
        (x) =>
          x.id !== c.id &&
          (x.vendorCode === c.vendorCode ||
            x.vendorName.toLowerCase() === c.vendorName.toLowerCase()),
      )
    )
      throw new ConflictError("Vendor name or code already exists");
    if (existing) Object.assign(existing, c);
    else s.vendors.push({ ...c, id: key });
  } else if (c.type === "asset.assign") {
    const a = asset(c.assetId);
    const e = s.employees.find((e) => e.id === c.employeeId);
    if (!e) throw new ValidationError("Select an existing employee");
    if (!["available", "allocated"].includes(a.status) || activeRepair(a.id))
      throw new ConflictError("Asset cannot be allocated in its current state");
    if (a.employeeId === e.id)
      throw new ConflictError("Asset already assigned to this employee");
    const transfer = !!a.employeeId;
    s.allocations
      .filter((x) => x.assetId === a.id && x.status === "active")
      .forEach((x) => {
        x.status = "replaced";
        x.actualReturnDate = now;
      });
    s.allocations.push({
      id: key,
      assetId: a.id,
      employeeId: e.id,
      allocationDate: now,
      actualReturnDate: null,
      status: "active",
    });
    a.employeeId = e.id;
    a.status = "allocated";
    event(
      a.id,
      transfer ? "Asset Transferred" : "Asset Assigned",
      `${e.displayName}${c.notes ? ` · ${c.notes}` : ""}`,
    );
  } else if (c.type === "asset.return") {
    const a = asset(c.assetId);
    if (!a.employeeId || activeRepair(a.id))
      throw new ConflictError(
        "Return requires an assigned asset with no open repair",
      );
    s.allocations
      .filter((x) => x.assetId === a.id && x.status === "active")
      .forEach((x) => {
        x.status = "returned";
        x.actualReturnDate = now;
      });
    a.employeeId = null;
    a.status = "available";
    event(a.id, "Asset Returned", c.notes);
  } else if (c.type === "asset.retire") {
    const a = asset(c.assetId);
    if (a.status !== "available" || activeRepair(a.id))
      throw new ConflictError(
        "Return the asset and finish repairs before retiring",
      );
    a.status = "retired";
    event(a.id, "Asset Retired", c.notes);
  } else if (c.type === "qr.generate") {
    const a = asset(c.assetId);
    if (!a.qrGeneratedAt) {
      a.qrGeneratedAt = now;
      event(a.id, "QR Generated");
    }
  } else if (c.type === "repair.create") {
    const a = asset(c.assetId);
    vendor(c.vendorId);
    if (a.status === "retired" || activeRepair(a.id))
      throw new ConflictError("Asset is retired or already has an open repair");
    if (c.reportedOn < a.procuredOn)
      throw new ValidationError("Damage date cannot precede procurement");
    s.repairs.push({
      ...c,
      id: key,
      status: "Reported",
      actualCost: null,
      createdAt: now,
    });
    a.status = "under_maintenance";
    a.conditionStatus = "not_working";
    event(a.id, "Damage Reported", c.issue);
  } else if (c.type === "repair.advance") {
    const r = s.repairs.find((r) => r.id === c.repairId);
    if (!r) throw new NotFoundError("Repair");
    if (repairStages.indexOf(c.status) !== repairStages.indexOf(r.status) + 1)
      throw new ConflictError("Repair must advance one stage at a time");
    if (["Repaired", "Returned"].includes(c.status) && c.actualCost === null)
      throw new ValidationError("Actual repair cost is required");
    r.status = c.status;
    r.actualCost = c.actualCost;
    r.notes = c.notes;
    const a = asset(r.assetId);
    if (c.status === "Repaired") a.conditionStatus = "repaired";
    if (c.status === "Returned") {
      a.status = a.employeeId ? "allocated" : "available";
      a.conditionStatus = "repaired";
    }
    event(
      a.id,
      c.status === "Repaired"
        ? "Repair Completed"
        : c.status === "Returned"
          ? "Returned from Repair"
          : c.status,
      `${c.notes}${c.actualCost !== null ? ` · ₹${c.actualCost}` : ""}`,
    );
  }
  s.version++;
  s.processed.push(key);
  return s;
}
export function dashboardCounts(s: State) {
  return {
    total: s.assets.length,
    assigned: s.assets.filter((a) => a.employeeId).length,
    available: s.assets.filter((a) => a.status === "available").length,
    damaged: s.assets.filter((a) => a.conditionStatus === "not_working").length,
    maintenance: s.assets.filter((a) => a.status === "under_maintenance")
      .length,
  };
}
export function resolveAssetQr(value: string, origin: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Invalid QR. Scan an asset label generated by this application.",
    );
  }
  if (
    url.origin !== origin ||
    !/^\/assets\/[\w-]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error("This QR does not belong to this asset system.");
  return url.pathname;
}
