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
    await expect(creatorA.getByRole("heading", { name: "내 전달함" })).toBeVisible();
    await expect(creatorA.getByRole("heading", { name: handoffA!, exact: true })).toBeVisible();
    await creatorA.getByRole("link", { name: "초안 이어서 검토" }).first().click();
    await expect(creatorA.getByRole("heading", { name: "내 뜻대로 전달될지 확인하세요." })).toBeVisible();

    await creatorA.goto(`/handoffs/${handoffA}/review`);
    await creatorA.getByRole("button", { name: "항목 추가", exact: true }).click();
    await creatorA.getByLabel("전달할 내용").first().fill("Library smoke published.");
    await creatorA.getByLabel("내용 분류").first().selectOption("CONFIRMED");
    await creatorA.getByLabel("근거가 되는 메시지").first().selectOption({ index: 1 });
    await creatorA.getByLabel("원문 인용 · 선택 사항, 원문과 정확히 일치해야 합니다").first().fill("Handoff library smoke A");
    await creatorA.getByRole("button", { name: "초안 저장" }).click();
    await expect(creatorA.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
    await creatorA.getByRole("button", { name: "전달본으로 확정" }).click();
    await expect(creatorA.getByRole("heading", { name: "이제 맥락을 건네세요." })).toBeVisible({ timeout: 30_000 });

    await creatorA.goto("/handoffs");
    const rowA = creatorA.locator(".handoff-library-item").filter({ hasText: handoffA! });
    await expect(rowA.getByText("버전 1", { exact: true })).toBeVisible();
    await rowA.getByRole("link", { name: "확정 전달본 보기" }).click();
    await expect(creatorA.getByRole("heading", { name: "이제 맥락을 건네세요." })).toBeVisible();

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
