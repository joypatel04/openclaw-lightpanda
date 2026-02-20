import puppeteer from "puppeteer-core";

const DEFAULT_WAIT_UNTIL = "domcontentloaded";

function createNoActivePageError() {
  return Object.assign(new Error("No active page. Provide 'url' or call lightpanda_navigate first."), {
    code: "NO_ACTIVE_PAGE"
  });
}

export function normalizeError(error, extra = {}) {
  const details = {
    name: error?.name || "Error",
    message: error?.message || "Unknown error"
  };

  if (error?.code) {
    details.code = error.code;
  }

  if (typeof error?.retriable === "boolean") {
    details.retriable = error.retriable;
  }

  if (error?.stack) {
    details.stack = error.stack;
  }

  return {
    ...extra,
    error: details
  };
}

export class LightpandaClient {
  constructor({ cdpUrl, defaultTimeoutMs }) {
    this.cdpUrl = cdpUrl;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.browser = null;
    this.page = null;
    this.queue = Promise.resolve();
  }

  enqueue(operation) {
    const run = this.queue.then(operation, operation);
    this.queue = run.catch(() => {});
    return run;
  }

  async connect() {
    if (this.browser?.connected) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.connect({
        browserWSEndpoint: this.cdpUrl,
        defaultViewport: null,
        timeout: this.defaultTimeoutMs
      });
    } catch (error) {
      error.code = error.code || "CDP_CONNECT_ERROR";
      throw error;
    }

    return this.browser;
  }

  hasActivePage() {
    return Boolean(this.page && !this.page.isClosed());
  }

  async ensurePage(timeoutMs) {
    const browser = await this.connect();

    if (!this.hasActivePage()) {
      this.page = await browser.newPage();
    }

    this.page.setDefaultTimeout(timeoutMs);
    return this.page;
  }

  getActivePageOrThrow(timeoutMs) {
    if (!this.hasActivePage()) {
      throw createNoActivePageError();
    }

    this.page.setDefaultTimeout(timeoutMs);
    return this.page;
  }

  async withPage(fn, options = {}) {
    const {
      url,
      waitUntil = DEFAULT_WAIT_UNTIL,
      timeoutMs = this.defaultTimeoutMs
    } = options;

    return this.enqueue(async () => {
      let page;

      if (url) {
        page = await this.ensurePage(timeoutMs);
        await page.goto(url, { waitUntil, timeout: timeoutMs });
      } else {
        page = this.getActivePageOrThrow(timeoutMs);
      }

      return fn(page);
    });
  }

  async close() {
    await this.enqueue(async () => {
      if (this.hasActivePage()) {
        await this.page.close().catch(() => {});
        this.page = null;
      }

      if (this.browser?.connected) {
        await this.browser.disconnect();
      }

      this.browser = null;
    });
  }
}
