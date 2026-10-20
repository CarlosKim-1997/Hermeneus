import type { Page } from "@playwright/test";

export async function devSignIn(page: Page, slot: "primary" | "secondary" = "primary") {
  await page.goto("/login");
  const label =
    slot === "secondary" ? "테스트 계정 B로 시작" : "테스트 계정으로 시작";
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForURL("**/handoffs");
}
