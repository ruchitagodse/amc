import { requireSession } from "@/lib/auth";
import { readState } from "@/lib/store";
import { failure } from "@/lib/http";
import { connection } from "next/server";
export async function GET(request: Request) {
  await connection();
  try {
    const session = await requireSession(request);
    return Response.json(await readState(session.tenantId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
