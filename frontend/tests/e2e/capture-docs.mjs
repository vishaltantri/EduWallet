/**
 * Capture the documentation screenshots from a running, seeded instance.
 *
 * Every figure in the user guide comes from here, so the guide shows the real
 * application with real signed certificates and real transaction hashes
 * rather than mock-ups. Run `seed-demo.mjs` first and pass its JSON output.
 *
 *   node tests/e2e/capture-docs.mjs <seed.json> [outputDir]
 */

import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const seed = JSON.parse(readFileSync(process.argv[2], "utf8"));
const outDir = process.argv[3] || "../docs/screenshots";
const BASE = (process.env.BASE_URL || "http://127.0.0.1:3120").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
});

const captured = [];
let failures = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Open a page as a given account, settle the animations, then shoot.
 *
 * The session is injected into localStorage rather than typed into the login
 * form: the token is a real one from the seed, the app validates it against
 * /api/auth/me on load, and it keeps the captures deterministic.
 */
async function shoot(name, path, { account, fullPage = true, before, settle = 1800, viewport } = {}) {
  const page = await browser.newPage();
  try {
    if (viewport) await page.setViewport({ ...viewport, deviceScaleFactor: 2 });

    if (account) {
      await page.evaluateOnNewDocument(
        (token, user) => {
          localStorage.setItem("eduwallet_token", token);
          localStorage.setItem("eduwallet_user", user);
        },
        account.token,
        JSON.stringify(account.user)
      );
    }

    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitForReady(page);
    await sleep(settle);
    if (before) await before(page);
    await sleep(500);

    const file = join(outDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage });
    captured.push(`  ${name.padEnd(34)} ${path}`);
  } catch (error) {
    failures += 1;
    captured.push(`  FAILED ${name.padEnd(27)} ${error.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

/** Wait until a loading placeholder is gone and real content has rendered. */
async function waitForReady(page) {
  await page
    .waitForFunction(
      () => {
        const text = document.body.innerText || "";
        if (/Loading dashboard|Loading recovery|Verifying/i.test(text)) return false;
        return text.trim().length > 200;
      },
      { timeout: 45000, polling: 300 }
    )
    .catch(() => undefined);
}

/** Wait for an element whose text contains the fragment, then return it. */
async function waitForText(page, text, tag = "button") {
  await page.waitForFunction(
    (text, tag) =>
      [...document.querySelectorAll(tag)].some((node) =>
        (node.textContent || "").trim().includes(text)
      ),
    { timeout: 30000, polling: 250 },
    text,
    tag
  );
}

/** Click the first element whose trimmed text matches. */
async function clickText(page, text, tag = "button") {
  await waitForText(page, text, tag);
  const clicked = await page.evaluate(
    (text, tag) => {
      const nodes = [...document.querySelectorAll(tag)];
      const target = nodes.find((node) => (node.textContent || "").trim().includes(text));
      if (!target) return false;
      target.click();
      return true;
    },
    text,
    tag
  );
  if (!clicked) throw new Error(`no ${tag} containing "${text}"`);
  await sleep(900);
}

async function clickTab(page, label) {
  await clickText(page, label, "button");
  await sleep(1400);
}

const { university, student, recovering, credentials, shareTokens } = seed;

// ─── Public pages ───────────────────────────────────────────────────────────

await shoot("01-landing", "/");
await shoot("02-login", "/login");
await shoot("03-register", "/register");
await shoot("04-register-institution", "/register", {
  before: async (page) => {
    await clickText(page, "University Staff", "button");
    await sleep(600);
  },
});
await shoot("05-verify-landing", "/verify");

// ─── Verifier journey ───────────────────────────────────────────────────────

await shoot("06-verify-valid", `/verify/${credentials.degree}`, { settle: 3500 });
await shoot("07-verify-revoked", `/verify/${credentials.revoked}`, { settle: 3000 });
await shoot("08-verify-share-anonymised", `/verify/share/${shareTokens.anonymous}`, { settle: 3000 });
await shoot("09-public-profile", `/u/${student.user.walletAddress}`, { settle: 2500 });
await shoot("10-verify-not-found", "/verify/00000000-0000-0000-0000-000000000000", { settle: 2500 });

// ─── Institution journey ────────────────────────────────────────────────────

await shoot("11-institution-issue", "/university/dashboard", { account: university, settle: 2600 });

await shoot("13-institution-bulk", "/university/dashboard", {
  account: university,
  settle: 2600,
  before: async (page) => await clickTab(page, "Bulk Upload"),
});

await shoot("14-institution-manage", "/university/dashboard", {
  account: university,
  settle: 2800,
  before: async (page) => await clickTab(page, "Credentials"),
});

await shoot("15-institution-analytics", "/university/dashboard", {
  account: university,
  settle: 3200,
  before: async (page) => await clickTab(page, "Analytics"),
});

await shoot("16-institution-guardianship", "/university/dashboard", {
  account: university,
  settle: 3000,
  before: async (page) => await clickTab(page, "Guardianship"),
});

await shoot("17-institution-account", "/university/dashboard", {
  account: university,
  settle: 2600,
  before: async (page) => await clickTab(page, "Account"),
});

// ─── Student journey ────────────────────────────────────────────────────────

await shoot("18-student-dashboard", "/student/dashboard", { account: student, settle: 3000 });

await shoot("19-student-share-dialog", "/student/dashboard", {
  account: student,
  settle: 3000,
  fullPage: false,
  before: async (page) => await clickText(page, "Share", "button"),
});

await shoot("20-student-recovery", "/student/recovery", { account: student, settle: 3000 });

await shoot("21-student-recovery-pending", "/student/recovery", {
  account: recovering,
  settle: 3000,
});

await shoot("22-student-wallet-export", "/student/recovery", {
  account: student,
  settle: 3000,
  before: async (page) => await clickText(page, "Export wallet key", "button"),
});

await shoot("23-student-password-change", "/student/recovery", {
  account: student,
  settle: 3000,
  before: async (page) => await clickText(page, "Change password", "button"),
});

// ─── Mobile ─────────────────────────────────────────────────────────────────

await shoot("24-mobile-verify", `/verify/${credentials.degree}`, {
  settle: 3500,
  viewport: { width: 390, height: 844 },
});
await shoot("25-mobile-student-dashboard", "/student/dashboard", {
  account: student,
  settle: 3000,
  viewport: { width: 390, height: 844 },
});

await browser.close();

console.log(captured.join("\n"));
console.log(`\n${captured.length - failures} captured, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
