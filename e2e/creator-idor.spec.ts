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

    await creatorA.getByRole("button", { name: "항목 추가", exact: true }).click();
    await creatorA.getByLabel("전달할 내용").first().fill("Web-first is confirmed.");
    await creatorA.getByLabel("내용 분류").first().selectOption("CONFIRMED");
    await creatorA.getByLabel("근거가 되는 메시지").first().selectOption({ index: 1 });
    await creatorA.getByLabel("원문 인용 · 선택 사항, 원문과 정확히 일치해야 합니다").first().fill("Web-first is confirmed");
    await creatorA.getByRole("button", { name: "초안 저장" }).click();
    await expect(creatorA.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
    await creatorA.getByRole("button", { name: "전달본으로 확정" }).click();
    await expect(creatorA.getByRole("heading", { name: "전달본 공유" })).toBeVisible();
    await creatorA.getByRole("button", { name: "이 버전의 공유 링크 만들기" }).click();
    await expect(creatorA.getByText(/버전 1의 공유 링크를 만들었습니다/)).toBeVisible();
    const linkText = await creatorA.locator("code").filter({ hasText: "/share#hsh_" }).first().textContent();
    const sharePath = linkText!.includes("http") ? new URL(linkText!).pathname + new URL(linkText!).hash : linkText!;

    await devSignIn(creatorB, "secondary");
    await creatorB.goto(`/handoffs/${handoffId}/review`);
    await expect(creatorB.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeVisible();
    await expect(creatorB.getByRole("button", { name: "초안 저장" })).toHaveCount(0);
    await creatorB.goto(`/handoffs/${handoffId}/published/1`);
    await expect(creatorB.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeVisible();
    await expect(creatorB.getByRole("button", { name: "이 버전의 공유 링크 만들기" })).toHaveCount(0);
    await creatorB.goto(`/receiver/${handoffId}/1`);
    await expect(creatorB.getByRole("heading", { name: "페이지를 찾을 수 없습니다" })).toBeVisible();
    await expect(creatorB.getByLabel("궁금한 점")).toHaveCount(0);

    await receiver.goto(sharePath!);
    await expect(receiver.getByRole("heading", { name: "공유받은 전달본" })).toBeVisible();
    await receiver.getByLabel("궁금한 점").fill("Are we web first?");
    await receiver.getByRole("button", { name: "질문하기", exact: true }).click();
    await expect(receiver.locator(".answerability-label", { hasText: "SUPPORTED" })).toBeVisible();

    await creatorA.getByRole("button", { name: "접근 해제" }).first().click();
    await expect(creatorA.getByRole("listitem").filter({ hasText: /해제됨/ })).toBeVisible();
    await receiver.getByLabel("궁금한 점").fill("Again?");
    await receiver.getByRole("button", { name: "질문하기", exact: true }).click();
    await expect(receiver.getByText("이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요.")).toBeVisible();

    await creatorA.getByRole("button", { name: "로그아웃" }).click();
    await creatorA.waitForURL("**/login");
    await creatorA.goto("/new");
    await creatorA.waitForURL("**/login");

    await creatorA.close();
    await creatorB.close();
    await receiver.close();
  });
});
