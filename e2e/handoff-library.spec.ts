import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcriptA = `creator: Handoff library smoke A.
assistant: OK.`;

const transcriptB = `creator: Handoff library smoke B.
assistant: OK.`;

test.describe("Creator Handoff Library", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("library lists owned Handoffs, published link, and cross-Creator isolation", async ({ browser }) => {
    const creatorA = await browser.newPage();
    const creatorB = await browser.newPage();

    await devSignIn(creatorA);
    await creatorA.goto("/new");
    await importTranscript(creatorA, transcriptA);
    const handoffA = creatorA.url().split("/handoffs/")[1]?.split("/")[0];
    expect(handoffA).toBeTruthy();

    await creatorA.goto("/handoffs");
    await expect(creatorA.getByRole("heading", { name: "Your Handoffs" })).toBeVisible();
    await expect(creatorA.getByText(handoffA!)).toBeVisible();
    await creatorA.getByRole("link", { name: "Review" }).first().click();
    await expect(creatorA.getByRole("heading", { name: "Creator Review" })).toBeVisible();

    await creatorA.goto(`/handoffs/${handoffA}/review`);
    await creatorA.getByRole("button", { name: "Add item" }).click();
    await creatorA.getByLabel("Statement").first().fill("Library smoke published.");
    await creatorA.getByLabel("Type").first().selectOption("CONFIRMED");
    await creatorA.getByLabel("Source message").first().selectOption({ index: 1 });
    await creatorA.getByLabel("Excerpt (optional, must match source exactly)").first().fill("Handoff library smoke A");
    await creatorA.getByRole("button", { name: "Save draft" }).click();
    await expect(creatorA.getByText(/Saved draft revision/)).toBeVisible();
    await creatorA.getByRole("button", { name: "Approve & Publish" }).click();
    await expect(creatorA.getByRole("heading", { name: "Published Handoff" })).toBeVisible();

    await creatorA.goto("/handoffs");
    const rowA = creatorA.locator(".handoff-library-item").filter({ hasText: handoffA! });
    await expect(rowA.getByText(/Published v1/)).toBeVisible();
    await rowA.getByRole("link", { name: "Open latest published" }).click();
    await expect(creatorA.getByRole("heading", { name: "Published Handoff" })).toBeVisible();

    await devSignIn(creatorB, "secondary");
    await creatorB.goto("/new");
    await importTranscript(creatorB, transcriptB);
    const handoffB = creatorB.url().split("/handoffs/")[1]?.split("/")[0];
    expect(handoffB).toBeTruthy();

    await creatorB.goto("/handoffs");
    const rowB = creatorB.locator(".handoff-library-item").filter({ hasText: handoffB! });
    await expect(rowB).toBeVisible();
    await expect(creatorB.locator(".handoff-library-item").filter({ hasText: handoffA! })).toHaveCount(0);

    await creatorA.close();
    await creatorB.close();
  });

  test("anonymous /handoffs redirects to login", async ({ page }) => {
    await page.goto("/handoffs");
    await expect(page).toHaveURL(/\/login$/);
  });
});
