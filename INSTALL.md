# Installation Guide

## 1. Prerequisites

- Node.js v18+
- Lightpanda running with CDP enabled at `ws://127.0.0.1:9222`

## 2. Install dependencies

```bash
cd /Users/{USERNAME}/openclaw-lightpanda
npm install
```

## 3. Configure environment (optional)

```bash
export LIGHTPANDA_CDP_URL=ws://127.0.0.1:9222
export LOG_LEVEL=info
export DEFAULT_TIMEOUT_MS=30000
```

## 4. Start server (stdio)

```bash
npm start
```

This process is an MCP stdio server and should be launched by your MCP host.

## 5. Connect from OpenClaw / mcporter

Add a local MCP process entry that launches this command:

```bash
node /Users/joypatel/openclaw-lightpanda/src/index.js
```

Alternative command:

```bash
npm start
```

Use `/Users/joypatel/openclaw-lightpanda` as working directory.

Behavior note:
- Persistent OpenClaw session: navigate once, then reuse active page.
- One-shot mcporter calls: pass `url` for each page-dependent tool call.

## 6. Verify tools

Use your MCP client to call:

- `lightpanda_navigate`
- `lightpanda_evaluate`
- `lightpanda_get_text`

## Optional: Run tests

```bash
npm test
```
