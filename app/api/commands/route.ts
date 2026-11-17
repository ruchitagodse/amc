import { requireSession, sameOrigin } from "@/lib/auth";
import { mutateState } from "@/lib/store";
import { applyCommand } from "@/lib/domain";
import { body, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireSession(request);
    const input = await body(request);
    const state = await mutateState(session.tenantId, (s) =>
      applyCommand(s, input.command, input.key, session.displayName),
    );
    return Response.json(state);
  } catch (e) {
    return failure(e);
  }
}
