import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: "AssetDesk · Asset Management",
  description: "Secure asset inventory, allocation and repair management",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense
          fallback={
            <main className="loading" role="status">
              Loading AssetDesk…
            </main>
          }
        >
          {children}
        </Suspense>
      </body>
    </html>
  );
}
