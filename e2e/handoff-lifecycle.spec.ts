import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: Web-first is confirmed for now.
assistant: Sounds good.`;

test.describe("Handoff lifecycle destructive UX", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("erase source then keep canonical draft editable", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Statement").first().fill("Web-first is confirmed.");
    await page.getByLabel("Type").first().selectOption("CONFIRMED");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved draft revision/)).toBeVisible();

    await page.getByRole("button", { name: "Erase Source…" }).click();
    await page.getByRole("button", { name: "Confirm Erase Source" }).click();
    await expect(page.getByText(/Source erased \/ provenance unavailable/i)).toBeVisible();
    await expect(page.getByText(/AI extraction is unavailable/i)).toBeVisible();

    await page.getByLabel("Statement").first().fill("Web-first remains canonical.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved draft revision/)).toBeVisible();
  });

  test("delete handoff with two-step confirmation", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);
    await page.getByRole("button", { name: "Delete Handoff…" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Creator Review" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Handoff…" }).click();
    await page.getByRole("button", { name: "Permanently delete Handoff" }).click();
    await expect(page).toHaveURL(/\/handoffs$/);
  });
});
