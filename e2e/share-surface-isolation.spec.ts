import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: Share surface isolation check.
assistant: OK.`;

async function publishWithShare(page: import("@playwright/test").Page) {
  await devSignIn(page);
  await page.goto("/new");
  await importTranscript(page, transcript);
  const handoffId = page.url().split("/handoffs/")[1]?.split("/")[0];
  expect(handoffId).toBeTruthy();

  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Statement").first().fill("Isolation confirmed.");
  await page.getByLabel("Type").first().selectOption("CONFIRMED");
  await page.getByLabel("Source message").first().selectOption({ index: 1 });
  await page.getByLabel("Excerpt (optional, must match source exactly)").first().fill("Share surface isolation check");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/Saved draft revision/)).toBeVisible();
  await page.getByRole("button", { name: "Approve & Publish" }).click();
  await expect(page.getByRole("heading", { name: "Published Handoff" })).toBeVisible();

  await page.getByRole("button", { name: "Create share link" }).click();
  await expect(page.getByText(/Share link created for version 1/)).toBeVisible();
  const linkText = await page.locator("code").filter({ hasText: "/share/hsh_" }).first().textContent();
  expect(linkText).toMatch(/\/share\/hsh_/);
  const sharePath = linkText!.includes("http") ? new URL(linkText!).pathname : linkText!;

  return { handoffId: handoffId!, sharePath };
}

test.describe("Share surface isolation", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("logged-in Creator sees Shared Receiver without Creator chrome", async ({ page }) => {
    const { sharePath } = await publishWithShare(page);

    await page.goto(sharePath);
    await expect(page.getByRole("heading", { name: "Shared Receiver" })).toBeVisible();
    await expect(page.getByText("Isolation confirmed.")).toBeVisible();

    await expect(page.getByRole("link", { name: "Handoffs" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "New Handoff" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await expect(page.getByText(/Signed in as Creator/i)).toHaveCount(0);
    await expect(page.getByText(/Development Creator session/i)).toHaveCount(0);
  });

  test("logged-in Creator session does not restore revoked share", async ({ page }) => {
    const { handoffId, sharePath } = await publishWithShare(page);

    await page.goto(sharePath);
    await expect(page.getByRole("heading", { name: "Shared Receiver" })).toBeVisible();

    await page.goto(`/handoffs/${handoffId}/published/1`);
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByRole("listitem").filter({ hasText: /revoked/i })).toBeVisible();

    await page.goto(sharePath);
    await expect(page.getByRole("heading", { name: "Shared Receiver" })).toHaveCount(0);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Handoffs" })).toHaveCount(0);
  });
});
