import { test, expect } from "@playwright/test";

test("public QR card exposes only allowed fields and administrators can revoke and rotate links", async ({
  page,
  browser,
}) => {
  const origin = "http://localhost:3100";
  const assetId = "demo-asset-010";
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Asset overview", exact: true }),
  ).toBeVisible();
  await page.goto(`/assets/${assetId}`);
  await page.getByRole("button", { name: "Generate QR", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open public card" }),
  ).toBeVisible();
  const url = new URL(
    (await page
      .getByRole("link", { name: "Open public card" })
      .getAttribute("href"))!,
    origin,
  ).href;
  const token = url.split("/").at(-1)!;
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(url).not.toContain(assetId);
  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  try {
    const response = await anonymous.request.get(
      `${origin}/api/public/assets/${token}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const card = await response.json();
    expect(Object.keys(card).sort()).toEqual([
      "assetId",
      "brand",
      "category",
      "condition",
      "model",
      "name",
      "status",
    ]);
    expect(card.name).toBe("Poly Blackwire 5220");
    expect(card.brand).toBe("Poly");
    expect(card.model).toBe("Blackwire 5220");
    const png = await page.request.get(`/api/qr?id=${assetId}`);
    await visitor.goto(`${origin}/scan`);
    await visitor
      .getByLabel("Scan label image")
      .setInputFiles({
        name: "public-label.png",
        mimeType: "image/png",
        buffer: await png.body(),
      });
    await expect(visitor).toHaveURL(url);
    await expect(visitor).not.toHaveURL(/login/);
    await expect(
      visitor.getByRole("heading", { name: card.name, exact: true }),
    ).toBeVisible();
    for (const text of [
      "Rahul Sharma",
      "ABC Technologies",
      "Purchase value",
      "Repair notes",
      "Serial number",
      "DEMO-00010",
    ])
      await expect(visitor.locator("body")).not.toContainText(text);
    const html = await visitor.content();
    expect(html).not.toContain(assetId);
    expect(html).not.toContain("employeeId");
    expect(html).not.toContain("purchaseOrRentalPrice");
    await visitor.screenshot({
      path: "test-results/public-asset-card.png",
      fullPage: true,
    });
    expect((await anonymous.request.get(`${origin}/api/state`)).status()).toBe(
      401,
    );
    expect(
      (
        await anonymous.request.post(`${origin}/api/commands`, {
          headers: { Origin: origin },
          data: {
            key: crypto.randomUUID(),
            command: { type: "qr.revoke", assetId },
          },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await anonymous.request.post(`${origin}/api/public/assets/${token}`, {
          data: { status: "retired" },
        })
      ).status(),
    ).toBe(405);
    expect(
      (
        await anonymous.request.get(`${origin}/api/public/assets/${assetId}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await anonymous.request.get(
          `${origin}/api/public/assets/${"Z".repeat(43)}`,
        )
      ).status(),
    ).toBe(404);
    await page
      .getByRole("button", { name: "Regenerate link", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Regenerate link", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const nextUrl = new URL(
      (await page
        .getByRole("link", { name: "Open public card" })
        .getAttribute("href"))!,
      origin,
    ).href;
    expect(nextUrl).not.toBe(url);
    expect(
      (
        await anonymous.request.get(`${origin}/api/public/assets/${token}`)
      ).status(),
    ).toBe(404);
    await visitor.goto(url);
    await expect(
      visitor.getByRole("heading", {
        name: "Asset link unavailable",
        exact: true,
      }),
    ).toBeVisible();
    await visitor.goto(nextUrl);
    await expect(
      visitor.getByRole("heading", { name: card.name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Revoke link", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Revoke link", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await visitor.reload();
    await expect(
      visitor.getByRole("heading", {
        name: "Asset link unavailable",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (
        await anonymous.request.get(
          `${origin}/api/public/assets/${nextUrl.split("/").at(-1)}`,
        )
      ).status(),
    ).toBe(404);
    expect((await page.request.get(`/api/qr?id=${assetId}`)).status()).toBe(
      409,
    );
  } finally {
    await anonymous.close();
  }
});

test("desktop workspace shares the enterprise palette across existing screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo", exact: true }).click();
  for (const path of [
    "/",
    "/inventory",
    "/categories",
    "/vendors",
    "/allocations",
    "/repairs",
    "/history",
  ]) {
    await page.goto(path);
    await expect(
      page.locator(".workspace-footer:visible button"),
    ).toContainText("Last synced");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--brand")
          .trim(),
      ),
    ).toBe("#147d80");
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Recently registered assets" }),
  ).toBeVisible();
  await page.locator(".workspace-footer:visible").scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/enterprise-dashboard.png",
    fullPage: true,
  });
  await page.goto("/inventory");
  await expect(
    page.getByRole("button", { name: "Add asset", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add asset", exact: true }).click();
  await expect(page.getByLabel("Brand / manufacturer")).toBeVisible();
  await expect(page.getByLabel("Model", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/enterprise-asset-form.png" });
});
