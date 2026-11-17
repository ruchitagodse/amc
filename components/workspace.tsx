"use client";
/* Focused AMS workspace using the source HRMS primitives and CSV utilities. */
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { readApiResponse, isAssetState } from "@/lib/api-response";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Boxes,
  LayoutDashboard,
  Package,
  Tags,
  Building2,
  Users,
  History,
  Wrench,
  ScanLine,
  Search,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Download,
  RefreshCw,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Laptop,
  Monitor,
  Headphones,
  Network,
  CheckCircle2,
  Printer,
  QrCode,
  CircleDot,
  ShieldCheck,
} from "lucide-react";
import { StatCard } from "@/components/ui/workspace-primitives";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  buildCsv,
  triggerCsvDownload,
} from "@/components/tenant/master-export-utils";
import {
  dashboardCounts,
  repairStages,
  type State,
  type Asset,
  type Category,
  type Vendor,
  type Repair,
} from "@/lib/domain";
import { Scanner } from "./scanner";

export type View =
  | "dashboard"
  | "inventory"
  | "categories"
  | "vendors"
  | "allocations"
  | "history"
  | "repairs"
  | "detail"
  | "scan";
const nav = [
  { key: "dashboard", url: "/", name: "Overview", icon: LayoutDashboard },
  { key: "inventory", url: "/inventory", name: "Asset Master", icon: Package },
  {
    key: "categories",
    url: "/categories",
    name: "Category Master",
    icon: Tags,
  },
  { key: "vendors", url: "/vendors", name: "Vendor Master", icon: Building2 },
  {
    key: "allocations",
    url: "/allocations",
    name: "Employee Allocation",
    icon: Users,
  },
  { key: "repairs", url: "/repairs", name: "Damage & Repairs", icon: Wrench },
  { key: "history", url: "/history", name: "Asset History", icon: History },
  { key: "scan", url: "/scan", name: "Scan QR Code", icon: ScanLine },
] as const;
const descriptions: Record<View, [string, string]> = {
  dashboard: [
    "Asset overview",
    "A clear picture of your assets, all in one place.",
  ],
  inventory: [
    "Asset Master",
    "Track, organize and manage your complete inventory.",
  ],
  categories: [
    "Category Master",
    "Keep your assets organized with governed category codes.",
  ],
  vendors: [
    "Vendor Master",
    "Your trusted partners for equipment and repairs.",
  ],
  allocations: [
    "Employee Allocation",
    "See who has what. Assign, transfer and return assets.",
  ],
  repairs: [
    "Damage & Repairs",
    "Keep every issue, vendor handoff and repair on track.",
  ],
  history: [
    "Asset History",
    "A complete record of every change across your inventory.",
  ],
  detail: [
    "Asset details",
    "Identity, ownership and the complete asset lifecycle.",
  ],
  scan: ["Scan QR Code", "Find the right asset in a single scan."],
};
const currency = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
const date = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase().replaceAll(" ", "-")}`}>
      <i />
      {(
        {
          allocated: "Assigned",
          available: "Available",
          under_maintenance: "Maintenance",
          retired: "Retired",
        } as Record<string, string>
      )[status] || status}
    </span>
  );
}
function AssetIcon({ category }: { category: string }) {
  const Icon = category.includes("Laptop")
    ? Laptop
    : category.includes("Monitor")
      ? Monitor
      : category.includes("Network")
        ? Network
        : Headphones;
  return (
    <span className="asset-icon">
      <Icon size={20} />
    </span>
  );
}
function Empty({
  title = "No records yet",
  description = "New records will appear here.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <Package size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
type Modal =
  | { kind: "asset"; asset?: Asset }
  | { kind: "category"; category?: Category }
  | { kind: "vendor"; vendor?: Vendor }
  | { kind: "assign"; asset: Asset }
  | { kind: "return"; asset: Asset }
  | { kind: "retire"; asset: Asset }
  | { kind: "repair"; asset?: Asset }
  | { kind: "advance"; repair: Repair };
function Field({
  label,
  name,
  value,
  type = "text",
  required = true,
  children,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <label>
      {label}
      {children ? (
        <select
          aria-label={label}
          name={name}
          defaultValue={value || ""}
          required={required}
        >
          {children}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          min={type === "number" ? 0 : undefined}
          step={type === "number" ? "0.01" : undefined}
          maxLength={type === "text" ? 160 : undefined}
        />
      )}
    </label>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="form-dialog" onCancel={onClose}>
      <div className="dialog-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Workspace({ view, assetId }: { view: View; assetId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [mode, setMode] = useState("local");
  const [lastSync, setLastSync] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.status === 401) {
        location.replace(
          `/login?next=${encodeURIComponent(location.pathname)}`,
        );
        return;
      }
      const data = await readApiResponse<unknown>(response);
      if (!isAssetState(data))
        throw new Error(
          "The server returned unexpected asset data. Check deployment configuration and try again.",
        );
      setState(data);
      setLastSync(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load assets");
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
      void fetch("/api/session")
        .then((r) => readApiResponse<{ mode?: string }>(r))
        .then((s) => {
          if (s.mode) setMode(s.mode);
        })
        .catch(() => {
          /* The state request displays the actionable error. */
        });
    }, 0);
    const interval = setInterval(() => void load(), 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [load]);
  async function command(c: unknown, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: c, key: crypto.randomUUID() }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!isAssetState(result))
        throw new Error(
          "The server returned unexpected asset data. Refresh before retrying.",
        );
      setState(result);
      setSuccess(message);
      setModal(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(form: FormData) {
    if (!modal || !state) return;
    const values = Object.fromEntries(form.entries());
    const str = (k: string) => String(values[k] || "");
    const num = (k: string) => Number(values[k]);
    if (modal.kind === "asset")
      await command(
        {
          type: modal.asset ? "asset.edit" : "asset.create",
          ...(modal.asset ? { assetId: modal.asset.id } : {}),
          assetName: str("assetName"),
          assetCategoryId: str("assetCategoryId"),
          serialNumber: str("serialNumber"),
          vendorId: str("vendorId"),
          purchaseOrRentalPrice: num("purchaseOrRentalPrice"),
          procuredOn: str("procuredOn"),
        },
        "Asset saved successfully.",
      );
    else if (modal.kind === "category")
      await command(
        {
          type: "category.save",
          id: modal.category?.id,
          categoryName: str("categoryName"),
          categoryCode: str("categoryCode"),
        },
        "Category saved successfully.",
      );
    else if (modal.kind === "vendor")
      await command(
        {
          type: "vendor.save",
          id: modal.vendor?.id,
          vendorName: str("vendorName"),
          vendorCode: str("vendorCode"),
          email: str("email"),
          phone: str("phone"),
        },
        "Vendor saved successfully.",
      );
    else if (modal.kind === "assign")
      await command(
        {
          type: "asset.assign",
          assetId: modal.asset.id,
          employeeId: str("employeeId"),
          notes: str("notes"),
        },
        modal.asset.employeeId
          ? "Asset transferred successfully."
          : "Asset assigned successfully.",
      );
    else if (modal.kind === "return")
      await command(
        { type: "asset.return", assetId: modal.asset.id, notes: str("notes") },
        "Asset returned to inventory.",
      );
    else if (modal.kind === "repair")
      await command(
        {
          type: "repair.create",
          assetId: modal.asset?.id || str("assetId"),
          issue: str("issue"),
          reportedOn: str("reportedOn"),
          vendorId: str("vendorId"),
          estimatedCost: num("estimatedCost"),
          notes: str("notes"),
        },
        "Damage reported. Repair record created.",
      );
    else if (modal.kind === "advance")
      await command(
        {
          type: "repair.advance",
          repairId: modal.repair.id,
          status: repairStages[repairStages.indexOf(modal.repair.status) + 1],
          actualCost: str("actualCost") === "" ? null : num("actualCost"),
          notes: str("notes"),
        },
        "Repair status updated.",
      );
  }
  const [title, subtitle] = descriptions[view];
  const counts = state ? dashboardCounts(state) : null;
  const categoryName = (a: Asset) =>
    state?.categories.find((c) => c.id === a.assetCategoryId)?.categoryName ||
    "Uncategorized";
  const employeeName = (a: Asset) =>
    state?.employees.find((e) => e.id === a.employeeId)?.displayName ||
    "Unassigned";
  const vendorName = (id: string) =>
    state?.vendors.find((v) => v.id === id)?.vendorName || "—";
  const filtered =
    state?.assets.filter(
      (a) =>
        (!query ||
          `${a.assetName} ${a.assetCode} ${a.serialNumber} ${employeeName(a)}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (status === "all" || a.status === status) &&
        (category === "all" || a.assetCategoryId === category),
    ) || [];
  const detail = state?.assets.find((a) => a.id === assetId);
  function exportAssets() {
    if (!state) return;
    triggerCsvDownload(
      "asset-inventory.csv",
      buildCsv(
        [
          "Asset code",
          "Asset name",
          "Category",
          "Serial number",
          "Status",
          "Employee",
          "Vendor",
        ],
        filtered.map((a) => [
          a.assetCode,
          a.assetName,
          categoryName(a),
          a.serialNumber,
          a.status,
          employeeName(a),
          vendorName(a.vendorId),
        ]),
      ),
    );
    setSuccess("Inventory exported.");
  }
  function assetTable(assets: Asset[], compact = false) {
    return !assets.length ? (
      <Empty
        title="No matching assets"
        description="Add an asset or adjust your filters."
      />
    ) : (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Asset code</th>
              <th>Status</th>
              {!compact && <th>Assigned to</th>}
              <th>{compact ? "Category" : "Purchase value"}</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link className="asset-cell" href={`/assets/${a.id}`}>
                    <AssetIcon category={categoryName(a)} />
                    <span>
                      <strong>{a.assetName}</strong>
                      <small>
                        {compact ? a.serialNumber : categoryName(a)}
                      </small>
                    </span>
                  </Link>
                </td>
                <td className="mono">{a.assetCode}</td>
                <td>
                  <Badge status={a.status} />
                </td>
                {!compact && (
                  <td>
                    {a.employeeId ? (
                      <span className="person">
                        <span className="avatar small">
                          {employeeName(a)
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        {employeeName(a)}
                      </span>
                    ) : (
                      <span className="muted">Unassigned</span>
                    )}
                  </td>
                )}
                <td>
                  {compact
                    ? categoryName(a)
                    : currency(a.purchaseOrRentalPrice)}
                </td>
                <td>
                  <Link
                    className="icon-button"
                    aria-label={`View ${a.assetName}`}
                    href={`/assets/${a.id}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  function timeline(events: State["events"]) {
    return events.length ? (
      <ol className="timeline">
        {[...events].reverse().map((e) => (
          <li key={e.id}>
            <span className="timeline-dot">
              <CircleDot size={16} />
            </span>
            <div>
              <strong>{e.eventType}</strong>
              {view !== "detail" && (
                <Link href={`/assets/${e.assetId}`}>
                  {state?.assets.find((a) => a.id === e.assetId)?.assetName ||
                    e.assetId}
                </Link>
              )}
              {e.notes && <p>{e.notes}</p>}
              <small>
                {date(e.eventAt)} ·{" "}
                {new Date(e.eventAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                })}{" "}
                · {e.actor}
              </small>
            </div>
          </li>
        ))}
      </ol>
    ) : (
      <Empty title="No activity yet" />
    );
  }
  function repairTable(repairs: Repair[]) {
    return repairs.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Asset / issue</th>
              <th>Vendor</th>
              <th>Status</th>
              <th>Estimate / actual</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {repairs.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link className="table-link" href={`/assets/${r.assetId}`}>
                    {state?.assets.find((a) => a.id === r.assetId)?.assetName}
                  </Link>
                  <small className="table-note">{r.issue}</small>
                  <small className="table-note">
                    Reported {date(r.reportedOn)}
                  </small>
                </td>
                <td>{vendorName(r.vendorId)}</td>
                <td>
                  <Badge status={r.status} />
                </td>
                <td>
                  {currency(r.estimatedCost)}
                  <small className="table-note">
                    Actual:{" "}
                    {r.actualCost === null
                      ? "Not recorded"
                      : currency(r.actualCost)}
                  </small>
                </td>
                <td>
                  {r.status === "Returned" ? (
                    <span className="complete">
                      <CheckCircle2 size={15} /> Complete
                    </span>
                  ) : (
                    <button
                      className="btn-secondary btn-small"
                      disabled={busy}
                      onClick={() => setModal({ kind: "advance", repair: r })}
                    >
                      {repairStages[repairStages.indexOf(r.status) + 1]}
                      <ChevronRight size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No repair records"
        description="Report an issue to start tracking a repair."
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Boxes size={22} />
          </span>
          AssetDesk<span className="brand-dot">•</span>
        </Link>
        <p className="sidebar-caption">WORKSPACE</p>
        <nav>
          {nav.map((item) => (
            <Link
              key={item.key}
              aria-label={item.name}
              href={item.url}
              className={`nav-item ${view === item.key || (view === "detail" && item.key === "inventory") ? "active" : ""}`}
              onClick={() => setMobile(false)}
            >
              <item.icon size={19} />
              {item.name}
              {item.key === "inventory" && state && (
                <span className="nav-count">{state.assets.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <ShieldCheck size={19} />
            <div>
              <strong>
                {mode === "local" ? "Demo workspace" : "Secure workspace"}
              </strong>
              <small>
                {mode === "local"
                  ? "Fictional data · Local storage"
                  : "Firebase · Administrator only"}
              </small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">IT</span>
            <div>
              <strong>IT Administrator</strong>
              <small>Asset management</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() =>
                void fetch("/api/session", { method: "DELETE" }).then(() =>
                  router.push("/login"),
                )
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {view === "detail"
                ? "Asset Master"
                : nav.find((n) => n.key === view)?.name}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            {mode === "local" ? "Demo environment" : "Connected workspace"}
            <span className="topbar-divider" />
            <span className="avatar small">IT</span>
          </div>
        </header>
        <main className="main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">ASSET MANAGEMENT</p>
              <h1>{title}</h1>
              <p className="muted">{subtitle}</p>
            </div>
            <div className="heading-actions">
              {view === "dashboard" && (
                <Link className="btn-secondary" href="/scan">
                  <ScanLine size={16} />
                  Scan QR
                </Link>
              )}
              {["dashboard", "inventory"].includes(view) && (
                <button
                  className="btn-primary"
                  disabled={!state}
                  onClick={() => setModal({ kind: "asset" })}
                >
                  <Plus size={17} />
                  Add asset
                </button>
              )}
              {view === "categories" && (
                <button
                  className="btn-primary"
                  onClick={() => setModal({ kind: "category" })}
                >
                  <Plus size={17} />
                  Add category
                </button>
              )}
              {view === "vendors" && (
                <button
                  className="btn-primary"
                  onClick={() => setModal({ kind: "vendor" })}
                >
                  <Plus size={17} />
                  Add vendor
                </button>
              )}
              {view === "repairs" && (
                <button
                  className="btn-primary"
                  disabled={!state}
                  onClick={() => setModal({ kind: "repair" })}
                >
                  <Plus size={17} />
                  Report damage
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => void load()}>Retry</button>
            </div>
          )}
          {success && (
            <div className="alert success" role="status">
              <CheckCircle2 size={16} />
              {success}
              <button
                aria-label="Dismiss notification"
                onClick={() => setSuccess("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {!state ? (
            <div className="panel loading" role="status">
              <RefreshCw size={25} />
              <h2>
                {error ? "Workspace unavailable" : "Loading your workspace…"}
              </h2>
              <p className="muted">
                {error
                  ? "The server could not load your assets. Use Retry after checking the deployment."
                  : "Fetching the latest asset records."}
              </p>
            </div>
          ) : (
            <>
              {view === "dashboard" && (
                <>
                  <div className="stats-grid">
                    <StatCard
                      label="Total assets"
                      value={counts!.total}
                      hint="All registered assets, including retired assets"
                      tone="brand"
                    />
                    <StatCard
                      label="Assigned"
                      value={counts!.assigned}
                      hint="Assets with an active employee allocation, including those under repair"
                      tone="neutral"
                    />
                    <StatCard
                      label="Available"
                      value={counts!.available}
                      hint="Assets ready for allocation"
                      tone="success"
                    />
                    <StatCard
                      label="Damaged"
                      value={counts!.damaged}
                      hint="Assets with a not-working condition"
                      tone="warning"
                    />
                    <StatCard
                      label="Maintenance"
                      value={counts!.maintenance}
                      hint="Assets with an open repair"
                      tone="warning"
                    />
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Inventory at a glance</h2>
                          <p>Distribution across your asset categories</p>
                        </div>
                        <span className="soft-tag">
                          {state.categories.length} categories
                        </span>
                      </div>
                      <div className="category-overview">
                        {state.categories.map((c, i) => {
                          const amount = state.assets.filter(
                            (a) => a.assetCategoryId === c.id,
                          ).length;
                          return (
                            <Link
                              href="/inventory"
                              className="category-summary"
                              key={c.id}
                            >
                              <span
                                className={`category-symbol color-${i % 4}`}
                              >
                                <AssetIcon category={c.categoryName} />
                              </span>
                              <div>
                                <strong>{c.categoryName}</strong>
                                <span className="progress-track">
                                  <i
                                    style={{
                                      width: `${state.assets.length ? (amount / state.assets.length) * 100 : 0}%`,
                                    }}
                                  />
                                </span>
                              </div>
                              <b>{amount}</b>
                            </Link>
                          );
                        })}
                      </div>
                      <div className="panel-footer">
                        <span>
                          <span className="live-dot" /> Live database inventory
                        </span>
                        <Link href="/inventory">
                          View all assets <ArrowUpRight size={15} />
                        </Link>
                      </div>
                    </section>
                    <section className="panel attention-panel">
                      <div className="attention-icon">
                        <Wrench size={22} />
                      </div>
                      <span className="eyebrow">NEEDS ATTENTION</span>
                      <h2>
                        {
                          state.repairs.filter((r) => r.status !== "Returned")
                            .length
                        }{" "}
                        open repair
                        {state.repairs.filter((r) => r.status !== "Returned")
                          .length !== 1
                          ? "s"
                          : ""}
                      </h2>
                      <p className="muted">
                        Keep equipment moving. Review issues and follow up with
                        your repair vendors.
                      </p>
                      <div className="attention-meta">
                        <span>Estimated repair cost</span>
                        <strong>
                          {currency(
                            state.repairs
                              .filter((r) => r.status !== "Returned")
                              .reduce((n, r) => n + r.estimatedCost, 0),
                          )}
                        </strong>
                      </div>
                      <Link className="btn-secondary" href="/repairs">
                        Manage repairs
                        <ArrowUpRight size={16} />
                      </Link>
                    </section>
                  </div>
                  <div className="dashboard-bottom">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Recently registered assets</h2>
                          <p>Your latest additions to the inventory</p>
                        </div>
                        <Link className="text-link" href="/inventory">
                          View all
                          <ArrowUpRight size={14} />
                        </Link>
                      </div>
                      {assetTable(
                        [...state.assets].reverse().slice(0, 5),
                        true,
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Recent activity</h2>
                          <p>Latest changes across your workspace</p>
                        </div>
                        <History size={18} />
                      </div>
                      {timeline(state.events.slice(-5))}
                      <div className="panel-footer">
                        <Link href="/history">
                          View complete history
                          <ArrowUpRight size={14} />
                        </Link>
                      </div>
                    </section>
                  </div>
                </>
              )}
              {view === "inventory" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        All assets{" "}
                        <span className="count-pill">{filtered.length}</span>
                      </h2>
                      <p>A single source of truth for your equipment</p>
                    </div>
                    <button className="btn-secondary" onClick={exportAssets}>
                      <Download size={16} />
                      Export CSV
                    </button>
                  </div>
                  <div className="filters">
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Search assets"
                        placeholder="Search name, code, serial or employee…"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <select
                      aria-label="Filter by category"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All categories</option>
                      {state.categories.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.categoryName}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter by status"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All statuses</option>
                      <option value="available">Available</option>
                      <option value="allocated">Assigned</option>
                      <option value="under_maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                  {assetTable(filtered.slice((page - 1) * 8, page * 8))}
                  <div className="pagination">
                    <span>
                      Showing{" "}
                      {filtered.length
                        ? Math.min((page - 1) * 8 + 1, filtered.length)
                        : 0}
                      –{Math.min(page * 8, filtered.length)} of{" "}
                      {filtered.length} assets
                    </span>
                    <div>
                      <button
                        className="btn-secondary btn-small"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        {page} / {Math.max(1, Math.ceil(filtered.length / 8))}
                      </span>
                      <button
                        className="btn-secondary btn-small"
                        disabled={page * 8 >= filtered.length}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {view === "categories" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Asset categories</h2>
                      <p>
                        Identifiers follow the category code / sequential
                        counter pattern
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Code</th>
                          <th>Assets</th>
                          <th>Next identifier</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.categories.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <div className="asset-cell">
                                <AssetIcon category={c.categoryName} />
                                <strong>{c.categoryName}</strong>
                              </div>
                            </td>
                            <td className="mono">{c.categoryCode}</td>
                            <td>
                              {
                                state.assets.filter(
                                  (a) => a.assetCategoryId === c.id,
                                ).length
                              }
                            </td>
                            <td className="mono">
                              {c.categoryCode}/
                              {String(c.counterNextValue).padStart(4, "0")}
                            </td>
                            <td>
                              <button
                                className="btn-secondary btn-small"
                                onClick={() =>
                                  setModal({ kind: "category", category: c })
                                }
                              >
                                Edit category
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!state.categories.length && (
                    <Empty title="No categories yet" />
                  )}
                </section>
              )}
              {view === "vendors" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Vendor directory</h2>
                      <p>{state.vendors.length} registered partners</p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Vendor</th>
                          <th>Code</th>
                          <th>Contact</th>
                          <th>Assets supplied</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.vendors.map((v) => (
                          <tr key={v.id}>
                            <td>
                              <div className="asset-cell">
                                <span className="asset-icon">
                                  <Building2 size={20} />
                                </span>
                                <strong>{v.vendorName}</strong>
                              </div>
                            </td>
                            <td className="mono">{v.vendorCode}</td>
                            <td>
                              {v.email || "—"}
                              <small className="table-note">{v.phone}</small>
                            </td>
                            <td>
                              {
                                state.assets.filter((a) => a.vendorId === v.id)
                                  .length
                              }
                            </td>
                            <td>
                              <button
                                className="btn-secondary btn-small"
                                onClick={() =>
                                  setModal({ kind: "vendor", vendor: v })
                                }
                              >
                                Edit vendor
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!state.vendors.length && <Empty title="No vendors yet" />}
                </section>
              )}
              {view === "allocations" && (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Employee allocations</h2>
                        <p>Open any asset to assign, transfer or return it</p>
                      </div>
                      <Link className="btn-secondary" href="/inventory">
                        <Plus size={15} />
                        Allocate an asset
                      </Link>
                    </div>
                    <div className="employee-grid">
                      {state.employees.map((e) => {
                        const assigned = state.assets.filter(
                          (a) => a.employeeId === e.id,
                        );
                        return (
                          <article className="employee-card" key={e.id}>
                            <div className="employee-heading">
                              <span className="avatar">
                                {e.displayName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </span>
                              <div>
                                <h3>{e.displayName}</h3>
                                <small>{e.department}</small>
                              </div>
                              <span className="count-pill">
                                {assigned.length}
                              </span>
                            </div>
                            {assigned.length ? (
                              assigned.map((a) => (
                                <Link
                                  className="employee-asset"
                                  key={a.id}
                                  href={`/assets/${a.id}`}
                                >
                                  <Laptop size={16} />
                                  <span>
                                    {a.assetName}
                                    <small>{a.assetCode}</small>
                                  </span>
                                  <ArrowUpRight size={15} />
                                </Link>
                              ))
                            ) : (
                              <p className="muted">No assets assigned</p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                  <section className="panel allocation-history">
                    <div className="panel-heading">
                      <h2>Allocation history</h2>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Asset</th>
                            <th>Employee</th>
                            <th>Assigned</th>
                            <th>Returned / transferred</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...state.allocations].reverse().map((a) => (
                            <tr key={a.id}>
                              <td>
                                <Link
                                  className="table-link"
                                  href={`/assets/${a.assetId}`}
                                >
                                  {
                                    state.assets.find((x) => x.id === a.assetId)
                                      ?.assetName
                                  }
                                </Link>
                              </td>
                              <td>
                                {
                                  state.employees.find(
                                    (e) => e.id === a.employeeId,
                                  )?.displayName
                                }
                              </td>
                              <td>{date(a.allocationDate)}</td>
                              <td>
                                {a.actualReturnDate
                                  ? date(a.actualReturnDate)
                                  : "—"}
                              </td>
                              <td>
                                <Badge status={a.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
              {view === "repairs" && (
                <>
                  <div className="repair-stage-summary">
                    {repairStages.map((stage) => (
                      <div className="panel" key={stage}>
                        <span>{stage}</span>
                        <strong>
                          {
                            state.repairs.filter((r) => r.status === stage)
                              .length
                          }
                        </strong>
                      </div>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Repair register</h2>
                        <p>
                          Reported → Sent to Vendor → Under Repair → Repaired →
                          Returned
                        </p>
                      </div>
                    </div>
                    {repairTable(state.repairs)}
                  </section>
                </>
              )}
              {view === "history" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Lifecycle activity</h2>
                      <p>
                        Newest first · One canonical event per successful action
                      </p>
                    </div>
                    <select
                      aria-label="Filter history by asset"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">All assets</option>
                      {state.assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.assetName} · {a.assetCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  {timeline(
                    state.events.filter(
                      (e) => category === "all" || e.assetId === category,
                    ),
                  )}
                </section>
              )}
              {view === "scan" && <Scanner />}
              {view === "detail" &&
                (!detail ? (
                  <section className="panel">
                    <Empty
                      title="Asset not found"
                      description="The QR code or asset link is invalid, or you do not have access to this asset."
                    />
                    <Link className="btn-secondary" href="/inventory">
                      Back to inventory
                    </Link>
                  </section>
                ) : (
                  <>
                    <Link className="back-link" href="/inventory">
                      <ArrowLeft size={15} />
                      Back to Asset Master
                    </Link>
                    <section className="panel asset-detail-header">
                      <div className="asset-title">
                        <AssetIcon category={categoryName(detail)} />
                        <div>
                          <h2>{detail.assetName}</h2>
                          <span className="mono">{detail.assetCode}</span>
                        </div>
                        <Badge status={detail.status} />
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          setModal({ kind: "asset", asset: detail })
                        }
                      >
                        Edit asset
                      </button>
                    </section>
                    <div className="detail-grid">
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Asset information</h2>
                          <span className="soft-tag">
                            {categoryName(detail)}
                          </span>
                        </div>
                        <dl className="detail-fields">
                          {[
                            ["Serial number", detail.serialNumber],
                            ["Category", categoryName(detail)],
                            [
                              "Purchase value",
                              currency(detail.purchaseOrRentalPrice),
                            ],
                            ["Procured on", date(detail.procuredOn)],
                            ["Vendor", vendorName(detail.vendorId)],
                            [
                              "Condition",
                              detail.conditionStatus.replaceAll("_", " "),
                            ],
                            ["Current holder", employeeName(detail)],
                            ["Registered", date(detail.createdAt)],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="asset-actions">
                          {["available", "allocated"].includes(
                            detail.status,
                          ) && (
                            <button
                              className="btn-primary"
                              disabled={busy}
                              onClick={() =>
                                setModal({ kind: "assign", asset: detail })
                              }
                            >
                              <Users size={16} />
                              {detail.employeeId
                                ? "Transfer asset"
                                : "Assign asset"}
                            </button>
                          )}
                          {detail.employeeId &&
                            detail.status === "allocated" && (
                              <button
                                className="btn-secondary"
                                onClick={() =>
                                  setModal({ kind: "return", asset: detail })
                                }
                              >
                                Return asset
                              </button>
                            )}
                          {detail.status !== "retired" &&
                            !state.repairs.some(
                              (r) =>
                                r.assetId === detail.id &&
                                r.status !== "Returned",
                            ) && (
                              <button
                                className="btn-secondary"
                                onClick={() =>
                                  setModal({ kind: "repair", asset: detail })
                                }
                              >
                                <Wrench size={16} />
                                Report damage
                              </button>
                            )}
                          {detail.status === "available" && (
                            <button
                              className="text-danger"
                              onClick={() =>
                                setModal({ kind: "retire", asset: detail })
                              }
                            >
                              Retire asset
                            </button>
                          )}
                        </div>
                      </section>
                      <section className="panel qr-panel">
                        <div className="panel-heading">
                          <h2>Asset QR label</h2>
                          <QrCode size={19} />
                        </div>
                        {detail.qrGeneratedAt ? (
                          <>
                            <div className="print-label">
                              <Image
                                unoptimized
                                src={`/api/qr?id=${encodeURIComponent(detail.id)}`}
                                alt={`QR label for ${detail.assetName}`}
                                width={180}
                                height={180}
                              />
                              <strong>{detail.assetCode}</strong>
                              <small>{detail.assetName}</small>
                              <span className="print-only">
                                AssetDesk · Authorized access required
                              </span>
                            </div>
                            <div className="qr-actions">
                              <a
                                className="btn-secondary btn-small"
                                href={`/api/qr?id=${encodeURIComponent(detail.id)}`}
                                download={`asset-${detail.assetCode.replaceAll("/", "-")}.png`}
                              >
                                <Download size={15} />
                                PNG
                              </a>
                              <button
                                className="btn-secondary btn-small"
                                onClick={() => window.print()}
                              >
                                <Printer size={15} />
                                Print label
                              </button>
                            </div>
                            <p className="qr-caption">
                              Contains only a secure asset link.
                              <br />
                              Sign-in required to view details.
                            </p>
                          </>
                        ) : (
                          <div className="qr-empty">
                            <QrCode size={48} />
                            <p>Create a scannable label for this asset.</p>
                            <button
                              className="btn-primary"
                              disabled={busy}
                              onClick={() =>
                                void command(
                                  { type: "qr.generate", assetId: detail.id },
                                  "QR generated. Download or print your asset label.",
                                )
                              }
                            >
                              <Plus size={16} />
                              Generate QR
                            </button>
                          </div>
                        )}
                      </section>
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Damage & repair history</h2>
                      </div>
                      {repairTable(
                        state.repairs.filter((r) => r.assetId === detail.id),
                      )}
                    </section>
                    <section className="panel lifecycle-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Asset lifecycle</h2>
                          <p>
                            Every milestone, from registration to retirement
                          </p>
                        </div>
                        <History size={19} />
                      </div>
                      {timeline(
                        state.events.filter((e) => e.assetId === detail.id),
                      )}
                    </section>
                  </>
                ))}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              AssetDesk <span>·</span> IT asset management
            </span>
            <button onClick={() => void load()}>
              <RefreshCw size={13} />
              {lastSync ? `Last synced ${lastSync}` : "Refresh workspace"}
            </button>
          </footer>
        </main>
      </div>
      {modal && modal.kind !== "retire" && state && (
        <Dialog
          title={
            modal.kind === "asset"
              ? modal.asset
                ? "Edit asset"
                : "Register an asset"
              : modal.kind === "category"
                ? modal.category
                  ? "Edit category"
                  : "Add category"
                : modal.kind === "vendor"
                  ? modal.vendor
                    ? "Edit vendor"
                    : "Add vendor"
                  : modal.kind === "assign"
                    ? modal.asset.employeeId
                      ? "Transfer asset"
                      : "Assign asset"
                    : modal.kind === "return"
                      ? "Return asset"
                      : modal.kind === "repair"
                        ? "Report damage"
                        : `Update repair · ${repairStages[repairStages.indexOf(modal.repair.status) + 1]}`
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(new FormData(e.currentTarget));
            }}
          >
            <div className="form-content">
              {error && (
                <p className="alert error" role="alert">
                  {error}
                </p>
              )}
              {modal.kind === "asset" && (
                <>
                  <p className="muted form-help">
                    Asset codes are generated from the category sequence.
                  </p>
                  <Field
                    label="Asset name"
                    name="assetName"
                    value={modal.asset?.assetName}
                  />
                  {!modal.asset && (
                    <Field label="Category" name="assetCategoryId">
                      <option value="">Select category</option>
                      {state.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.categoryName} ({c.categoryCode})
                        </option>
                      ))}
                    </Field>
                  )}
                  <Field
                    label="Serial number"
                    name="serialNumber"
                    value={modal.asset?.serialNumber}
                  />
                  <Field
                    label="Purchase vendor"
                    name="vendorId"
                    value={modal.asset?.vendorId}
                  >
                    <option value="">Select vendor</option>
                    {state.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendorName}
                      </option>
                    ))}
                  </Field>
                  <div className="form-row">
                    <Field
                      label="Purchase value (₹)"
                      name="purchaseOrRentalPrice"
                      type="number"
                      value={modal.asset?.purchaseOrRentalPrice}
                    />
                    <Field
                      label="Procured on"
                      name="procuredOn"
                      type="date"
                      value={modal.asset?.procuredOn}
                    />
                  </div>
                </>
              )}
              {modal.kind === "category" && (
                <>
                  <Field
                    label="Category name"
                    name="categoryName"
                    value={modal.category?.categoryName}
                  />
                  <Field
                    label="Category code"
                    name="categoryCode"
                    value={modal.category?.categoryCode}
                  />
                  <p className="muted form-help">
                    Use 2–16 uppercase letters, numbers or hyphens. Code is
                    locked after assets use it.
                  </p>
                </>
              )}
              {modal.kind === "vendor" && (
                <>
                  <Field
                    label="Vendor name"
                    name="vendorName"
                    value={modal.vendor?.vendorName}
                  />
                  <Field
                    label="Vendor code"
                    name="vendorCode"
                    value={modal.vendor?.vendorCode}
                  />
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    required={false}
                    value={modal.vendor?.email}
                  />
                  <Field
                    label="Phone"
                    name="phone"
                    required={false}
                    value={modal.vendor?.phone}
                  />
                </>
              )}
              {modal.kind === "assign" && (
                <>
                  <p className="form-asset-summary">
                    {modal.asset.assetName}
                    <small>
                      {modal.asset.assetCode} · Currently:{" "}
                      {employeeName(modal.asset)}
                    </small>
                  </p>
                  <Field label="Assign to employee" name="employeeId">
                    <option value="">Select employee</option>
                    {state.employees
                      .filter((e) => e.id !== modal.asset.employeeId)
                      .map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.displayName} · {e.department}
                        </option>
                      ))}
                  </Field>
                  <label>
                    Notes
                    <textarea
                      name="notes"
                      maxLength={1500}
                      placeholder="Optional allocation or transfer notes"
                    />
                  </label>
                </>
              )}
              {modal.kind === "return" && (
                <>
                  <p className="form-asset-summary">
                    {modal.asset.assetName}
                    <small>
                      Return from {employeeName(modal.asset)} to available
                      inventory.
                    </small>
                  </p>
                  <label>
                    Return notes
                    <textarea name="notes" maxLength={1500} />
                  </label>
                </>
              )}
              {modal.kind === "repair" && (
                <>
                  {modal.asset ? (
                    <p className="form-asset-summary">
                      {modal.asset.assetName}
                      <small>{modal.asset.assetCode}</small>
                    </p>
                  ) : (
                    <Field label="Asset" name="assetId">
                      <option value="">Select asset</option>
                      {state.assets
                        .filter(
                          (a) =>
                            a.status !== "retired" &&
                            !state.repairs.some(
                              (r) =>
                                r.assetId === a.id && r.status !== "Returned",
                            ),
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.assetName} · {a.assetCode}
                          </option>
                        ))}
                    </Field>
                  )}
                  <label>
                    Issue description
                    <textarea
                      name="issue"
                      minLength={5}
                      maxLength={1500}
                      required
                      placeholder="Describe the damage or issue…"
                    />
                  </label>
                  <Field
                    label="Reported on"
                    name="reportedOn"
                    type="date"
                    value={new Date().toLocaleDateString("en-CA", {
                      timeZone: "Asia/Kolkata",
                    })}
                  />
                  <Field label="Repair vendor" name="vendorId">
                    <option value="">Select vendor</option>
                    {state.vendors.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.vendorName}
                      </option>
                    ))}
                  </Field>
                  <Field
                    label="Estimated repair cost (₹)"
                    name="estimatedCost"
                    type="number"
                  />
                  <label>
                    Repair notes
                    <textarea name="notes" maxLength={1500} />
                  </label>
                </>
              )}
              {modal.kind === "advance" && (
                <>
                  <div className="repair-flow">
                    {repairStages.map((stage, i) => (
                      <span
                        key={stage}
                        className={
                          i <= repairStages.indexOf(modal.repair.status) + 1
                            ? "done"
                            : ""
                        }
                      >
                        {stage}
                      </span>
                    ))}
                  </div>
                  <p className="muted">
                    {modal.repair.issue} · {vendorName(modal.repair.vendorId)}
                  </p>
                  <Field
                    label="Actual repair cost (₹)"
                    name="actualCost"
                    type="number"
                    required={repairStages.indexOf(modal.repair.status) >= 2}
                    value={modal.repair.actualCost ?? undefined}
                  />
                  <label>
                    Repair notes
                    <textarea
                      name="notes"
                      maxLength={1500}
                      defaultValue={modal.repair.notes}
                    />
                  </label>
                  <p className="muted form-help">
                    Returned means received back from the vendor. Employee
                    allocation stays active until you use Return asset.
                  </p>
                </>
              )}
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : modal.kind === "repair"
                    ? "Report damage"
                    : modal.kind === "advance"
                      ? "Update repair"
                      : "Save changes"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      <ConfirmModal
        open={modal?.kind === "retire"}
        title="Retire this asset?"
        message="This asset will leave available inventory. Its records and lifecycle history will be preserved."
        confirmLabel="Retire asset"
        pending={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          if (modal?.kind === "retire")
            void command(
              {
                type: "asset.retire",
                assetId: modal.asset.id,
                notes: "Retired by IT administrator",
              },
              "Asset retired. History preserved.",
            );
        }}
      />
    </div>
  );
}
