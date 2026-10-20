import { expect, test } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";

test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

test("Bootstrap notes disappear, title stays private, and shared packet is source-free", async ({ browser }) => {
  const creator = await browser.newPage();
  const receiver = await browser.newPage();
  await creator.setViewportSize({ width: 390, height: 844 });
  await devSignIn(creator);
  await creator.goto("/new");
  await expect(creator.getByRole("heading", { name: "정리하던 대화를 전달 초안으로" })).toBeVisible();
  await creator.getByRole("button", { name: "안내문 직접 보기", exact: true }).click();
  const senderPrompt = creator.getByLabel("AI에 줄 안내문", { exact: true });
  await expect(senderPrompt).toBeVisible();
  await expect(senderPrompt).toHaveAttribute("readonly", "");
  expect(await senderPrompt.inputValue()).toContain("hermeneus.portable-proposal/v0");
  await creator.getByRole("button", { name: "AI에 줄 안내문 복사", exact: true }).click();
  // Both native clipboard success and the manual-copy fallback must be actionable.
  await expect(creator.getByRole("status")).toContainText(/안내문을 복사했습니다|직접 선택해 복사/);
  await expect(senderPrompt).toBeVisible();
  await creator.getByRole("button", { name: "안내문 접기", exact: true }).click();
  await expect(senderPrompt).toBeHidden();
  await creator.getByLabel("AI가 만든 전달 초안(JSON)").fill("```json\n{}\n```");
  await creator.getByRole("button", { name: "초안 미리보기" }).click();
  const previewError = creator.locator("p.error[role='alert']");
  await expect(previewError).toContainText("초안을 읽을 수 없습니다");
  await expect(previewError).toBeInViewport();
  await creator.getByLabel("AI가 만든 전달 초안(JSON)").fill(JSON.stringify({
    protocol: "hermeneus.portable-proposal/v0", title: "Private bootstrap title",
    items: [{ proposalId: "P-001", type: "OPEN", priority: "IMPORTANT", statement: "Hosting remains undecided." }],
    reviewNotes: ["Ask Sender before publishing."],
  }));
  await creator.getByRole("button", { name: "초안 미리보기" }).click();
  await expect(creator.getByRole("heading", { name: "3. 저장 전, 빠진 맥락 확인" })).toBeInViewport();
  await expect(creator.getByRole("listitem").filter({ hasText: "Ask Sender before publishing." })).toBeVisible();
  await expect(creator.getByRole("button", { name: "초안 만들고 검토하기" })).toBeDisabled();
  await creator.getByLabel(/“Private bootstrap title”을 내 전달함/).check();
  await creator.getByLabel(/검토 메모를 확인했고/).check();
  await creator.getByRole("button", { name: "초안 만들고 검토하기" }).click();
  await creator.waitForURL("**/review");
  const handoffId = creator.url().split("/handoffs/")[1]?.split("/")[0];
  expect(handoffId).toBeTruthy();
  await creator.getByText("검토에 쓰인 자료", { exact: true }).click();
  await expect(creator.getByText(/대화 원문을 수집하지 않았습니다/)).toBeVisible();
  await expect(creator.getByText("대화 원문을 수집하지 않아 연결된 근거가 없습니다.")).toBeVisible();
  await expect(creator.getByText("원문이 삭제되어 근거를 확인할 수 없습니다.")).toHaveCount(0);
  await expect(creator.getByText("Ask Sender before publishing.")).toHaveCount(0);
  await creator.getByRole("button", { name: "전달본으로 확정" }).click();
  await expect(creator.getByRole("heading", { name: "이제 맥락을 건네세요." })).toBeVisible({ timeout: 30_000 });
  await creator.getByRole("button", { name: "이 버전의 공유 링크 만들기" }).click();
  const linkText = await creator.locator("code").filter({ hasText: "/share#hsh_" }).first().textContent();
  expect(linkText).toBeTruthy();
  await receiver.goto(linkText!.includes("http") ? new URL(linkText!).pathname + new URL(linkText!).hash : linkText!);
  await expect(receiver.getByRole("navigation", { name: "전달 내용을 더 알아보는 방법" })).toBeVisible();
  const receiverUrl = receiver.url();
  const routes = receiver.getByRole("navigation", { name: "전달 내용을 더 알아보는 방법" });
  await routes.getByRole("button", { name: "이 화면에서 질문하기", exact: true }).click();
  await expect(receiver.getByRole("heading", { name: "이 화면에서 질문하기", exact: true })).toBeInViewport();
  await expect(receiver).toHaveURL(receiverUrl);
  await routes.getByRole("button", { name: "내 AI로 설명받기", exact: true }).click();
  await expect(receiver.getByRole("heading", { name: "내 AI로 설명받기", exact: true })).toBeInViewport();
  await expect(receiver).toHaveURL(receiverUrl);
  await expect(receiver.getByText("이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요.", { exact: true })).toHaveCount(0);
  await expect(receiver.getByRole("heading", { name: "내 AI로 설명받기", exact: true })).toBeVisible();
  await expect(receiver.getByRole("heading", { name: "이 화면에서 질문하기", exact: true })).toBeVisible();
  const availability = receiver.locator("#verification-availability");
  await expect(availability).toContainText("현재 의미 검증이 꺼져 있습니다.");
  await expect(receiver.getByLabel("확인할 AI 답변 원문")).toHaveAttribute("aria-describedby", "verification-availability");
  expect(await availability.evaluate((notice) => Boolean(notice.compareDocumentPosition(document.getElementById("external-question")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await receiver.getByLabel(/전달본을 외부 AI로 옮길 때/).check();
  await receiver.getByRole("button", { name: "설명 자료 준비" }).click();
  const packetText = await receiver.getByLabel("직접 복사할 설명 자료").inputValue();
  expect(packetText).toContain("hermeneus.receiver-packet/v0");
  expect(packetText).toContain("HI-001");
  expect(packetText).not.toContain("Private bootstrap title");
  expect(packetText).not.toContain("Ask Sender before publishing.");
  expect(packetText).not.toContain("/share/");
  await receiver.getByLabel("확인할 AI 답변 원문").fill("Hosting is decided [HI-001].");
  await receiver.getByRole("button", { name: "이 답변 검사" }).click();
  await expect(receiver.getByRole("status")).toContainText("INDETERMINATE");
  await creator.goto("/handoffs");
  await expect(creator.getByRole("listitem").filter({ hasText: handoffId! })).toContainText("Private bootstrap title");
  await creator.close();
  await receiver.close();
});
