const VALID_LOG_LEVELS = new Set(["error", "warn", "info", "debug"]);

function parseIntegerEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer, got '${raw}'`);
  }

  return parsed;
}

function normalizeLogLevel(level) {
  const normalized = String(level ?? "info").toLowerCase();
  if (!VALID_LOG_LEVELS.has(normalized)) {
    return "info";
  }

  return normalized;
}

export function getConfig() {
  const config = {
    lightpandaCdpUrl: process.env.LIGHTPANDA_CDP_URL || "ws://127.0.0.1:9222",
    logLevel: normalizeLogLevel(process.env.LOG_LEVEL),
    defaultTimeoutMs: parseIntegerEnv("DEFAULT_TIMEOUT_MS", 30000)
  };

  return config;
}

export const config = getConfig();
