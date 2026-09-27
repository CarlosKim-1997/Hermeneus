import type { Page } from "@playwright/test";

export async function devSignIn(page: Page, slot: "primary" | "secondary" = "primary") {
  await page.goto("/login");
  const label =
    slot === "secondary" ? "Sign in as development Creator B" : "Sign in as development Creator";
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForURL("**/handoffs");
}
