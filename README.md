# OpenClaw Lightpanda MCP Server

Version: 1.0.0

OpenClaw-focused MCP server wrapper for Lightpanda headless browser. It provides browser automation tools for navigation, clicking, form filling, JavaScript evaluation, screenshots, and content extraction.

Transport: `stdio` (local MCP process)

State model: hybrid URL-first with shared page
- If a tool call includes `url`, the server navigates first and runs that tool.
- If `url` is omitted, the tool reuses the active page from the current persistent MCP session.
- If there is no active page and no `url`, the server returns `NO_ACTIVE_PAGE`.

## Tools

- `lightpanda_navigate`: Navigate to a URL
- `lightpanda_click`: Click an element by CSS selector
- `lightpanda_fill`: Fill form fields by selector/value
- `lightpanda_evaluate`: Execute JavaScript on the page
- `lightpanda_screenshot`: Capture screenshot and return base64
- `lightpanda_get_text`: Extract page or element text
- `lightpanda_wait_for`: Wait for selector or text condition
- `lightpanda_wait_until`: Wait for `networkidle` or `domcontentloaded`
- `lightpanda_select`: Select option by value, label, or index

## Requirements

- Node.js 18+
- Running Lightpanda CDP endpoint (default: `ws://127.0.0.1:9222`)

## Install

```bash
npm install
```

## Run

```bash
npm start
```

The process communicates over stdin/stdout for MCP hosts.

## OpenClaw / mcporter usage

Register this server as a local MCP process:

- Command: `node`
- Args: `[/Users/joypatel/openclaw-lightpanda/src/index.js]`
- Working directory: `/Users/joypatel/openclaw-lightpanda`

Or run via npm script:

- Command: `npm`
- Args: `[start]`
- Working directory: `/Users/joypatel/openclaw-lightpanda`

Important for one-shot CLI calls:
- If you use `mcporter call` style process-per-call execution, include `url` on each page-dependent tool call.
- In persistent OpenClaw agent sessions, you can call `lightpanda_navigate` once and then omit `url` in follow-up tools.

## Configuration

Environment variables:

- `LIGHTPANDA_CDP_URL` (default: `ws://127.0.0.1:9222`)
- `LOG_LEVEL` (default: `info`, one of `error|warn|info|debug`)
- `DEFAULT_TIMEOUT_MS` (default: `30000`)

## Tests

```bash
npm test
```

Individual tests:

```bash
npm run test:basic
npm run test:navigate
npm run test:evaluate
npm run test:form
```

## Troubleshooting

- Verify Lightpanda container is up and exposes port `9222`.
- Confirm `LIGHTPANDA_CDP_URL` matches your endpoint.
