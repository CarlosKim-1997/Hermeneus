import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: I think web-first is the right call.
assistant: That could work if the MVP stays small.
creator: Yes, web-first is confirmed for now.`;

test.describe("Receiver flow", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("pinned receiver view answers with citations and safe provenance", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);

    const reviewUrl = page.url();
    const handoffId = reviewUrl.split("/handoffs/")[1]?.split("/")[0];
    expect(handoffId).toBeTruthy();

    await page.getByRole("button", { name: "항목 추가", exact: true }).click();
    await page.getByLabel("전달할 내용").first().fill("Web-first is confirmed.");
    await page.getByLabel("내용 분류").first().selectOption("CONFIRMED");
    await page.getByLabel("근거가 되는 메시지").first().selectOption({ index: 1 });
    await page.getByLabel("원문 인용 · 선택 사항, 원문과 정확히 일치해야 합니다").first().fill("web-first is the right call");

    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
    await page.getByRole("button", { name: "전달본으로 확정" }).click();
    await expect(page.getByRole("heading", { name: "전달본 공유" })).toBeVisible({ timeout: 30_000 });

    await page.goto(`/receiver/${handoffId}/1`);
    await expect(page.getByRole("heading", { name: "확정한 맥락을 다시 살펴보세요.", exact: true })).toBeVisible();
    await expect(page.getByText("버전 1을 읽고 있습니다")).toBeVisible();
    await expect(page.locator(".document-body").getByText("Web-first is confirmed.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View publication record" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Return to draft review/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "검토에 쓰인 자료" })).toHaveCount(0);
    await expect(page.locator('a[href*="/handoffs/"]')).toHaveCount(0);

    await page.getByLabel("궁금한 점").fill("Are we building web first?");
    await page.getByRole("button", { name: "질문하기" }).click();
    await expect(page.locator(".answerability-label", { hasText: "SUPPORTED" })).toBeVisible();
    await expect(page.locator(".receiver-answer p").filter({ hasText: "Web-first is confirmed." }).first()).toBeVisible();

    await page.getByRole("button", { name: "원문 근거 보기" }).click();
    await expect(page.getByText("web-first is the right call")).toBeVisible();

    await page.getByLabel("궁금한 점").fill("What will this cost users?");
    await page.getByRole("button", { name: "질문하기" }).click();
    await expect(page.locator(".answerability-label", { hasText: "UNKNOWN" })).toBeVisible();
    await expect(page.locator(".receiver-answer").getByText(/^UNKNOWN\./)).toBeVisible();
  });
});
