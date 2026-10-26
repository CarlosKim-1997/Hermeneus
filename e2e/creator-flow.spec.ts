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

    await page.getByRole("button", { name: "항목 추가", exact: true }).click();
    await page.getByLabel("전달할 내용").first().fill("Web-first is confirmed.");
    await page.getByLabel("내용 분류").first().selectOption("CONFIRMED");
    await page.getByLabel("근거가 되는 메시지").first().selectOption({ index: 1 });
    await page.getByLabel("원문 인용 · 선택 사항, 원문과 정확히 일치해야 합니다").first().fill("web-first is the right call");

    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
    await page.getByRole("button", { name: "전달본으로 확정" }).click();
    await expect(page.getByRole("heading", { name: "전달본 공유" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".version-line")).toContainText("버전");
  });
});
