import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHICAGO_TIME_ZONE, DEFAULT_NAVIGATION_TIMEOUT_MS, DEFAULT_SETTLE_MS, USER_AGENT } from './constants.mjs';
import { checkRobots } from './robots.mjs';

async function isFile(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function systemBrowserCandidates() {
  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES;
    const programFilesX86 = process.env['PROGRAMFILES(X86)'];
    const localAppData = process.env.LOCALAPPDATA;
    return [
      process.env.LIBRARY_LOOP_BROWSER_PATH,
      programFiles && path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      programFilesX86 && path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      localAppData && path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      programFiles && path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      programFilesX86 && path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean);
  }
  if (process.platform === 'darwin') {
    return [
      process.env.LIBRARY_LOOP_BROWSER_PATH,
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean);
  }
  return [
    process.env.LIBRARY_LOOP_BROWSER_PATH,
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
}

export async function resolveBrowserExecutable(overridePath) {
  const candidates = overridePath ? [path.resolve(overridePath)] : systemBrowserCandidates();
  for (const candidate of candidates) if (await isFile(candidate)) return candidate;
  throw new Error('No system Chrome or Edge executable was found. Set LIBRARY_LOOP_BROWSER_PATH or pass --browser-path.');
}

async function explicitPlaywrightSpecifier(modulePath) {
  if (!modulePath) return '';
  const resolved = path.resolve(modulePath);
  const details = await stat(resolved).catch(() => null);
  if (!details) throw new Error('The configured Playwright module path does not exist.');
  const entry = details.isDirectory() ? path.join(resolved, 'index.mjs') : resolved;
  if (!(await isFile(entry))) throw new Error('The configured Playwright directory does not contain index.mjs.');
  return pathToFileURL(entry).href;
}

async function loadPlaywrightCore(modulePath) {
  const explicit = await explicitPlaywrightSpecifier(modulePath || process.env.LIBRARY_LOOP_PLAYWRIGHT_PATH);
  if (explicit) return import(explicit);
  try {
    return await import('playwright-core');
  } catch (coreError) {
    try {
      return await import('playwright');
    } catch {
      const error = new Error('Playwright Core is not installed for this project. Install or expose playwright-core before running browser collection.');
      error.cause = coreError;
      throw error;
    }
  }
}

export async function openBrowserSession(options = {}) {
  const executablePath = await resolveBrowserExecutable(options.browserPath);
  const playwright = await loadPlaywrightCore(options.playwrightPath);
  const browser = await playwright.chromium.launch({
    executablePath,
    headless: options.headless !== false,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'],
  });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'en-US',
    timezoneId: CHICAGO_TIME_ZONE,
    serviceWorkers: 'block',
  });
  return {
    browser,
    context,
    executablePath,
    async close() {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

async function detectAccessBarrier(page) {
  return page.evaluate(() => {
    const body = (document.body?.innerText ?? '').slice(0, 20_000).toLowerCase();
    const title = document.title.toLowerCase();
    const url = location.href.toLowerCase();
    const iframeSources = [...document.querySelectorAll('iframe[src]')].map((frame) => frame.getAttribute('src') ?? '');
    const captchaFrame = iframeSources.some((src) => /recaptcha|hcaptcha|captcha|challenge/i.test(src));
    const captchaText = /verify (?:that )?you are human|security check|captcha|cloudflare ray id|checking your browser/.test(`${title} ${body.slice(0, 4_000)}`);
    const loginForm = Boolean(document.querySelector('input[type="password"]'));
    const loginUrl = /\/(?:login|signin|sign-in|account)(?:[/?#]|$)/.test(url);
    if (captchaFrame || captchaText) return { blocked: true, reason: 'CAPTCHA or anti-bot challenge detected', iframeSources };
    if (loginForm || loginUrl) return { blocked: true, reason: 'Login is required', iframeSources };
    return { blocked: false, reason: '', iframeSources };
  });
}

async function extractDomCandidates(page) {
  return page.evaluate(() => {
    const selectors = [
      '[itemtype*="schema.org/Event"]',
      '[itemtype$="/Event"]',
      '[data-event-id]',
      '.tribe-events-calendar-list__event',
      '.mec-event-article',
      '.event-card',
      '.calendar-event',
      'article[class*="event"]',
      'li[class*="event"]',
    ];
    const nodes = [];
    const seenNodes = new Set();
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (!seenNodes.has(node)) {
          seenNodes.add(node);
          nodes.push(node);
        }
      }
    }
    const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const attr = (node, ...names) => {
      for (const name of names) {
        const value = node?.getAttribute?.(name);
        if (value) return value;
      }
      return '';
    };
    const valueFrom = (root, selector) => {
      const node = root.querySelector(selector);
      return attr(node, 'datetime', 'content', 'data-start-date', 'data-date', 'value') || text(node);
    };
    const output = [];
    const seen = new Set();
    for (const node of nodes.slice(0, 240)) {
      const titleNode = node.querySelector('[itemprop="name"], .event-title, .tribe-events-calendar-list__event-title, h1, h2, h3, h4');
      const title = text(titleNode);
      const start = valueFrom(node, '[itemprop="startDate"], time[datetime], [data-start-date]');
      const end = valueFrom(node, '[itemprop="endDate"], time[data-end], [data-end-date]');
      const linkNode = node.querySelector('a[itemprop="url"], .event-title a, h1 a, h2 a, h3 a, h4 a, a[href]');
      const url = linkNode?.href ?? '';
      const description = text(node.querySelector('[itemprop="description"], .event-description, .description, .entry-summary, p'));
      const venue = text(node.querySelector('[itemprop="location"] [itemprop="name"], .event-venue, .venue'));
      const address = text(node.querySelector('[itemprop="address"], .event-location, .location, address'));
      const allText = text(node).slice(0, 5_000);
      if (!title || title.length < 3 || allText.length > 12_000) continue;
      const key = `${title.toLowerCase()}|${start}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({ extractionMethod: 'semantic-dom', title, start, end, url, registrationUrl: url, description, venue, address, text: allText });
      if (output.length >= 150) break;
    }
    return output;
  });
}

export async function collectSourcePage(session, source, options = {}) {
  if (!source.url) {
    return {
      outcome: 'blocked',
      error: 'No verified source URL is configured',
      audit: { sourceId: source.id, robots: null, finalUrl: null, pageTitle: null, rawJsonLdCount: 0, domCandidateCount: 0, iframeSources: [] },
      rawJsonLd: [],
      domCandidates: [],
    };
  }

  const robots = await checkRobots(source.url, { timeoutMs: options.robotsTimeoutMs });
  if (!robots.allowed) {
    return {
      outcome: 'blocked',
      error: robots.reason,
      audit: { sourceId: source.id, robots, finalUrl: null, pageTitle: null, rawJsonLdCount: 0, domCandidateCount: 0, iframeSources: [] },
      rawJsonLd: [],
      domCandidates: [],
    };
  }

  const page = await session.context.newPage();
  try {
    const response = await page.goto(source.url, {
      waitUntil: 'domcontentloaded',
      timeout: options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS,
    });
    const status = response?.status() ?? 0;
    if ([401, 403].includes(status)) {
      return {
        outcome: 'blocked',
        error: `Source returned HTTP ${status}`,
        audit: { sourceId: source.id, robots, finalUrl: page.url(), pageTitle: await page.title(), responseStatus: status, rawJsonLdCount: 0, domCandidateCount: 0, iframeSources: [] },
        rawJsonLd: [],
        domCandidates: [],
      };
    }
    if (status >= 400) throw new Error(`Source returned HTTP ${status}`);
    await page.waitForTimeout(options.settleMs ?? DEFAULT_SETTLE_MS);

    const barrier = await detectAccessBarrier(page);
    if (barrier.blocked) {
      return {
        outcome: 'blocked',
        error: barrier.reason,
        audit: { sourceId: source.id, robots, finalUrl: page.url(), pageTitle: await page.title(), responseStatus: status, rawJsonLdCount: 0, domCandidateCount: 0, iframeSources: barrier.iframeSources },
        rawJsonLd: [],
        domCandidates: [],
      };
    }

    const rawJsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const domCandidates = await extractDomCandidates(page);
    return {
      outcome: 'collected',
      audit: {
        sourceId: source.id,
        robots,
        finalUrl: page.url(),
        pageTitle: await page.title(),
        responseStatus: status,
        rawJsonLdCount: rawJsonLd.length,
        domCandidateCount: domCandidates.length,
        iframeSources: barrier.iframeSources,
      },
      rawJsonLd,
      domCandidates,
    };
  } finally {
    await page.close().catch(() => {});
  }
}
