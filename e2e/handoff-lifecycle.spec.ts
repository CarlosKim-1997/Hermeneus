import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: Web-first is confirmed for now.
assistant: Sounds good.`;

test.describe("원문·전달 데이터 관리 destructive UX", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("erase source then keep canonical draft editable", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);
    await page.getByRole("button", { name: "항목 추가", exact: true }).click();
    await page.getByLabel("전달할 내용").first().fill("Web-first is confirmed.");
    await page.getByLabel("내용 분류").first().selectOption("CONFIRMED");
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();

    await page.getByRole("button", { name: "원문 삭제 범위 확인" }).click();
    await page.getByRole("button", { name: "원문 영구 삭제" }).click();
    await expect(page.getByText(/원문 삭제됨 · 원문 근거 확인 불가/)).toBeAttached({ timeout: 30_000 });
    await page.getByText("검토에 쓰인 자료", { exact: true }).click();
    await expect(page.getByText(/원문 삭제됨 · 원문 근거 확인 불가/)).toBeVisible();
    await expect(page.getByText(/원문에서 AI 제안을 만들 수 없습니다/)).toBeVisible();

    await page.getByLabel("전달할 내용").first().fill("Web-first remains canonical.");
    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
  });

  test("delete handoff with two-step confirmation", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);
    await page.getByRole("button", { name: "전달 삭제 범위 확인" }).click();
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByRole("heading", { name: "보낼 내용 검토" })).toBeVisible();

    await page.getByRole("button", { name: "전달 삭제 범위 확인" }).click();
    await page.getByRole("button", { name: "전달 전체 영구 삭제" }).click();
    await expect(page).toHaveURL(/\/handoffs$/);
  });
});
