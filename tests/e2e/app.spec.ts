import { test, expect } from "@playwright/test";

const SAMPLE_NOTICE = [
  "CEDAR COUNTY BENEFITS",
  "It is time to renew your benefits.",
  "The benefits you need to renew have a check-mark next to them:",
  "[x] SNAP",
  "Due dates:",
  "Return your form by 11/01/2026.",
  "Items we need from you: send copies.",
  "\u2022 Proof of income: last 4 pay stubs."
].join("\n");

async function loadOfficialSample(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.selectOption("#sample-select", "official");
  await expect(page.locator("#results")).toBeVisible();
}

test.describe("core flow", () => {
  test("bundled official sample renders the checklist and refuses the blank due date", async ({
    page
  }) => {
    await loadOfficialSample(page);
    await expect(page.locator("#checklist")).toContainText("not stated");
    await expect(page.locator("#doc-title")).toContainText("Checklist");
    await expect(page.locator("#source-view")).toContainText("Form H1830-R");
  });

  test("every checklist item carries evidence, and clicking it flashes the source line", async ({
    page
  }) => {
    await loadOfficialSample(page);
    const item = page.locator("details.cl-item").first();
    await item.locator("summary").click();
    const quote = item.locator(".ev-quote").first();
    await expect(quote).toBeVisible();
    await quote.click();
    await expect(page.locator(".src-line.flash")).toHaveCount(1);
  });

  test("paste path analyzes free text", async ({ page }) => {
    await page.goto("/");
    await page.fill("#paste", SAMPLE_NOTICE);
    await page.click("#analyze-paste");
    await expect(page.locator("#results")).toBeVisible();
    await expect(page.locator("#checklist")).toContainText("11/01/2026");
    await expect(page.locator("#program-chips")).toContainText("SNAP");
  });

  test("text file upload is read and analyzed", async ({ page }) => {
    await page.goto("/");
    await page.setInputFiles("#file-input", {
      name: "notice.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(SAMPLE_NOTICE)
    });
    await expect(page.locator("#results")).toBeVisible();
    await expect(page.locator("#checklist")).toContainText("11/01/2026");
  });

  test("a scanned image-only PDF warns instead of guessing", async ({ page }) => {
    await page.goto("/");
    await page.setInputFiles("#file-input", "qa/fixtures/scanned-blank.pdf");
    await expect(page.locator("#results")).toBeVisible();
    await expect(page.locator("#warnings")).toContainText(/scanned/i);
    await expect(page.locator("#checklist")).toContainText("Unreadable");
  });

  test("choosing another sample replaces the previous checklist (reset)", async ({ page }) => {
    await loadOfficialSample(page);
    await expect(page.locator("#doc-title")).toContainText("H1830");
    await page.selectOption("#sample-select", "synthetic-conflict");
    await expect(page.locator("#doc-title")).toContainText("different due dates");
    await expect(page.locator("#checklist")).toContainText("Conflicting");
  });

  test("a synthetic sample carries its disclosure banner", async ({ page }) => {
    await page.goto("/");
    await page.selectOption("#sample-select", "synthetic-conflict");
    await expect(page.locator("#warnings")).toContainText(/synthetic/i);
  });
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("results stack with no horizontal overflow at phone width", async ({ page }) => {
    await loadOfficialSample(page);
    await expect(page.locator("#checklist")).toContainText("not stated");
    const { scrollW, clientW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth
    }));
    expect(scrollW).toBeLessThanOrEqual(clientW + 2);
    await expect(page.locator("#checklist")).toBeVisible();
    await expect(page.locator("#source-view")).toBeVisible();
  });
});

test.describe("zoom", () => {
  test("checklist stays usable at 200% zoom", async ({ page }) => {
    await loadOfficialSample(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.locator("#checklist")).toContainText("not stated");
    const item = page.locator("details.cl-item").first();
    await item.locator("summary").click();
    await item.locator(".ev-quote").first().click();
    await expect(page.locator(".src-line.flash")).toHaveCount(1);
  });
});
