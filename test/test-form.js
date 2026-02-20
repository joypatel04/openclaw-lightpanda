import assert from "node:assert/strict";
import { config } from "../config.js";
import { LightpandaClient } from "../src/lightpanda-client.js";

const client = new LightpandaClient({
  cdpUrl: config.lightpandaCdpUrl,
  defaultTimeoutMs: config.defaultTimeoutMs,
  maxConcurrentSessions: config.maxConcurrentSessions
});

const html = `
<!doctype html>
<html>
  <body>
    <form>
      <input id="name" />
      <select id="role">
        <option value="">Pick one</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>
      <button id="submit" type="button">Submit</button>
    </form>
    <script>
      document.getElementById('submit').addEventListener('click', () => {
        const name = document.getElementById('name').value;
        const role = document.getElementById('role').value;
        document.body.setAttribute('data-result', name + ':' + role);
      });
    </script>
  </body>
</html>`;

const dataUrl = `data:text/html,${encodeURIComponent(html)}`;

try {
  const result = await client.withPage(async (page) => {
    await page.waitForSelector("#name");
    await page.type("#name", "alice");
    await page.select("#role", "admin");
    await page.click("#submit");
    const output = await page.evaluate(() => document.body.getAttribute("data-result"));
    return output;
  }, {
    url: dataUrl,
    waitUntil: "domcontentloaded",
    timeoutMs: 30000
  });

  assert.equal(result, "alice:admin");
  console.log("test-form passed");
} finally {
  await client.close().catch(() => {});
}
