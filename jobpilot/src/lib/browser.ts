// ============================================================
// src/lib/browser.ts
// Headless browser integration via Lightpanda + puppeteer-core.
//
// Lightpanda is a fast, lightweight headless browser designed
// for AI scraping. It exposes a Chrome DevTools Protocol (CDP)
// endpoint that puppeteer-core can connect to.
//
// Fallback: if Lightpanda is not running, we fall back to
// Claude's web_search tool (handled in ai.ts).
// ============================================================

// puppeteer-core: same API as puppeteer but without the bundled Chromium.
// We use it to connect to Lightpanda's existing CDP server.
import puppeteer, { type Browser, type Page } from "puppeteer-core";

// ============================================================
// CONSTANTS
// ============================================================

const LIGHTPANDA_URL = process.env.LIGHTPANDA_WS_URL ?? "ws://127.0.0.1:9222";

// How long to wait for navigation/elements before giving up
const TIMEOUT_MS = 30_000; // 30 seconds

// How long to wait between requests to be polite to servers
const DELAY_MS = { min: 1000, max: 2000 };

// Maximum attempts before giving up
const MAX_RETRIES = 3;

// ============================================================
// UTILITY: sleep
// `Promise<void>` — a Promise that resolves to nothing.
// ============================================================

/**
 * Pauses execution for `ms` milliseconds.
 * TS concept: Arrow function with typed return type `Promise<void>`.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns a random delay between min and max milliseconds.
 * Helps avoid rate limiting by not sending requests at perfectly regular intervals.
 */
function randomDelay(): number {
  return Math.floor(
    Math.random() * (DELAY_MS.max - DELAY_MS.min) + DELAY_MS.min
  );
}

// ============================================================
// BROWSER CONNECTION
// ============================================================

/**
 * Connects to the Lightpanda headless browser via WebSocket CDP.
 *
 * TS concept: `Promise<Browser>` — this async function resolves to a Browser object.
 * If Lightpanda isn't running, this will throw — catch it in callers.
 *
 * @returns A connected puppeteer Browser instance
 * @throws Error if Lightpanda is not reachable
 */
export async function createBrowser(): Promise<Browser> {
  const browser = await puppeteer.connect({
    browserWSEndpoint: LIGHTPANDA_URL,
    // Don't close the browser when done — we share one instance
    defaultViewport: { width: 1280, height: 800 },
  });
  return browser;
}

// ============================================================
// SCRAPING FUNCTIONS
// ============================================================

/**
 * Scrapes a single URL and returns the visible text content.
 *
 * Uses try/finally to guarantee the page is closed even if an error occurs.
 * TS concept: `async/await` — the function is `async` so it always returns
 * a `Promise<string>`. Inside, `await` pauses until the Promise resolves.
 *
 * @param url - The URL to scrape
 * @param retries - How many times to retry on failure (default 3)
 * @returns The visible text content of the page
 */
