import { test, expect, type Page } from "@playwright/test";

const BILL = "FICTIONAL ELECTRICITY BILL\nAmount due: $42\nPay by November 1, 2026.\nAccount: EXAMPLE";

async function official(page: Page) {
  await page.goto("/");
  await page.selectOption("#sample-select", "official");
  await expect(page.locator("#doc-title")).toContainText("H1830");
}

test("official sample → pasted bill clears sample provenance", async ({ page }, testInfo) => {
  await official(page);
  await page.fill("#paste", BILL);
  await page.click("#analyze-paste");
  await expect(page.locator("#doc-title")).toContainText(/Unsupported document.*pasted text/);
  await page.screenshot({ path: testInfo.outputPath("pasted-bill.png"), fullPage: true });
  await expect(page.locator("#sample-select")).toHaveValue("");
  await expect(page.locator("#sample-blurb")).toBeEmpty();
  await expect(page.locator("#results")).toHaveAttribute("data-state", "current");
  await expect(page.locator("#results")).toHaveAttribute("aria-busy", "false");
});

test("failed empty paste clears previous results and their navigation", async ({ page }, testInfo) => {
  await official(page);
  await page.locator("summary").first().click();
  await page.locator(".ev-quote").first().evaluate((el) => (el as HTMLButtonElement).click());
  await page.click("#analyze-paste");
  await expect(page.locator("#status-line")).toContainText("Paste some letter text first.");
  await page.screenshot({ path: testInfo.outputPath("empty-paste.png") });
  await expect(page.locator("#results")).toBeHidden();
  await expect(page.locator("#results")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#results")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".selected-source, .flash, .return-to-quote")).toHaveCount(0);
  await expect(page.locator("#sample-select")).toHaveValue("");
  await expect(page.locator("#sample-blurb")).toBeEmpty();
});

for (const fail of [false, true]) {
  test(`delayed sample A ${fail ? "failure" : "success"} cannot replace pasted B`, async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/samples/h1830r-official-sample.txt", async (route) => {
      await gate;
      await route.fulfill({ status: fail ? 500 : 200, body: "Sample A benefits renewal notice" });
    });
    await page.goto("/");
    await page.selectOption("#sample-select", "official");
    await expect(page.locator("#status-line")).toContainText("Loading");
    await expect(page.locator("#results")).toBeHidden();
    await expect(page.locator("#results")).toHaveAttribute("data-state", "loading");
    await expect(page.locator("#results")).toHaveAttribute("aria-busy", "true");
    await page.fill("#paste", BILL);
    await page.click("#analyze-paste");
    await expect(page.locator("#doc-title")).toContainText("pasted text");
    const response = page.waitForResponse("**/samples/h1830r-official-sample.txt");
    release();
    await response;
    // Give response.text() and its rendering continuation a browser task turn.
    await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
    await expect(page.locator("#doc-title")).toContainText("pasted text");
    await expect(page.locator("#source-view")).toContainText("FICTIONAL ELECTRICITY BILL");
    await expect(page.locator("#status-line")).toHaveText("Showing results for pasted text.");
  });
}

test("file results clear official sample metadata, then failed input clears those results", async ({ page }) => {
  await official(page);
  await page.setInputFiles("#file-input", { name: "bill.txt", mimeType: "text/plain", buffer: Buffer.from(BILL) });
  await expect(page.locator("#doc-title")).toContainText("bill.txt");
  await expect(page.locator("#sample-select")).toHaveValue("");
  await expect(page.locator("#sample-blurb")).toBeEmpty();
  await expect(page.locator("#status-line")).toHaveText("Showing results for bill.txt.");
  await page.setInputFiles("#file-input", { name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("x,y") });
  await expect(page.locator("#status-line")).toContainText("not a supported file type");
  await expect(page.locator("#results")).toBeHidden();
});

test("a newer failed paste invalidates an older pending sample", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/samples/h1830r-official-sample.txt", async (route) => {
    await gate;
    await route.fulfill({ body: "Old sample benefits renewal notice" });
  });
  await page.goto("/");
  await page.selectOption("#sample-select", "official");
  await expect(page.locator("#status-line")).toContainText("Loading");
  await page.click("#analyze-paste");
  const response = page.waitForResponse("**/samples/h1830r-official-sample.txt");
  release();
  await response;
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
  await expect(page.locator("#status-line")).toContainText("Paste some letter text first.");
  await expect(page.locator("#results")).toBeHidden();
});

test("slow file A cannot replace newer pasted B", async ({ page }) => {
  await page.addInitScript(() => {
    const readText = File.prototype.text;
    File.prototype.text = async function () {
      if (this.name === "slow.txt") {
        await new Promise<void>((resolve) => Object.assign(window, { releaseFile: resolve }));
      }
      return readText.call(this);
    };
  });
  await page.goto("/");
  await page.setInputFiles("#file-input", { name: "slow.txt", mimeType: "text/plain", buffer: Buffer.from("Old file benefits renewal notice") });
  await expect(page.locator("#status-line")).toContainText("Reading slow.txt");
  await page.fill("#paste", BILL);
  await page.click("#analyze-paste");
  await page.evaluate(() => (window as unknown as { releaseFile: () => void }).releaseFile());
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
  await expect(page.locator("#doc-title")).toContainText("pasted text");
  await expect(page.locator("#status-line")).toHaveText("Showing results for pasted text.");
});
