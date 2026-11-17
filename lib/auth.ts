import { cookies } from "next/headers";
import { assertRuntimeConfiguration } from "./runtime-config";
import { isFirebase } from "./store";
import {
  parseSessionCookie,
  getSessionCookieName,
} from "@/modules/auth-session/session-cookie";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors";
import type { AppSession } from "@/modules/auth-session/types";
export function isLoopback(request: Request) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(request.url).hostname,
  );
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new ForbiddenError("Same-origin request required");
}
export async function requireSession(request: Request): Promise<AppSession> {
  assertRuntimeConfiguration();
  const value = (await cookies()).get(getSessionCookieName())?.value;
  if (!value)
    throw new UnauthorizedError("Sign in to access asset information");
  let session: AppSession;
  try {
    session = await parseSessionCookie(value);
  } catch {
    throw new UnauthorizedError("Session expired. Sign in again.");
  }
  if (session.role !== "tenant_admin")
    throw new ForbiddenError("Administrator access required");
  if (isFirebase()) {
    const { adminAuth } = await import("./firebase-admin");
    const user = await adminAuth().getUser(session.userId);
    const claims = user.customClaims;
    if (
      user.disabled ||
      claims?.role !== "tenant_admin" ||
      claims?.tenantId !== session.tenantId
    )
      throw new ForbiddenError("Administrator access has been revoked");
  } else if (!isLoopback(request) || session.userId !== "local-demo-admin")
    throw new ForbiddenError("Local demo is only available on localhost");
  return session;
}