export async function scrapePage(
  url: string,
  retries: number = MAX_RETRIES
): Promise<string> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      browser = await createBrowser();
      page = await browser.newPage();

      // Set a timeout so we don't wait forever for slow pages
      page.setDefaultNavigationTimeout(TIMEOUT_MS);

      await page.goto(url, {
        // 'networkidle2' means wait until there are ≤2 network requests for 500ms
        waitUntil: "networkidle2",
      });

      // Extract all visible text from the page
      // `evaluate()` runs code inside the browser context (not Node.js)
      const text = await page.evaluate(() => {
        // Remove script and style elements (they're not visible text)
        const scripts = document.querySelectorAll("script, style");
        scripts.forEach((el) => el.remove());
        // Return the remaining visible text
        return document.body.innerText;
      });

      // Be polite: wait before the next request
      await sleep(randomDelay());

      return text;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[browser] scrapePage attempt ${attempt}/${retries} failed for ${url}: ${errorMessage}`
      );

      // If we've used all retries, throw the error
      if (attempt === retries) {
        throw new Error(
          `Failed to scrape ${url} after ${retries} attempts: ${errorMessage}`
        );
      }

      // Exponential backoff: wait 2s, 4s, 8s between retries
      await sleep(1000 * Math.pow(2, attempt));
    } finally {
      // ALWAYS clean up the page, even if an error occurred
      // `?.` optional chaining: only calls close() if page is not null
      await page?.close();
    }
  }

  // TypeScript needs this — the for loop guarantees we either return or throw,
  // but TS doesn't know that, so we add an unreachable fallback
  throw new Error("Unreachable");
}

// ============================================================
// SELECTORS TYPE
// TS concept: Interface for the CSS selector config object
// ============================================================

/**
 * CSS selectors for extracting job listing data from a page.
 * Different job sites use different HTML structures.
 */
export interface JobListingSelectors {
  // Container element for each job card
  container: string;
  // Within each container, which element has the title?
  title: string;
  // Within each container, which element has the company?
  company?: string;
  // Within each container, which element has the location?
  location?: string;
  // Within each container, which element or attribute has the URL?
  link?: string;
}

/**
 * A single raw job extracted from a listing page.
 */
export interface ScrapedJobCard {
  title: string;
  company: string;
  location: string;
  url: string;
  snippet: string;
}

/**
 * Scrapes a job listings page and extracts individual job cards.
 *
 * @param url - The listing page URL (e.g. LinkedIn search results)
 * @param selectors - CSS selectors for the job card structure
 * @returns Array of scraped job cards
 */
export async function scrapeJobListings(
  url: string,
  selectors: JobListingSelectors
): Promise<ScrapedJobCard[]> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await createBrowser();
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT_MS);

    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for the job listing containers to appear
    await page.waitForSelector(selectors.container, { timeout: 10_000 });

    // `page.evaluate()` runs the callback in the browser context.
    // We pass `selectors` as a parameter because the browser context
    // can't access Node.js variables directly.
    const jobs = await page.evaluate((sels: JobListingSelectors) => {
      // This code runs IN the browser, not in Node.js
      const containers = document.querySelectorAll(sels.container);

      // TS concept: `Array.from` converts NodeList to an array so we can use .map()
      return Array.from(containers).map((container): ScrapedJobCard => {
        // TS concept: type assertion `as HTMLElement` — we know this is an element
        const titleEl = container.querySelector(sels.title) as HTMLElement | null;
        const companyEl = sels.company
          ? (container.querySelector(sels.company) as HTMLElement | null)
          : null;
        const locationEl = sels.location
          ? (container.querySelector(sels.location) as HTMLElement | null)
          : null;
        const linkEl = sels.link
          ? (container.querySelector(sels.link) as HTMLAnchorElement | null)
          : null;

        return {
          title: titleEl?.innerText?.trim() ?? "Unknown Title",
          company: companyEl?.innerText?.trim() ?? "",
          location: locationEl?.innerText?.trim() ?? "",
          url: linkEl?.href ?? "",
          snippet: (container as HTMLElement).innerText?.slice(0, 500) ?? "",
        };
      });
    }, selectors);

    await sleep(randomDelay());
    return jobs;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[browser] scrapeJobListings failed for ${url}: ${errorMessage}`);
    // Return empty array instead of throwing — the orchestrator handles partial results
    return [];
  } finally {
    // Always clean up
    await page?.close();
  }
}

/**
 * Checks if the Lightpanda browser is reachable.
 * Used by the pipeline to decide whether to use scraping or AI fallback.
 *
 * TS concept: `Promise<boolean>` — resolves to true or false
 */
export async function isLightpandaAvailable(): Promise<boolean> {
  try {
    const browser = await createBrowser();
    // If we can disconnect immediately, it's working
    await browser.disconnect();
    return true;
  } catch {
    return false;
  }
}
