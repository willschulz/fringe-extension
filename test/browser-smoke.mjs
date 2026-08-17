import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(here, "..");
const outputPath =
  process.argv[2] ||
  path.join(extensionPath, "evaluation", "browser-smoke-latest.json");
const token = process.env.DEMOSCOPE_API_TOKEN;

if (!token) {
  console.error("Set DEMOSCOPE_API_TOKEN without printing or committing it.");
  process.exit(2);
}

const profile = await fs.mkdtemp(path.join(os.tmpdir(), "fringe-smoke-"));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

const requests = [];
context.on("request", (request) => {
  if (request.url().includes("/demoscope-api/v1/search")) {
    requests.push({
      method: request.method(),
      url: request.url(),
      post_data_bytes: Buffer.byteLength(request.postData() || ""),
    });
  }
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;

  const privacyPage = await context.newPage();
  await privacyPage.goto("https://www.reddit.com/r/politics/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await privacyPage.waitForTimeout(5000);
  const disabledRequestCount = requests.length;
  await privacyPage.close();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const startsDisabled = !(await popup.locator("#enabled").isChecked());
  await popup.locator("#api-token").fill(token);
  await popup.locator("#test-button").click();
  await popup
    .locator("#status")
    .filter({ hasText: "Connected" })
    .waitFor({ timeout: 30000 });
  await popup.locator("#enabled").check();
  const enabledStatus = await popup.locator("#status").textContent();
  await popup.close();

  const targets = [
    {
      platform: "x-live-guest",
      url: "https://x.com/PewResearch",
      selector: 'article[data-testid="tweet"]',
    },
    {
      platform: "x-origin-fixture",
      url: "https://x.com/fringe-detector-smoke",
      selector: 'article[data-testid="tweet"]',
      fixtureHtml: `<!doctype html><html><body>
        <article data-testid="tweet">
          <a href="/pilot/status/123456789"><time datetime="2026-08-17"></time></a>
          <div data-testid="tweetText">Abortion should be legal in all cases.</div>
          <div role="group"></div>
        </article>
      </body></html>`,
    },
    {
      platform: "bluesky",
      url: "https://bsky.app/profile/pewresearch.org/post/3lnfujeefkf2a",
      selector:
        'div[data-testid^="postThreadItem-by-"], div[data-testid^="feedItem-by-"]',
    },
    {
      platform: "reddit",
      url: "https://www.reddit.com/r/politics/",
      selector: "shreddit-post, shreddit-comment, article",
    },
  ];
  const platformResults = [];

  for (const target of targets) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    let navigationError = null;
    try {
      if (target.fixtureHtml) {
        await page.route(target.url, (route) =>
          route.fulfill({
            status: 200,
            contentType: "text/html",
            body: target.fixtureHtml,
          })
        );
      }
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(target.fixtureHtml ? 5000 : 12000);
    } catch (error) {
      navigationError = error.message;
    }
    const finalUrl = new URL(page.url());
    platformResults.push({
      platform: target.platform,
      url: `${finalUrl.origin}${finalUrl.pathname}`,
      title: await page.title(),
      containers: await page.locator(target.selector).count(),
      processed: await page.locator("[data-fringe]").count(),
      badges: await page.locator(".fringe-badge").count(),
      navigation_error: navigationError,
      console_error_count: consoleErrors.length,
      console_errors: consoleErrors.slice(0, 5),
    });
    await page.close();
  }

  const report = {
    generated_at: new Date().toISOString(),
    chromium_version: await context.browser().version(),
    extension_id: extensionId,
    starts_disabled: startsDisabled,
    requests_while_disabled: disabledRequestCount,
    enabled_status: enabledStatus,
    api_requests: requests.length,
    api_request_methods: [...new Set(requests.map((request) => request.method))],
    api_request_urls: [...new Set(requests.map((request) => request.url))],
    max_post_data_bytes: Math.max(
      0,
      ...requests.map((request) => request.post_data_bytes)
    ),
    platforms: platformResults,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      starts_disabled: report.starts_disabled,
      requests_while_disabled: report.requests_while_disabled,
      api_requests: report.api_requests,
      platforms: report.platforms.map(
        ({ platform, containers, processed, badges, navigation_error }) => ({
          platform,
          containers,
          processed,
          badges,
          navigation_error,
        })
      ),
    })
  );
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
