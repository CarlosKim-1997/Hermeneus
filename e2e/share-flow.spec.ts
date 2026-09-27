import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: Web-first is confirmed for the MVP.
assistant: Understood.`;

test.describe("Share capability flow", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("Creator share link, Receiver Q&A, revoke blocks access", async ({ browser }) => {
    const creator = await browser.newPage();
    const receiver = await browser.newPage();

    await devSignIn(creator);
    await creator.goto("/new");
    await importTranscript(creator, transcript);

    const reviewUrl = creator.url();
    const handoffId = reviewUrl.split("/handoffs/")[1]?.split("/")[0];
    expect(handoffId).toBeTruthy();

    await creator.getByRole("button", { name: "Add item" }).click();
    await creator.getByLabel("Statement").first().fill("Web-first is confirmed.");
    await creator.getByLabel("Type").first().selectOption("CONFIRMED");
    await creator.getByLabel("Source message").first().selectOption({ index: 1 });
    await creator.getByLabel("Excerpt (optional, must match source exactly)").first().fill("Web-first is confirmed");

    await creator.getByRole("button", { name: "Save draft" }).click();
    await expect(creator.getByText(/Saved draft revision/)).toBeVisible();
    await creator.getByRole("button", { name: "Approve & Publish" }).click();
    await expect(creator.getByRole("heading", { name: "Published Handoff" })).toBeVisible();

    await creator.getByRole("button", { name: "Create share link" }).click();
    await expect(creator.getByText(/Share link created for version 1/)).toBeVisible();
    const linkText = await creator.locator("code").filter({ hasText: "/share/hsh_" }).first().textContent();
    expect(linkText).toMatch(/\/share\/hsh_/);

    const sharePath = linkText!.includes("http") ? new URL(linkText!).pathname : linkText!;
    await receiver.goto(sharePath);
    await expect(receiver.getByRole("heading", { name: "Shared Receiver" })).toBeVisible();
    await expect(receiver.getByText("Pinned to version 1").or(receiver.getByText(/always resolves to version 1/))).toBeVisible();
    await expect(receiver.getByText("Web-first is confirmed.")).toBeVisible();
    await expect(receiver.locator('a[href*="/handoffs/"]')).toHaveCount(0);
    await expect(receiver.locator('a[href*="/receiver/"]')).toHaveCount(0);

    await receiver.getByLabel("Your question").fill("Are we web first?");
    await receiver.getByRole("button", { name: "Ask" }).click();
    await expect(receiver.locator(".answerability-label", { hasText: "SUPPORTED" })).toBeVisible();

    const revokeButton = creator.getByRole("button", { name: "Revoke" }).first();
    await revokeButton.click();

    await receiver.getByLabel("Your question").fill("Another question?");
    await receiver.getByRole("button", { name: "Ask" }).click();
    await expect(receiver.getByText("This share link is unavailable.")).toBeVisible();

    await creator.close();
    await receiver.close();
  });
});
