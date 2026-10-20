import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: I think web-first is the right call.
assistant: That could work if the MVP stays small.
creator: Yes, web-first is confirmed for now.`;

test.describe("Creator extraction UI", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("generate suggestion, accept, edit, save, publish", async ({ page }) => {
    await devSignIn(page);
    await page.goto("/new");
    await importTranscript(page, transcript);

    await page.getByRole("button", { name: "원문으로 AI 제안 받기" }).click();
    await expect(page.getByText("AI 제안 · 아직 저장 전")).toBeVisible();
    await page.getByRole("button", { name: "초안에 추가", exact: true }).click();

    await page.getByLabel("전달할 내용").first().fill("Web-first is confirmed for the MVP (edited).");

    await page.getByRole("button", { name: "초안 저장" }).click();
    await expect(page.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
    await page.getByRole("button", { name: "전달본으로 확정" }).click();
    await expect(page.getByRole("heading", { name: "이제 맥락을 건네세요." })).toBeVisible();
  });
});
