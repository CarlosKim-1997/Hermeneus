import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: Web-first is confirmed for the MVP.`;

test.describe("Creator ownership IDOR", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("two creators, share independence, and sign-out", async ({ browser }) => {
    const creatorA = await browser.newPage();
    const creatorB = await browser.newPage();
    const receiver = await browser.newPage();

    await devSignIn(creatorA);
    await creatorA.goto("/new");
    await importTranscript(creatorA, transcript);
    const handoffId = creatorA.url().split("/handoffs/")[1]?.split("/")[0];
    expect(handoffId).toBeTruthy();

    await creatorA.getByRole("button", { name: "Add item" }).click();
    await creatorA.getByLabel("Statement").first().fill("Web-first is confirmed.");
    await creatorA.getByLabel("Type").first().selectOption("CONFIRMED");
    await creatorA.getByLabel("Source message").first().selectOption({ index: 1 });
    await creatorA.getByLabel("Excerpt (optional, must match source exactly)").first().fill("Web-first is confirmed");
    await creatorA.getByRole("button", { name: "Save draft" }).click();
    await expect(creatorA.getByText(/Saved draft revision/)).toBeVisible();
    await creatorA.getByRole("button", { name: "Approve & Publish" }).click();
    await expect(creatorA.getByRole("heading", { name: "Published Handoff" })).toBeVisible();
    await creatorA.getByRole("button", { name: "Create share link" }).click();
    await expect(creatorA.getByText(/Share link created for version 1/)).toBeVisible();
    const linkText = await creatorA.locator("code").filter({ hasText: "/share/hsh_" }).first().textContent();
    const sharePath = linkText!.includes("http") ? new URL(linkText!).pathname : linkText!;

    await devSignIn(creatorB, "secondary");
    await creatorB.goto(`/handoffs/${handoffId}/review`);
    await expect(creatorB.getByRole("heading", { name: "404" })).toBeVisible();
    await creatorB.goto(`/handoffs/${handoffId}/published/1`);
    await expect(creatorB.getByRole("heading", { name: "404" })).toBeVisible();
    await creatorB.goto(`/receiver/${handoffId}/1`);
    await expect(creatorB.getByRole("heading", { name: "404" })).toBeVisible();

    await receiver.goto(sharePath!);
    await expect(receiver.getByRole("heading", { name: "Shared Receiver" })).toBeVisible();
    await receiver.getByLabel("Your question").fill("Are we web first?");
    await receiver.getByRole("button", { name: "Ask" }).click();
    await expect(receiver.locator(".answerability-label", { hasText: "SUPPORTED" })).toBeVisible();

    await creatorA.getByRole("button", { name: "Revoke" }).first().click();
    await receiver.getByLabel("Your question").fill("Again?");
    await receiver.getByRole("button", { name: "Ask" }).click();
    await expect(receiver.getByText("This share link is unavailable.")).toBeVisible();

    await creatorA.getByRole("button", { name: "Sign out" }).click();
    await creatorA.waitForURL("**/login");
    await creatorA.goto("/new");
    await creatorA.waitForURL("**/login");

    await creatorA.close();
    await creatorB.close();
    await receiver.close();
  });
});
