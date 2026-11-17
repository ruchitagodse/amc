import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
test("Firestore and Storage deny direct client reads and writes, including forged admin claims", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-ams",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
  try {
    for (const ctx of [
      env.unauthenticatedContext(),
      env.authenticatedContext("attacker", {
        role: "tenant_admin",
        tenantId: "fictional-demo",
      }),
    ]) {
      const target = doc(
        ctx.firestore(),
        "amsTenants/fictional-demo/state/current",
      );
      await assertFails(getDoc(target));
      await assertFails(setDoc(target, { assets: [] }));
      const file = ref(ctx.storage(), "private/employee.txt");
      await assertFails(uploadBytes(file, new Uint8Array([1, 2])));
      await assertFails(getBytes(file));
    }
  } finally {
    await env.cleanup();
  }
});
