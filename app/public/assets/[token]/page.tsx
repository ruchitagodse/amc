import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Boxes, Package, ShieldCheck } from "lucide-react";
import { readPublicAsset } from "@/lib/store";

export const metadata: Metadata = {
  title: "Asset information · AssetDesk",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
const statusLabels: Record<string, string> = {
  available: "Available",
  allocated: "Assigned",
  under_maintenance: "Under maintenance",
  retired: "Retired",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const asset = await readPublicAsset(token);
  if (!asset) notFound();
  return (
    <main className="public-shell">
      <div className="public-brand">
        <span className="brand-icon">
          <Boxes size={22} />
        </span>
        <strong>AssetDesk</strong>
        <span className="public-access">
          <ShieldCheck size={15} />
          Public asset record
        </span>
      </div>
      <article className="public-asset-card">
        <div className="public-card-heading">
          <span className="public-equipment-icon">
            <Package size={30} />
          </span>
          <div>
            <p className="eyebrow">ASSET INFORMATION</p>
            <h1>{asset.name}</h1>
            <p className="public-identifier">{asset.assetId}</p>
          </div>
          <span className={`badge ${asset.status}`}>
            <i />
            {statusLabels[asset.status] || asset.status}
          </span>
        </div>
        <dl className="public-asset-fields">
          {[
            ["Asset ID", asset.assetId],
            ["Category", asset.category],
            ["Brand", asset.brand],
            ["Model", asset.model],
            ["Status", statusLabels[asset.status] || asset.status],
            [
              "Condition",
              (
                {
                  working: "Working",
                  not_working: "Not working",
                  repaired: "Repaired",
                } as Record<string, string>
              )[asset.condition] || asset.condition,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <footer className="public-card-footer">
          <ShieldCheck size={16} />
          Read-only asset information
        </footer>
      </article>
      <p className="public-footnote">AssetDesk · Asset management</p>
    </main>
  );
}
