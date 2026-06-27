// One-off presentation asset generator: signs in as the manager and captures
// every dashboard page to docs/screenshots/*.png. Not part of the app build.
// Requires puppeteer-core (install transiently) + a local Chrome, dev server on :3010.
//   npm install --no-save puppeteer-core && node scripts/shots.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3010";
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

async function shot(name, { full = true } = {}) {
  await sleep(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("saved", name);
}

// Sign in as Shir (the manager): first button on the demo login page.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.click("button");
await page.waitForNavigation({ waitUntil: "networkidle0" });

// 1. Team overview
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0" });
await shot("01-team-overview");

// 2. Per-junior profile — Elyan, the "improving" story.
const elyanHref = await page.$$eval("a", (as) => {
  const a = as.find((x) => /\/dashboard\/juniors\//.test(x.getAttribute("href") || "") && /Elyan/.test(x.textContent || ""));
  return a ? a.getAttribute("href") : null;
});
if (elyanHref) {
  await page.goto(`${BASE}${elyanHref}`, { waitUntil: "networkidle0" });
  await shot("02-junior-profile-elyan");
}

// 3. All-PRs view (pie + histogram + table)
await page.goto(`${BASE}/dashboard/prs`, { waitUntil: "networkidle0" });
await shot("03-all-prs");

// 4. PR detail — Elyan's first (messy) PR, the one the worked example walks through.
const prHref = await page.$$eval("a", (as) => {
  const a = as.find((x) => /\/dashboard\/prs\/[^/]+$/.test(x.getAttribute("href") || "") && /Elyan feature 1\b/.test(x.textContent || ""));
  return a ? a.getAttribute("href") : null;
});
if (prHref) {
  await page.goto(`${BASE}${prHref}`, { waitUntil: "networkidle0" });
  await shot("04-pr-detail-elyan");
}

// 5. Manage conventions tree
await page.goto(`${BASE}/dashboard/manage-conventions`, { waitUntil: "networkidle0" });
await shot("05-manage-conventions");

// 6. Review a PR form
await page.goto(`${BASE}/dashboard/review`, { waitUntil: "networkidle0" });
await shot("06-review-a-pr");

await browser.close();
console.log("done");
