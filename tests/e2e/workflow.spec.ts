import { test, expect } from "@playwright/test";

test("empty deployment errors show a recovery state without an endless spinner", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/session", (route) =>
    route.fulfill({ status: 500, body: "" }),
  );
  await page.route("**/api/state", (route) =>
    route.fulfill({ status: 500, body: "" }),
  );
  await page.goto("/");
  await expect(page.locator(".alert.error")).toContainText(
    "empty response (HTTP 500)",
  );
  await expect(
    page.getByRole("heading", { name: "Workspace unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Loading your workspace…" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".alert.error")).toContainText("HTTP 500");
  expect(errors).toEqual([]);
});

test("camera permission error and synthetic live-camera QR decoding", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter fictional demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Asset overview", exact: true }),
  ).toBeVisible();
  const generated = await page.request.post("/api/commands", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      key: crypto.randomUUID(),
      command: { type: "qr.generate", assetId: "demo-asset-002" },
    },
  });
  expect(generated.ok()).toBe(true);
  const png = await page.request.get("/api/qr?id=demo-asset-002");
  const dataUrl = `data:image/png;base64,${(await png.body()).toString("base64")}`;
  await page.goto("/scan");
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new Error("Camera permission denied");
      },
    }),
  );
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator(".alert.error")).toContainText(
    "Camera permission denied",
  );
  await page.evaluate(async (source) => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const picture = new window.Image();
    picture.src = source;
    await picture.decode();
    const context = canvas.getContext("2d")!;
    context.drawImage(picture, 0, 0);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const stream = canvas.captureStream(10);
        setInterval(() => context.drawImage(picture, 0, 0), 100);
        return stream;
      },
    });
  }, dataUrl);
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page).toHaveURL(/\/assets\/demo-asset-002$/, { timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "MacBook Air M2", exact: true }),
  ).toBeVisible();
});

