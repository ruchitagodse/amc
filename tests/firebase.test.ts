import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { adminAuth, firestore } from "../lib/firebase-admin";
import { mutateState, readState } from "../lib/store";
import { seedDemo } from "../lib/demo";
import { applyCommand } from "../lib/domain";
import { newQrToken, qrTokenHash } from "../lib/qr-token";

test(
  "Firebase adapter transactions, tenant isolation, identity verification and live access revocation",
  { timeout: 120000 },
  async () => {
    Object.assign(process.env, {
      AMS_STORE: "firestore",
      FIREBASE_PROJECT_ID: "demo-ams",
      AMS_FIREBASE_PROJECT_CONFIRM: "demo-ams",
      SESSION_SECRET: "emulator-only-session-secret-for-ams-tests",
    });
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Use emulators only");
    assert.ok(
      process.env.FIREBASE_AUTH_EMULATOR_HOST,
      "Use auth emulator only",
    );
    const auth = adminAuth();
    const suffix = String(Date.now());
    const tenant = `test-${suffix}`;
    const user = await auth.createUser({
      email: `admin-${suffix}@example.test`,
      password: "EmulatorOnly123!",
    });
    const other = await auth.createUser({
      email: `other-${suffix}@example.test`,
      password: "EmulatorOnly123!",
    });
    await auth.setCustomUserClaims(user.uid, {
      role: "tenant_admin",
      tenantId: tenant,
    });
    await auth.setCustomUserClaims(other.uid, {
      role: "tenant_admin",
      tenantId: `other-${tenant}`,
    });
    let output = "";
    const server = spawn(
      process.execPath,
      [
        "--no-experimental-require-module",
        path.join(process.cwd(), "node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3200",
      ],
      {
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    server.stdout.on("data", (d) => {
      output += d;
    });
    server.stderr.on("data", (d) => {
      output += d;
    });
    const origin = "http://localhost:3200";
    const request = (url: string, options: RequestInit = {}) =>
      fetch(`${origin}${url}`, options);
    async function cookieFor(email: string) {
      const identity = await fetch(
        `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: "EmulatorOnly123!",
            returnSecureToken: true,
          }),
        },
      ).then((r) => r.json());
      assert.ok(identity.idToken, JSON.stringify(identity));
      const login = await request("/api/session", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: identity.idToken }),
      });
      assert.equal(login.status, 200, await login.text());
      return login.headers.get("set-cookie")!.split(";")[0];
    }
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          if ((await request("/login")).ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 300));
      }
      assert.ok(ready, output);
      await mutateState(tenant, seedDemo);
      await mutateState(tenant, seedDemo);
      assert.equal((await readState(tenant)).assets.length, 12);
      // Separate concurrent transactions cannot create two active allocations or duplicate events.
      const payload = { type: "qr.generate", assetId: "demo-asset-001" };
      const firstQr = newQrToken();
      const secondQr = newQrToken();
      await Promise.all([
        mutateState(tenant, (s) =>
          applyCommand(s, payload, "concurrent-qr-0001", "Test", undefined, {
            qrToken: firstQr,
          }),
        ),
        mutateState(tenant, (s) =>
          applyCommand(s, payload, "concurrent-qr-0002", "Test", undefined, {
            qrToken: secondQr,
          }),
        ),
      ]);
      assert.equal(
        (await readState(tenant)).events.filter(
          (e) =>
            e.assetId === "demo-asset-001" && e.eventType === "QR Generated",
        ).length,
        1,
      );
      const cookie = await cookieFor(user.email!);
      const otherCookie = await cookieFor(other.email!);
      const data = await request("/api/state", { headers: { Cookie: cookie } });
      assert.equal(data.status, 200);
      assert.equal((await data.json()).assets.length, 12);
      const otherData = await request("/api/state", {
        headers: { Cookie: otherCookie },
      });
      assert.equal(otherData.status, 200);
      assert.equal((await otherData.json()).assets.length, 0);
      assert.equal(
        (
          await request("/api/qr?id=demo-asset-001", {
            headers: { Cookie: otherCookie },
          })
        ).status,
        404,
      );
      const foreign = await request("/api/commands", {
        method: "POST",
        headers: {
          Cookie: otherCookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "test-foreign-001",
          command: { type: "qr.generate", assetId: "demo-asset-001" },
        }),
      });
      assert.equal(foreign.status, 404);
      assert.equal(
        (
          await request("/api/session", {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "demo" }),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/state", {
            headers: { Cookie: `${cookie}tampered` },
          })
        ).status,
        401,
      );
      const activeToken = (await readState(tenant)).assets[0].qrToken!;
      const publicCard = await request(`/api/public/assets/${activeToken}`);
      assert.equal(publicCard.status, 200);
      assert.deepEqual(Object.keys(await publicCard.json()).sort(), [
        "assetId",
        "brand",
        "category",
        "condition",
        "model",
        "name",
        "status",
      ]);
      const lookup = await firestore()
        .doc(`amsQrLinks/${qrTokenHash(activeToken)}`)
        .get();
      assert.equal(lookup.get("tenantId"), tenant);
      assert.equal(lookup.get("assetId"), "demo-asset-001");
      const rotate = await request("/api/commands", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "emulator-rotate-token",
          command: { type: "qr.regenerate", assetId: "demo-asset-001" },
        }),
      });
      assert.equal(rotate.status, 200);
      const rotatedToken = (await rotate.json()).assets[0].qrToken;
      assert.notEqual(rotatedToken, activeToken);
      assert.equal(
        (await request(`/api/public/assets/${activeToken}`)).status,
        404,
      );
      assert.equal(
        (await request(`/api/public/assets/${rotatedToken}`)).status,
        200,
      );
      const revoked = await request("/api/commands", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "emulator-revoke-token",
          command: { type: "qr.revoke", assetId: "demo-asset-001" },
        }),
      });
      assert.equal(revoked.status, 200);
      assert.equal(
        (await request(`/api/public/assets/${rotatedToken}`)).status,
        404,
      );
      assert.equal(
        (
          await firestore()
            .doc(`amsQrLinks/${qrTokenHash(rotatedToken)}`)
            .get()
        ).exists,
        false,
      );
      await auth.setCustomUserClaims(user.uid, {
        role: "employee",
        tenantId: tenant,
      });
      assert.equal(
        (await request("/api/state", { headers: { Cookie: cookie } })).status,
        403,
      );
      await auth.updateUser(other.uid, { disabled: true });
      assert.equal(
        (await request("/api/state", { headers: { Cookie: otherCookie } }))
          .status,
        403,
      );
    } finally {
      server.kill();
      await auth.deleteUser(user.uid);
      await auth.deleteUser(other.uid);
      await firestore().doc(`amsTenants/${tenant}/state/current`).delete();
      const links = await firestore()
        .collection("amsQrLinks")
        .where("tenantId", "==", tenant)
        .get();
      for (const link of links.docs) await link.ref.delete();
    }
  },
);
