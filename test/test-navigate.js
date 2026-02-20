import assert from "node:assert/strict";
import { config } from "../config.js";
import { LightpandaClient } from "../src/lightpanda-client.js";

const client = new LightpandaClient({
  cdpUrl: config.lightpandaCdpUrl,
  defaultTimeoutMs: config.defaultTimeoutMs,
  maxConcurrentSessions: config.maxConcurrentSessions
});

try {
  const result = await client.withPage(async (page) => {
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    return {
      url: page.url(),
      title: await page.title()
    };
  }, { timeoutMs: 30000 });

  assert.match(result.url, /^https:\/\/example\.com/);
  assert.equal(result.title, "Example Domain");
  console.log("test-navigate passed");
} finally {
  await client.close().catch(() => {});
}