test("unauthorized data and QR requests are rejected", async ({ request }) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect((await request.get("/api/qr?id=demo-asset-001")).status()).toBe(401);
  expect(
    (
      await request.post("/api/session", {
        data: { mode: "demo" },
        headers: { Origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
});

test("client demonstration: Dell → QR → Rahul → battery repair → return → lifecycle", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/assets/demo-asset-001");
  await expect(page).toHaveURL(/login\?next=/);
  await page.getByRole("button", { name: "Enter fictional demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Dell Latitude 5440", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate QR", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "QR label for Dell Latitude 5440" }),
  ).toBeVisible();
  const qr = await page.request.get("/api/qr?id=demo-asset-001");
  expect(qr.status()).toBe(200);
  expect(qr.headers()["content-type"]).toBe("image/png");
  expect((await qr.body()).subarray(1, 4).toString()).toBe("PNG");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.getByRole("button", { name: "Assign asset", exact: true }).click();
  await page.getByLabel("Assign to employee").selectOption("emp-rahul");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator("dd").filter({ hasText: "Rahul Sharma" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Scan QR Code", exact: true }).click();
  await page
    .getByLabel("Asset QR URL")
    .fill("https://untrusted.example/assets/demo-asset-001");
  await page.getByRole("button", { name: "Open asset", exact: true }).click();
  await expect(page.locator(".alert.error")).toContainText("does not belong");
  await page.getByLabel("Scan label image").setInputFiles({
    name: "asset-label.png",
    mimeType: "image/png",
    buffer: await qr.body(),
  });
  await expect(
    page.getByRole("heading", { name: "Dell Latitude 5440", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Report damage", exact: true })
    .click();
  await page
    .getByLabel("Issue description")
    .fill("Battery no longer holds charge");
  await page.getByLabel("Repair vendor").selectOption("demo-vendor-0");
  await page.getByLabel("Estimated repair cost (₹)").fill("3500");
  await page.getByLabel("Repair notes").fill("Replace faulty battery");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Report damage", exact: true })
    .click();
  await expect(
    page.getByText("Damage reported. Repair record created."),
  ).toBeVisible();
  for (const stage of [
    "Sent to Vendor",
    "Under Repair",
    "Repaired",
    "Returned",
  ]) {
    await page.getByRole("button", { name: stage, exact: true }).click();
    await page.getByLabel("Actual repair cost (₹)").fill("3200");
    await page.getByLabel("Repair notes").fill("Battery replaced and tested");
    await page
      .getByRole("button", { name: "Update repair", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await page.getByRole("button", { name: "Return asset", exact: true }).click();
  await page.getByLabel("Return notes").fill("Returned in working condition");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Asset returned to inventory.", { exact: true }),
  ).toBeVisible();
  for (const milestone of [
    "Asset Created",
    "QR Generated",
    "Asset Assigned",
    "Damage Reported",
    "Sent to Vendor",
    "Under Repair",
    "Repair Completed",
    "Returned from Repair",
    "Asset Returned",
  ])
    await expect(
      page
        .locator(".timeline strong")
        .filter({ hasText: new RegExp(`^${milestone}$`) }),
    ).toHaveCount(1);
  await expect(
    page.locator("dd").filter({ hasText: "Unassigned" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/asset-lifecycle.png",
    fullPage: true,
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-label")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Asset overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recently registered assets" }),
  ).toBeVisible();
  await page.locator(".workspace-footer:visible").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("master forms, filtering, allocation transfer, retirement, mobile layout and sign out", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter fictional demo" }).click();
  await page
    .getByRole("link", { name: "Category Master", exact: true })
    .click();
  await page.getByRole("button", { name: "Add category" }).click();
  await page.getByLabel("Category name").fill("Demo tablets");
  await page.getByLabel("Category code").fill("TAB");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Category saved successfully.")).toBeVisible();
  await page.getByRole("link", { name: "Vendor Master", exact: true }).click();
  await page.getByRole("button", { name: "Add vendor" }).click();
  await page.getByLabel("Vendor name").fill("Demo Tablet Supply");
  await page.getByLabel("Vendor code").fill("DTS");
  await page.getByLabel("Email", { exact: true }).fill("tablets@example.test");
  await page.getByLabel("Phone", { exact: true }).fill("5550103");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("link", { name: "Asset Master", exact: true }).click();
  await page.getByRole("button", { name: "Add asset", exact: true }).click();
  await page.getByLabel("Asset name", { exact: true }).fill("Demo tablet");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Demo tablets (TAB)" });
  await page
    .getByLabel("Serial number", { exact: true })
    .fill("TABLET-TEST-001");
  await page
    .getByLabel("Purchase vendor")
    .selectOption({ label: "Demo Tablet Supply" });
  await page.getByLabel("Purchase value (₹)").fill("12000");
  await page.getByLabel("Procured on").fill("2026-10-01");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Asset saved successfully.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search assets" })
    .fill("TABLET-TEST-001");
  await expect(page.locator("tbody tr:visible")).toHaveCount(1);
  await page
    .getByRole("link", { name: "View Demo tablet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Demo tablet", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".asset-title:visible .mono")).toHaveText(
    "TAB/0001",
  );
  await page.getByRole("button", { name: "Edit asset", exact: true }).click();
  await page
    .getByLabel("Asset name", { exact: true })
    .fill("Demo tablet updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo tablet updated", exact: true }),
  ).toBeVisible();
  for (const employee of ["emp-priya", "emp-neha"]) {
    await page
      .getByRole("button", {
        name: employee === "emp-priya" ? "Assign asset" : "Transfer asset",
        exact: true,
      })
      .click();
    await page.getByLabel("Assign to employee").selectOption(employee);
    await page.getByRole("button", { name: "Save changes" }).click();
  }
  await expect(
    page.locator(".timeline strong").filter({ hasText: /^Asset Transferred$/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Return asset", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Retire asset", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retire asset", exact: true })
    .click();
  await expect(
    page.getByText("Asset retired. History preserved."),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Asset overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recently registered assets" }),
  ).toBeVisible();
  await page.locator(".workspace-footer:visible").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/state")).status()).toBe(401);
});

test("every fictional asset label decodes to its own protected detail page", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter fictional demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Asset overview", exact: true }),
  ).toBeVisible();
  const state = await page.request.get("/api/state").then((r) => r.json());
  for (const asset of state.assets.filter((a: { id: string }) =>
    a.id.startsWith("demo-asset-"),
  )) {
    const generated = await page.request.post("/api/commands", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        key: crypto.randomUUID(),
        command: { type: "qr.generate", assetId: asset.id },
      },
    });
    expect(generated.ok()).toBe(true);
    const qr = await page.request.get(`/api/qr?id=${asset.id}`);
    expect(qr.ok()).toBe(true);
    await page.goto("/scan");
    await page.getByLabel("Scan label image").setInputFiles({
      name: "label.png",
      mimeType: "image/png",
      buffer: await qr.body(),
    });
    await expect(page).toHaveURL(`http://localhost:3100/assets/${asset.id}`);
    await expect(
      page.getByRole("heading", { name: asset.assetName, exact: true }),
    ).toBeVisible();
  }
});
