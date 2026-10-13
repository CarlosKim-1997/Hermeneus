import { expect, test } from "@playwright/test";
import { devSignIn } from "./helpers/dev-auth";

test.skip(!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL, "DATABASE_URL required");

test("Bootstrap notes disappear, title stays private, and shared packet is source-free", async ({ browser }) => {
  const creator = await browser.newPage();
  const receiver = await browser.newPage();
  await creator.setViewportSize({ width: 390, height: 844 });
  await devSignIn(creator);
  await creator.goto("/new");
  await creator.getByLabel("Portable Proposal JSON").fill("```json\n{}\n```");
  await creator.getByRole("button", { name: "Preview proposal" }).click();
  const previewError = creator.locator("p.error[role='alert']");
  await expect(previewError).toContainText("not valid JSON");
  await expect(previewError).toBeInViewport();
  await creator.getByLabel("Portable Proposal JSON").fill(JSON.stringify({
    protocol: "hermeneus.portable-proposal/v0", title: "Private bootstrap title",
    items: [{ proposalId: "P-001", type: "OPEN", priority: "IMPORTANT", statement: "Hosting remains undecided." }],
    reviewNotes: ["Ask Sender before publishing."],
  }));
  await creator.getByRole("button", { name: "Preview proposal" }).click();
  await expect(creator.getByRole("heading", { name: "Review before creating a Draft" })).toBeInViewport();
  await expect(creator.getByRole("listitem").filter({ hasText: "Ask Sender before publishing." })).toBeVisible();
  await expect(creator.getByRole("button", { name: "Create Draft" })).toBeDisabled();
  await creator.getByLabel(/Save “Private bootstrap title”/).check();
  await creator.getByLabel(/I have reviewed the notes/).check();
  await creator.getByRole("button", { name: "Create Draft" }).click();
  await creator.waitForURL("**/review");
  const handoffId = creator.url().split("/handoffs/")[1]?.split("/")[0];
  expect(handoffId).toBeTruthy();
  await expect(creator.getByText(/Original source not collected/)).toBeVisible();
  await expect(creator.getByText("No source provenance (original source not collected).")).toBeVisible();
  await expect(creator.getByText("No source provenance (source erased).")).toHaveCount(0);
  await expect(creator.getByText("Ask Sender before publishing.")).toHaveCount(0);
  await creator.getByRole("button", { name: "Approve & Publish" }).click();
  await expect(creator.getByRole("heading", { name: "Published Handoff" })).toBeVisible({ timeout: 30_000 });
  await creator.getByRole("button", { name: "Create share link" }).click();
  const linkText = await creator.locator("code").filter({ hasText: "/share#hsh_" }).first().textContent();
  expect(linkText).toBeTruthy();
  await receiver.goto(linkText!.includes("http") ? new URL(linkText!).pathname + new URL(linkText!).hash : linkText!);
  await receiver.getByLabel(/I understand the external disclosure/).check();
  await receiver.getByRole("button", { name: "Prepare Receiver Packet" }).click();
  const packetText = await receiver.getByLabel("Packet text").inputValue();
  expect(packetText).toContain("hermeneus.receiver-packet/v0");
  expect(packetText).toContain("HI-001");
  expect(packetText).not.toContain("Private bootstrap title");
  expect(packetText).not.toContain("Ask Sender before publishing.");
  expect(packetText).not.toContain("/share/");
  await receiver.getByLabel("AI answer").fill("Hosting is decided [HI-001].");
  await receiver.getByRole("button", { name: "Check answer" }).click();
  await expect(receiver.getByRole("status")).toContainText("INDETERMINATE");
  await creator.goto("/handoffs");
  await expect(creator.getByRole("listitem").filter({ hasText: handoffId! })).toContainText("Private bootstrap title");
  await creator.close();
  await receiver.close();
});
