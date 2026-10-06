import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: Web-first is confirmed for the MVP.`;

test.describe("Account erasure", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("confirmation gate requires exact DELETE", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /delete account/i })).toBeDisabled();
    await page.getByLabel(/type DELETE/i).fill("delete");
    await expect(page.getByRole("button", { name: /delete account/i })).toBeDisabled();
    await page.getByLabel(/type DELETE/i).fill("DELETE");
    await expect(page.getByRole("button", { name: /delete account/i })).toBeEnabled();
  });

  test("successful deletion clears workspace access", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);
    await page.goto("/account");
    await page.getByLabel(/type DELETE/i).fill("DELETE");
    await page.getByRole("button", { name: /delete account/i }).click();
    await page.waitForURL("**/login?accountDeleted=1**");
    await page.goto("/handoffs");
    await expect(page).toHaveURL(/\/login/);
  });
});
