import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: { AMS_STORE: "local", AMS_DEMO_NAMESPACE: "e2e" },
  },
  reporter: "list",
});
