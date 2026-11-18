import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, ArrowLeft } from "lucide-react";
import { Scanner } from "@/components/scanner";
export const metadata: Metadata = {
  title: "Scan an asset · AssetDesk",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return (
    <main className="public-shell public-scan-shell">
      <div className="public-brand">
        <span className="brand-icon">
          <Boxes size={22} />
        </span>
        <strong>AssetDesk</strong>
        <Link className="text-link" href="/">
          <ArrowLeft size={16} />
          Workspace
        </Link>
      </div>
      <Scanner />
      <p className="public-footnote">
        Scan to view basic asset information. No sign-in required.
      </p>
    </main>
  );
}
