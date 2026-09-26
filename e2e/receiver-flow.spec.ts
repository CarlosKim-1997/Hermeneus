import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";

const transcript = `creator: I think web-first is the right call.
assistant: That could work if the MVP stays small.
creator: Yes, web-first is confirmed for now.`;

test.describe("Receiver flow", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("pinned receiver view answers with citations and safe provenance", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await page.getByLabel("Conversation transcript").fill(transcript);
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByRole("heading", { name: "Creator Review" })).toBeVisible();

    const reviewUrl = page.url();
    const handoffId = reviewUrl.split("/handoffs/")[1]?.split("/")[0];
    expect(handoffId).toBeTruthy();

    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Statement").first().fill("Web-first is confirmed.");
    await page.getByLabel("Type").first().selectOption("CONFIRMED");
    await page.getByLabel("Source message").first().selectOption({ index: 1 });
    await page.getByLabel("Excerpt (optional, must match source exactly)").first().fill("web-first is the right call");

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved draft revision/)).toBeVisible();
    await page.getByRole("button", { name: "Approve & Publish" }).click();
    await expect(page.getByRole("heading", { name: "Published Handoff" })).toBeVisible();

    await page.goto(`/receiver/${handoffId}/1`);
    await expect(page.getByRole("heading", { name: "Receiver", exact: true })).toBeVisible();
    await expect(page.getByText("Pinned to version 1")).toBeVisible();
    await expect(page.getByText("Web-first is confirmed.")).toBeVisible();
    await expect(page.getByRole("link", { name: "View publication record" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Return to draft review/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Source Conversation" })).toHaveCount(0);
    await expect(page.locator('a[href*="/handoffs/"]')).toHaveCount(0);

    await page.getByLabel("Your question").fill("Are we building web first?");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.locator(".answerability-label", { hasText: "SUPPORTED" })).toBeVisible();
    await expect(page.locator(".receiver-answer p").filter({ hasText: "Web-first is confirmed." }).first()).toBeVisible();

    await page.getByRole("button", { name: "Show source evidence" }).click();
    await expect(page.getByText("web-first is the right call")).toBeVisible();

    await page.getByLabel("Your question").fill("What will this cost users?");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.locator(".answerability-label", { hasText: "UNKNOWN" })).toBeVisible();
    await expect(page.locator(".receiver-answer").getByText(/^UNKNOWN\./)).toBeVisible();
  });
});
