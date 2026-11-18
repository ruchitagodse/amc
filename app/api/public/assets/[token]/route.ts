import { connection } from "next/server";
import { readPublicAsset } from "@/lib/store";
import { failure } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  await connection();
  try {
    const { token } = await params;
    const asset = await readPublicAsset(token);
    return Response.json(asset || { error: "Asset link unavailable" }, {
      status: asset ? 200 : 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
