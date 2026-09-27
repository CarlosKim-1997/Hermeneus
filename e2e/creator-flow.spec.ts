import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: I think web-first is the right call.
assistant: That could work if the MVP stays small.
creator: Yes, web-first is confirmed for now.`;

test.describe("Creator flow", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("paste conversation through publish v1", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);

    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Statement").first().fill("Web-first is confirmed.");
    await page.getByLabel("Type").first().selectOption("CONFIRMED");
    await page.getByLabel("Source message").first().selectOption({ index: 1 });
    await page.getByLabel("Excerpt (optional, must match source exactly)").first().fill("web-first is the right call");

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved draft revision/)).toBeVisible();
    await page.getByRole("button", { name: "Approve & Publish" }).click();
    await expect(page.getByRole("heading", { name: "Published Handoff" })).toBeVisible();
    await expect(page.getByText(/Version/)).toBeVisible();
  });
});
