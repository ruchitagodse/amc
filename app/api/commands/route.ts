import { requireSession, sameOrigin } from "@/lib/auth";
import { mutateState } from "@/lib/store";
import { applyCommand } from "@/lib/domain";
import { body, failure } from "@/lib/http";
import { newQrToken } from "@/lib/qr-token";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireSession(request);
    const input = await body(request);
    const qrToken = newQrToken();
    const now = new Date().toISOString();
    const state = await mutateState(session.tenantId, (s) =>
      applyCommand(s, input.command, input.key, session.displayName, now, {
        qrToken,
      }),
    );
    return Response.json(state);
  } catch (e) {
    return failure(e);
  }
}
