"use client";
import { useState } from "react";
import { readApiResponse } from "@/lib/api-response";
import { Boxes, ArrowRight, ShieldCheck } from "lucide-react";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(
    demo: boolean,
    form?: FormData,
    provider?: "google.com" | "microsoft.com",
  ) {
    setBusy(true);
    setError("");
    try {
      let input: { mode?: string; idToken?: string } = { mode: "demo" };
      if (!demo) {
        const { initializeApp, getApps } = await import("firebase/app");
        const {
          getAuth,
          signInWithEmailAndPassword,
          connectAuthEmulator,
          signOut,
          signInWithPopup,
          GoogleAuthProvider,
          OAuthProvider,
        } = await import("firebase/auth");
        const app =
          getApps()[0] ||
          initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          });
        const auth = getAuth(app);
        if (
          process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL &&
          !auth.emulatorConfig
        )
          connectAuthEmulator(
            auth,
            process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL,
          );
        const result = provider
          ? await signInWithPopup(
              auth,
              provider === "google.com"
                ? new GoogleAuthProvider()
                : new OAuthProvider("microsoft.com"),
            )
          : await signInWithEmailAndPassword(
              auth,
              String(form?.get("email")),
              String(form?.get("password")),
            );
        input = { idToken: await result.user.getIdToken() };
        await signOut(auth);
      }
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await readApiResponse<{ ok: boolean }>(response);
      const next = new URLSearchParams(location.search).get("next");
      location.href =
        next && /^\/(assets\/[\w-]+|scan|inventory|repairs)$/.test(next)
          ? next
          : "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="brand">
          <span className="brand-icon">
            <Boxes size={23} />
          </span>
          AssetDesk
        </div>
        <p className="eyebrow">IT ASSET MANAGEMENT</p>
        <h1>Everything accounted for.</h1>
        <p className="muted">
          Sign in to manage your inventory, people and asset lifecycle in one
          place.
        </p>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login(false, new FormData(e.currentTarget));
            }}
          >
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <button
            className="btn-primary full"
            disabled={busy}
            onClick={() => void login(true)}
          >
            {busy ? "Opening workspace…" : "Enter demo"}
            <ArrowRight size={17} />
          </button>
        )}
        {process.env.NEXT_PUBLIC_FIREBASE_API_KEY && (
          <div className="provider-buttons">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => void login(false, undefined, "google.com")}
            >
              Continue with Google
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => void login(false, undefined, "microsoft.com")}
            >
              Continue with Microsoft
            </button>
          </div>
        )}
        <p className="login-foot">
          <ShieldCheck size={16} /> Administrator access · Asset management
        </p>
      </section>
    </main>
  );
}
