import { test, expect } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";
import { importTranscript } from "./helpers/import-handoff";

const transcript = `creator: Web-first is confirmed for the MVP.
assistant: Understood.`;

test.describe("상대에게 보낼 링크 flow", () => {
  test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

  test("Creator share link, Receiver Q&A, revoke blocks access", async ({ browser }) => {
    const creator = await browser.newPage();
    const receiver = await browser.newPage();

    await devSignIn(creator);
    await creator.goto("/new");
    await importTranscript(creator, transcript);

    const reviewUrl = creator.url();
    const handoffId = reviewUrl.split("/handoffs/")[1]?.split("/")[0];
    expect(handoffId).toBeTruthy();

    await creator.getByRole("button", { name: "항목 추가", exact: true }).click();
    await creator.getByLabel("전달할 내용").first().fill("Web-first is confirmed.");
    await creator.getByLabel("내용 분류").first().selectOption("CONFIRMED");
    await creator.getByLabel("근거가 되는 메시지").first().selectOption({ index: 1 });
    await creator.getByLabel("원문 인용 · 선택 사항, 원문과 정확히 일치해야 합니다").first().fill("Web-first is confirmed");

    await creator.getByRole("button", { name: "초안 저장" }).click();
    await expect(creator.getByText(/초안 수정 \d+을 저장했습니다/)).toBeVisible();
    await creator.getByRole("button", { name: "전달본으로 확정" }).click();
    await expect(creator.getByRole("heading", { name: "전달본 공유" })).toBeVisible({ timeout: 30_000 });

    await creator.getByRole("button", { name: "이 버전의 공유 링크 만들기" }).click();
    await expect(creator.getByText(/버전 1의 공유 링크를 만들었습니다/)).toBeVisible();
    const linkText = await creator.locator("code").filter({ hasText: "/share#hsh_" }).first().textContent();
    expect(linkText).toMatch(/\/share#hsh_/);

    const sharePath = linkText!.includes("http") ? new URL(linkText!).pathname + new URL(linkText!).hash : linkText!;
    const token = new URL(linkText!).hash.slice(1);
    const requestPaths: string[] = [];
    receiver.on("request", (request) => requestPaths.push(new URL(request.url()).pathname));
    // Reuse an already-mounted /share page: navigating to a fragment does not
    // reload the document and must still consume the newly supplied capability.
    await receiver.goto("/share");
    await expect(receiver.getByText("이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요.")).toBeVisible();
    await receiver.goto(sharePath);
    await expect(receiver.getByRole("heading", { name: "공유받은 전달본" })).toBeVisible();
    await expect(receiver).toHaveURL(/\/share$/);
    expect(requestPaths).not.toContain(`/share/${token}`);
    expect(requestPaths.every((path) => !path.includes(token))).toBe(true);
    expect((await receiver.request.get(`/share/${token}`)).status()).toBe(404);
    await expect(receiver.getByText("버전 1을 읽고 있습니다").or(receiver.getByText(/항상 버전 1을 엽니다/))).toBeVisible();
    await expect(receiver.locator(".document-body").getByText("Web-first is confirmed.", { exact: true })).toBeVisible();
    await expect(receiver.locator('a[href*="/handoffs/"]')).toHaveCount(0);
    await expect(receiver.locator('a[href*="/receiver/"]')).toHaveCount(0);

    await receiver.getByLabel("궁금한 점").fill("Are we web first?");
    await receiver.getByRole("button", { name: "질문하기", exact: true }).click();
    await expect(receiver.locator(".answerability-label", { hasText: "SUPPORTED" })).toBeVisible();

    const revokeButton = creator.getByRole("button", { name: "접근 해제" }).first();
    await revokeButton.click();
    await expect(creator.getByRole("listitem").filter({ hasText: /해제됨/ })).toBeVisible();

    await receiver.getByLabel("궁금한 점").fill("Another question?");
    await receiver.getByRole("button", { name: "질문하기", exact: true }).click();
    await expect(receiver.getByText("이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요.")).toBeVisible();

    await creator.close();
    await receiver.close();
  });
});
