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

  await page.getByRole("button", { name: "항목 추가", exact: true }).click();
  await page.getByLabel("전달할 내용").first().fill("Isolation confirmed.");
  await page.getByLabel("내용 분류").first().selectOption("CONFIRMED");
  await page.getByLabel("근거가 되는 메시지").first().selectOption({ index: 1 });
  await page.getByLabel("원문 인용 · 선택 사항, 원문과 정확히 일치해야 합니다").first().fill("Share surface isolation check");
  await page.getByRole("button", { name: "초안 저장" }).click();
  await expect(page.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "전달본으로 확정" }).click();
  await expect(page.getByRole("heading", { name: "이제 맥락을 건네세요." })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "이 버전의 공유 링크 만들기" }).click();
  await expect(page.getByText(/버전 1의 공유 링크를 만들었습니다/)).toBeVisible();
  const linkText = await page.locator("code").filter({ hasText: "/share#hsh_" }).first().textContent();
  expect(linkText).toMatch(/\/share#hsh_/);
  const sharePath = linkText!.includes("http") ? new URL(linkText!).pathname + new URL(linkText!).hash : linkText!;

  return { handoffId: handoffId!, sharePath };
}

test.describe("Share surface isolation", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("logged-in Creator sees 전달할 맥락이 도착했어요. without Creator chrome", async ({ page }) => {
    const { sharePath } = await publishWithShare(page);

    await page.goto(sharePath);
    await expect(page.getByRole("heading", { name: "전달할 맥락이 도착했어요." })).toBeVisible();
    await expect(page.locator(".document-body").getByText("Isolation confirmed.", { exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: "내 전달함" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "새 전달 만들기" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "로그아웃" })).toHaveCount(0);
    await expect(page.getByText(/내 계정으로 작업 중/)).toHaveCount(0);
    await expect(page.getByText(/개발용 테스트 계정/)).toHaveCount(0);
  });

  test("logged-in Creator session does not restore revoked share", async ({ page }) => {
    const { handoffId, sharePath } = await publishWithShare(page);

    await page.goto(sharePath);
    await expect(page.getByRole("heading", { name: "전달할 맥락이 도착했어요." })).toBeVisible();

    await page.goto(`/handoffs/${handoffId}/published/1`);
    await page.getByRole("button", { name: "접근 해제" }).first().click();
    await expect(page.getByRole("listitem").filter({ hasText: /해제됨/ })).toBeVisible();

    await page.goto(sharePath);
    await expect(page.getByRole("heading", { name: "전달할 맥락이 도착했어요." })).toHaveCount(0);
    await expect(page.getByText("이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요.")).toBeVisible();
    await expect(page.getByRole("link", { name: "내 전달함" })).toHaveCount(0);
  });
});
