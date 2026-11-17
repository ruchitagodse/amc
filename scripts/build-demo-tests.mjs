import { spawnSync } from "node:child_process";

// Test against isolated fictional fixtures even when .env.local holds cloud credentials.
const env = { ...process.env, AMS_STORE: "local", VERCEL: "0" };
for (const key of [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL",
])
  env[key] = "";
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit", env, windowsHide: true },
);
process.exitCode = result.status ?? 1;
