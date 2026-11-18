import QRCode from "qrcode";
import { requireSession } from "@/lib/auth";
import { readState } from "@/lib/store";
import { failure } from "@/lib/http";
import { NotFoundError, ConflictError } from "@/shared/errors";
import { connection } from "next/server";
export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireSession(request);
    const id = new URL(request.url).searchParams.get("id");
    const asset = (await readState(session.tenantId)).assets.find(
      (a) => a.id === id,
    );
    if (!asset) throw new NotFoundError("Asset");
    if (!asset.qrToken || asset.qrRevokedAt)
      throw new ConflictError("Generate the asset QR first");
    // The public URL contains only a cryptographically random capability token.
    const base = process.env.AMS_PUBLIC_URL || new URL(request.url).origin;
    const png = await QRCode.toBuffer(
      `${base.replace(/\/$/, "")}/public/assets/${asset.qrToken}`,
      { width: 480, margin: 4, errorCorrectionLevel: "M" },
    );
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="asset-${asset.assetCode.replace(/[^A-Za-z0-9-]/g, "-")}.png"`,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
