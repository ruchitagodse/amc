import { NextResponse, connection } from "next/server";
import { assertRuntimeConfiguration } from "@/lib/runtime-config";
import { isFirebase } from "@/lib/store";
import { requireSession, isLoopback, sameOrigin } from "@/lib/auth";
import { body, failure } from "@/lib/http";
import {
  buildSessionCookie,
  buildClearedSessionCookie,
} from "@/modules/auth-session/session-cookie";
import { ForbiddenError } from "@/shared/errors";
export async function GET(request: Request) {
  await connection();
  try {
    return Response.json(
      {
        session: await requireSession(request),
        mode: isFirebase() ? "firestore" : "local",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    assertRuntimeConfiguration();
    const input = await body(request);
    let identity = {
      userId: "local-demo-admin",
      tenantId: "fictional-demo",
      email: "admin@ams.example",
      displayName: "Demo administrator",
    };
    if (isFirebase()) {
      const { adminAuth } = await import("@/lib/firebase-admin");
      if (typeof input.idToken !== "string")
        throw new ForbiddenError("Firebase sign-in required");
      const token = await adminAuth().verifyIdToken(input.idToken, true);
      if (
        !["password", "google.com", "microsoft.com"].includes(
          token.firebase.sign_in_provider,
        )
      )
        throw new ForbiddenError("Unsupported sign-in provider");
      if (token.auth_time < Date.now() / 1000 - 300)
        throw new ForbiddenError("Please sign in again");
      const user = await adminAuth().getUser(token.uid);
      const claims = user.customClaims;
      if (
        user.disabled ||
        claims?.role !== "tenant_admin" ||
        typeof claims.tenantId !== "string" ||
        !/^[\w-]{1,80}$/.test(claims.tenantId)
      )
        throw new ForbiddenError("Active administrator membership required");
      identity = {
        userId: token.uid,
        tenantId: claims.tenantId,
        email: user.email || "",
        displayName: user.displayName || "IT administrator",
      };
    } else if (!isLoopback(request) || input.mode !== "demo")
      throw new ForbiddenError(
        "Fictional demo access is restricted to localhost",
      );
    const response = NextResponse.json({ ok: true });
    const cookie = await buildSessionCookie({
      ...identity,
      scope: "tenant",
      membershipId: identity.userId,
      role: "tenant_admin",
    });
    response.cookies.set({ ...cookie, secure: !isLoopback(request) });
    return response;
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      ...buildClearedSessionCookie(),
      secure: !isLoopback(request),
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
