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
  test("bundled official sample renders the checklist and quotes timing instead of inventing a deadline", async ({
    page
  }) => {
    await loadOfficialSample(page);
    await expect(page.locator("#checklist")).toContainText("Dates and timing mentioned");
    await expect(page.locator("#checklist")).toContainText("as soon as you can");
    await expect(page.locator("#checklist")).not.toContainText(/respond by/i);
    await expect(page.locator("#doc-title")).toContainText("What the letter says");
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
    await expect(page.locator("#checklist")).not.toContainText(/respond by/i);
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
    await expect(page.locator("#checklist")).toContainText(/conflicting instructions/i);
  });

  test("a synthetic sample carries its disclosure banner", async ({ page }) => {
    await page.goto("/");
    await page.selectOption("#sample-select", "synthetic-conflict");
    await expect(page.locator("#warnings")).toContainText(/synthetic/i);
  });

  test("an unsupported file type is rejected with an honest message", async ({ page }) => {
    await page.goto("/");
    await page.setInputFiles("#file-input", {
      name: "export.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("name,amount\nrent,900")
    });
    await expect(page.locator("#status-line")).toContainText(/not a supported file type/i);
    await expect(page.locator("#results")).not.toBeVisible();
  });

  test("pasted non-notice text gets the unsupported view, not a confident checklist", async ({
    page
  }) => {
    await page.goto("/");
    await page.fill("#paste", "name,amount,month\nrent,900.00,January\nfood,300.00,February");
    await page.click("#analyze-paste");
    await expect(page.locator("#results")).toBeVisible();
    await expect(page.locator("#checklist")).toContainText(/not look like a benefits renewal notice/i);
    await expect(page.locator("#checklist")).not.toContainText(/respond by/i);
  });

  test("a previous error clears after a successful paste", async ({ page }) => {
    await page.goto("/");
    await page.click("#analyze-paste");
    await expect(page.locator("#status-line")).not.toBeEmpty();
    await page.fill("#paste", SAMPLE_NOTICE);
    await page.click("#analyze-paste");
    await expect(page.locator("#status-line")).toBeEmpty();
    await expect(page.locator("#checklist")).toContainText("11/01/2026");
  });

  test("switching samples scrolls the notice pane back to the top", async ({ page }) => {
    await loadOfficialSample(page);
    await page.locator("#source-view").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.selectOption("#sample-select", "synthetic-conflict");
    await expect(page.locator("#doc-title")).toContainText("different due dates");
    const top = await page.locator("#source-view").evaluate((el) => el.scrollTop);
    expect(top).toBe(0);
  });
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("results stack with no horizontal overflow at phone width", async ({ page }) => {
    await loadOfficialSample(page);
    await expect(page.locator("#checklist")).toContainText("timing");
    const { scrollW, clientW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth
    }));
    expect(scrollW).toBeLessThanOrEqual(clientW + 2);
    await expect(page.locator("#checklist")).toBeVisible();
    await expect(page.locator("#source-view")).toBeVisible();
  });

  test("source pane is not sticky at phone width and cards are never obscured", async ({
    page
  }) => {
    await loadOfficialSample(page);
    // desktop pins the letter pane; mobile must keep normal document flow
    const pos = await page
      .locator(".panes > .pane:first-child")
      .evaluate((el) => getComputedStyle(el).position);
    expect(pos).not.toBe("sticky");

    // scroll through every checklist card: the topmost element at each
    // card's centre must belong to the card itself — nothing may cover it
    const items = page.locator(".cl-item");
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const el = items.nth(i);
      await el.scrollIntoViewIfNeeded();
      const inside = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = Math.min(
          Math.max(r.top + Math.min(r.height, 28) / 2, r.top + 2),
          r.bottom - 2
        );
        const hit = document.elementFromPoint(cx, cy);
        return hit !== null && node.contains(hit);
      });
      expect(inside, `checklist card ${i} obscured at 375px`).toBe(true);
    }
  });
});

test.describe("zoom", () => {
  test("checklist stays usable at 200% zoom", async ({ page }) => {
    await loadOfficialSample(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.locator("#checklist")).toContainText("timing");
    const item = page.locator("details.cl-item").first();
    await item.locator("summary").click();
    await item.locator(".ev-quote").first().click();
    await expect(page.locator(".src-line.flash")).toHaveCount(1);
  });
});
