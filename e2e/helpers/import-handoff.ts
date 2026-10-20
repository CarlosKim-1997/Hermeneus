import { expect, type Page } from "@playwright/test";

export async function importTranscript(page: Page, transcript: string) {
  await page.locator(".creation-import > summary").click();
  await page.getByLabel("대화 원문").fill(transcript);
  await page.getByRole("button", { name: "원문 가져오기" }).click();
  await page.waitForURL(/\/handoffs\/[^/]+\/review/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "내 뜻대로 전달될지 확인하세요." })).toBeVisible();
}
