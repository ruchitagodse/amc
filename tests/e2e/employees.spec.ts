import { test, expect } from "@playwright/test";

test("employee records can be created, edited, assigned assets and returned", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter fictional demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Asset overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Employee Allocation", exact: true })
    .click();
  await page.getByRole("button", { name: "Add employee", exact: true }).click();
  await page.getByLabel("Employee name").fill("Anita Test");
  await page.getByLabel("Department", { exact: true }).fill("IT Support");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const card = page
    .locator(".employee-card:visible")
    .filter({ hasText: "Anita Test" });
  await expect(card).toContainText("IT Support");
  await page.reload();
  await expect(card).toContainText("IT Support");
  await card.getByRole("button", { name: "Edit employee Anita Test" }).click();
  await page.getByLabel("Department", { exact: true }).fill("Operations");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toContainText("Operations");
  await page.getByRole("button", { name: "Add employee", exact: true }).click();
  await page.getByLabel("Employee name").fill("anita test");
  await page.getByLabel("Department", { exact: true }).fill("operations");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "already exists",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/assets/demo-asset-012");
  await expect(
    page.getByRole("button", { name: "Assign asset", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assign asset", exact: true }).click();
  await page
    .getByLabel("Assign to employee")
    .selectOption({ label: "Anita Test · Operations" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator("dd:visible").filter({ hasText: "Anita Test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return asset", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("link", { name: "Employee Allocation", exact: true })
    .click();
  await expect(card).toContainText("No assets assigned");
});
