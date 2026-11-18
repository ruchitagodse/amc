import { Link2Off, Boxes } from "lucide-react";
export default function NotFound() {
  return (
    <main className="public-shell">
      <div className="public-brand">
        <span className="brand-icon">
          <Boxes size={22} />
        </span>
        <strong>AssetDesk</strong>
      </div>
      <section className="public-asset-card public-unavailable">
        <Link2Off size={36} />
        <h1>Asset link unavailable</h1>
        <p>
          This link is invalid or has been revoked. Please request a current
          asset label from your administrator.
        </p>
      </section>
    </main>
  );
}
