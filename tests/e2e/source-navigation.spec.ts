import { test, expect, type Page } from "@playwright/test";

async function openQuotes(page: Page) {
  await page.goto("/");
  await page.selectOption("#sample-select", "official");
  await expect(page.locator("#doc-title")).toContainText("H1830");
  await page.locator("details.cl-item").evaluateAll((items) => {
    for (const item of items) (item as HTMLDetailsElement).open = true;
  });
}

test("rapid A → B → A replaces selection and decorative emphasis", async ({ page }) => {
  await openQuotes(page);
  const quotes = page.locator(".ev-quote");
  const a = quotes.first();
  const sourceA = await a.getAttribute("data-source-id");
  const b = page.locator(`.ev-quote:not([data-source-id="${sourceA}"])`).first();
  const sourceB = await b.getAttribute("data-source-id");
  for (const [quote, target] of [[a, sourceA], [b, sourceB], [a, sourceA]] as const) {
    await quote.evaluate((el) => (el as HTMLButtonElement).click());
    await expect(page.locator(".selected-source")).toHaveCount(1);
    await expect(page.locator(".selected-source")).toHaveAttribute("id", target!);
    expect(await page.locator(".src-line.flash").count()).toBeLessThanOrEqual(1);
    await expect(page.locator(".return-to-quote")).toHaveCount(1);
  }
  // Animation completion must not remove the meaningful selection.
  await expect(page.locator(".src-line.flash")).toHaveCount(0);
  await expect(page.locator(".selected-source")).toHaveAttribute("aria-current", "true");
});

test("switching documents during emphasis clears every source navigation state", async ({ page }) => {
  await openQuotes(page);
  await page.locator(".ev-quote").first().evaluate((el) => (el as HTMLButtonElement).click());
  await page.selectOption("#sample-select", "synthetic-conflict");
  await expect(page.locator("#doc-title")).toContainText("different due dates");
  await expect(page.locator(".selected-source, .flash, .return-to-quote, [aria-current]")).toHaveCount(0);
  await expect(page.locator("#source-selection")).toHaveText("No source passage selected.");
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 667 }, { width: 390, height: 844 }]) {
  test.describe(`source route at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("Enter / Space preserve quote focus; Tab reaches Read source and returns to the exact quote", async ({ page }, testInfo) => {
      await openQuotes(page);
      const quote = page.locator(".ev-quote").nth(2);
      const target = await quote.getAttribute("data-source-id");
      await quote.focus();
      for (const key of ["Enter", "Space"]) {
        await page.keyboard.press(key);
        await expect(quote).toBeFocused();
        await expect(page.locator(".selected-source")).toHaveAttribute("id", target!);
      }
      await page.keyboard.press("Tab");
      const read = quote.locator("..").getByRole("button", { name: /Read source/ });
      await expect(read).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator(`#${target}`)).toBeFocused();
      await expect(page.getByRole("region", { name: "The notice" })).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Return to quote" })).toBeFocused();
      await expect(page.locator(".src-line.flash")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`source-${viewport.width}.png`), fullPage: false });
      await page.keyboard.press("Space");
      await expect(quote).toBeFocused();
      await expect(quote).toBeInViewport();
      if (viewport.width < 861) {
        expect(await page.locator(".source-pane").evaluate((el) => getComputedStyle(el).position)).not.toBe("sticky");
        expect(await page.evaluate(() => document.querySelector(".source-pane")!.compareDocumentPosition(document.querySelector(".checklist-pane")!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      }
      await page.screenshot({ path: testInfo.outputPath(`quote-${viewport.width}.png`), fullPage: false });
    });
  });
}

test("program chip route also restores its own origin", async ({ page }) => {
  await openQuotes(page);
  const chip = page.locator(".prog[role=button]").first();
  await chip.focus();
  await page.keyboard.press("Space");
  await expect(chip).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#program-chips .source-link").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".selected-source")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(chip).toBeFocused();
});

for (const viewport of [{ width: 640, height: 450 }, { width: 320, height: 225 }]) {
  test.describe(`keyboard source scroll at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("an immediate Tab keeps the focused source route visible after smooth scrolling settles", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/");
      await page.selectOption("#sample-select", "synthetic-dated");
      const item = page.locator("details.cl-item").first();
      await item.locator("summary").focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      const quote = item.locator(".ev-quote").first();
      await expect(quote).toBeFocused();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      const read = quote.locator("..").getByRole("button", { name: /Read source/ });
      await expect(read).toBeFocused();
      // This is deliberately a settled assertion: focus was already correct
      // before the old pending scroll moved the control outside the viewport.
      await page.waitForTimeout(700);
      await expect(read).toBeInViewport({ ratio: 1 });
      await page.keyboard.press("Enter");
      await expect(page.locator(".selected-source")).toBeFocused();
      await page.keyboard.press("Tab");
      const back = page.getByRole("button", { name: "Return to quote" });
      await expect(back).toBeFocused();
      await page.waitForTimeout(700);
      await expect(back).toBeInViewport({ ratio: 1 });
      await page.keyboard.press("Space");
      await expect(quote).toBeFocused();
      await expect(quote).toBeInViewport();
    });
  });
}

test("reduced motion disables JS smooth scrolling, emphasis and chevron transitions", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const scroll = Element.prototype.scrollIntoView;
    Object.assign(window, { scrollBehaviors: [] as string[] });
    Element.prototype.scrollIntoView = function (options) {
      (window as unknown as { scrollBehaviors: string[] }).scrollBehaviors.push(typeof options === "object" ? options.behavior ?? "auto" : "auto");
      scroll.call(this, options);
    };
  });
  await openQuotes(page);
  const quote = page.locator(".ev-quote").first();
  await quote.click();
  await quote.locator("..").getByRole("button", { name: /Read source/ }).click();
  await page.getByRole("button", { name: "Return to quote" }).click();
  await expect(quote).toBeFocused();
  const behaviors = await page.evaluate(() => (window as unknown as { scrollBehaviors: string[] }).scrollBehaviors);
  expect(behaviors.length).toBeGreaterThanOrEqual(4);
  expect(behaviors.every((behavior) => behavior === "instant")).toBe(true);
  expect(await page.locator(".selected-source").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  expect(await page.locator("summary").first().evaluate((el) => getComputedStyle(el, "::after").transitionDuration)).toBe("0s");
  await expect(page.locator(".selected-source")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("reduced-motion.png") });
});
