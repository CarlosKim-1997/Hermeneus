import { expect, type Page } from "@playwright/test";

export async function importTranscript(page: Page, transcript: string) {
  await page.getByLabel("Conversation transcript").fill(transcript);
  await page.getByRole("button", { name: "Import" }).click();
  await page.waitForURL(/\/handoffs\/[^/]+\/review/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Creator Review" })).toBeVisible();
}
