import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("game view has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("workspace view has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("15 keyboard picks crown a named champion with a bracket recap", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#round-label")).toHaveText(
    "Round of 16 — match 1 of 8",
  );
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
  }
  await expect(page.locator("#game-result")).toBeVisible();
  await expect(page.locator("#result-name")).not.toBeEmpty();
  await expect(page.locator("#result-tagline")).not.toBeEmpty();
  await expect(page.locator("#result-value")).toContainText("oklch(");
  await expect(page.locator("#result-runnerup")).toContainText("in the final");
  await page.locator("#game-result summary").click();
  await expect(page.locator("#result-explanation li")).toHaveCount(15);

  // Determinism: replaying the same picks crowns the same champion.
  const firstResult = await page.locator("#result-value").textContent();
  const firstName = await page.locator("#result-name").textContent();
  await page.getByRole("button", { name: "Play again" }).click();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
  }
  await expect(page.locator("#result-value")).toHaveText(firstResult!);
  await expect(page.locator("#result-name")).toHaveText(firstName!);

  // The result carries into the workspace.
  await page
    .getByRole("button", { name: "Fine-tune it in the workspace" })
    .click();
  await expect(page.locator("#workspace-view")).toBeVisible();
  const hex = firstResult!.split("· ")[1]!.trim();
  await expect(page.locator("#in-hex")).toHaveValue(hex);
});

test("bracket progress survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.locator("#pick-left").click();
  await page.locator("#pick-right").click();
  await expect(page.locator("#round-label")).toHaveText(
    "Round of 16 — match 3 of 8",
  );
  await page.reload();
  await expect(page.locator("#round-label")).toHaveText(
    "Round of 16 — match 3 of 8",
  );
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.locator("#round-label")).toHaveText(
    "Round of 16 — match 1 of 8",
  );
});

test("editing hex synchronizes every format and the share URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("#in-hex").fill("#1a7f5c");
  await expect(page.locator("#in-r")).toHaveValue("26");
  await expect(page.locator("#in-g")).toHaveValue("127");
  await expect(page.locator("#in-b")).toHaveValue("92");
  const okL = Number(await page.locator("#in-ok-l").inputValue());
  expect(okL).toBeGreaterThan(0.5);
  expect(okL).toBeLessThan(0.6);

  // The share URL round trips to the same color in a fresh page, opening
  // straight into the workspace.
  const shareUrl = await page.locator("#share-url").inputValue();
  expect(new URL(shareUrl).hash.length).toBeLessThanOrEqual(64);
  await page.goto(shareUrl);
  await expect(page.locator("#workspace-view")).toBeVisible();
  await expect(page.locator("#in-hex")).toHaveValue("#1a7f5c");
});

test("contrast table reports pass and fail as text", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("#in-hex").fill("#767676");
  const rows = page.locator("#contrast-table tbody tr");
  await expect(rows).toHaveCount(3);
  const whiteRow = rows.filter({ hasText: "White" });
  await expect(whiteRow.locator("td").nth(1)).toHaveText("Pass"); // AA normal
  await expect(whiteRow.locator("td").nth(3)).toHaveText("Fail"); // AAA normal
});

test("corrupt saved state falls back to a fresh game", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("perfect-color:v2", "{corrupt!"),
  );
  await page.goto("/");
  await expect(page.locator("#round-label")).toHaveText(
    "Round of 16 — match 1 of 8",
  );
});
