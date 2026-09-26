import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";

const transcript = `creator: I think web-first is the right call.
assistant: That could work if the MVP stays small.
creator: Yes, web-first is confirmed for now.`;

test.describe("Creator extraction UI", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("generate suggestion, accept, edit, save, publish", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await page.getByLabel("Conversation transcript").fill(transcript);
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByRole("heading", { name: "Creator Review" })).toBeVisible();

    await page.getByRole("button", { name: "Generate AI suggestions" }).click();
    await expect(page.getByText("AI suggestion — not saved")).toBeVisible();
    await page.getByRole("button", { name: "Add to draft" }).click();

    await page.getByLabel("Statement").first().fill("Web-first is confirmed for the MVP (edited).");

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved draft revision/)).toBeVisible();
    await page.getByRole("button", { name: "Approve & Publish" }).click();
    await expect(page.getByRole("heading", { name: "Published Handoff" })).toBeVisible();
  });
});
