import assert from "node:assert/strict";
import { getConfig } from "../config.js";

function withEnv(overrides, fn) {
  const original = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

withEnv(
  {
    LIGHTPANDA_CDP_URL: undefined,
    LOG_LEVEL: undefined,
    DEFAULT_TIMEOUT_MS: undefined
  },
  () => {
    const cfg = getConfig();
    assert.equal(cfg.lightpandaCdpUrl, "ws://127.0.0.1:9222");
    assert.equal("mcpServerPort" in cfg, false);
    assert.equal(cfg.logLevel, "info");
    assert.equal(cfg.defaultTimeoutMs, 30000);
  }
);

withEnv({ LOG_LEVEL: "DEBUG" }, () => {
  const cfg = getConfig();
  assert.equal(cfg.logLevel, "debug");
});

withEnv({ DEFAULT_TIMEOUT_MS: "not-a-number" }, () => {
  assert.throws(() => getConfig(), /Invalid DEFAULT_TIMEOUT_MS/);
});

console.log("test-basic passed");
