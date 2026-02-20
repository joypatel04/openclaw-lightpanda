import assert from "node:assert/strict";
import { config } from "../config.js";
import { LightpandaClient } from "../src/lightpanda-client.js";

const client = new LightpandaClient({
  cdpUrl: config.lightpandaCdpUrl,
  defaultTimeoutMs: config.defaultTimeoutMs,
  maxConcurrentSessions: config.maxConcurrentSessions
});

try {
  const title = await client.withPage(async (page) => {
    const result = await page.evaluate(() => document.title);
    return result;
  }, {
    url: "https://example.com",
    waitUntil: "domcontentloaded",
    timeoutMs: 30000
  });

  assert.equal(typeof title, "string");
  assert.ok(title.length > 0);
  console.log("test-evaluate passed");
} finally {
  await client.close().catch(() => {});
}
