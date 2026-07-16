import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("quiz completes by keyboard and explains the result", async ({ page }) => {
  await page.goto("/");
  // Answer all six questions with the first option using only the keyboard.
  for (let i = 0; i < 6; i++) {
    await page.locator(`input[name="q${i}"]`).first().press("Space");
  }
  await page.getByRole("button", { name: "Reveal my color" }).press("Enter");
  await expect(page.locator("#quiz-result")).toBeVisible();
  await expect(page.locator("#quiz-result-value")).toContainText("oklch(");
  await expect(page.locator("#quiz-explanation li")).toHaveCount(6);

  await page
    .getByRole("button", { name: "Use this color in the workspace" })
    .press("Enter");
  const hexAfterQuiz = await page.locator("#in-hex").inputValue();
  expect(hexAfterQuiz).toMatch(/^#[0-9a-f]{6}$/);
});

test("editing hex synchronizes every format and the share URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#in-hex").fill("#1a7f5c");
  await expect(page.locator("#in-r")).toHaveValue("26");
  await expect(page.locator("#in-g")).toHaveValue("127");
  await expect(page.locator("#in-b")).toHaveValue("92");
  const okL = Number(await page.locator("#in-ok-l").inputValue());
  expect(okL).toBeGreaterThan(0.5);
  expect(okL).toBeLessThan(0.6);

  // The share URL round trips to the same color in a fresh page.
  const shareUrl = await page.locator("#share-url").inputValue();
  expect(new URL(shareUrl).hash.length).toBeLessThanOrEqual(64);
  await page.goto(shareUrl);
  await expect(page.locator("#in-hex")).toHaveValue("#1a7f5c");
});

test("contrast table reports pass and fail as text", async ({ page }) => {
  await page.goto("/");
  await page.locator("#in-hex").fill("#767676");
  const rows = page.locator("#contrast-table tbody tr");
  await expect(rows).toHaveCount(3);
  const whiteRow = rows.filter({ hasText: "White" });
  await expect(whiteRow.locator("td").nth(1)).toHaveText("Pass"); // AA normal
  await expect(whiteRow.locator("td").nth(3)).toHaveText("Fail"); // AAA normal
});

test("corrupt saved state falls back to the default color", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("perfect-color:v1", "{corrupt!"),
  );
  await page.goto("/");
  await expect(page.locator("#current-value")).toContainText("oklch(");
});
