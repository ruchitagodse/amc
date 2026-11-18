import { test, expect } from "@playwright/test";

test("repair status selector marks Repaired and Returned on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Asset overview", exact: true }),
  ).toBeVisible();
  await page.goto("/assets/demo-asset-007");
  await page
    .getByRole("button", { name: "Send to vendor", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send to vendor", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Start repair", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Current status:", { exact: false }),
  ).toContainText("Sent to Vendor");
  await expect(
    dialog.getByLabel("Repair status").locator('option[value="Returned"]'),
  ).toBeDisabled();
  await dialog.getByLabel("Repair status").selectOption("Repaired");
  await expect(dialog.getByLabel("Actual repair cost (₹)")).toHaveAttribute(
    "required",
    "",
  );
  await dialog.getByLabel("Actual repair cost (₹)").fill("200");
  await dialog.getByLabel("Repair notes").fill("Display fixed and tested");
  await page.screenshot({
    path: "test-results/mark-repaired-phone.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Mark as repaired", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Repair marked Repaired.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark as returned", exact: true })
    .click();
  await expect(dialog.getByLabel("Repair status")).toHaveValue("Returned");
  await expect(dialog.getByLabel("Actual repair cost (₹)")).toHaveValue("200");
  await dialog
    .getByRole("button", { name: "Mark as returned", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Repair marked Returned.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".complete:visible")).toContainText("Complete");
  await expect(
    page
      .locator(".timeline strong:visible")
      .filter({ hasText: /^Repair Completed$/ }),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".timeline strong:visible")
      .filter({ hasText: /^Returned from Repair$/ }),
  ).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(/fictional/i);
});
