import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config.js";
import { LightpandaClient, normalizeError } from "./lightpanda-client.js";

const LOG_LEVEL_WEIGHT = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

function log(level, message, meta = undefined) {
  if (LOG_LEVEL_WEIGHT[level] > LOG_LEVEL_WEIGHT[config.logLevel]) {
    return;
  }

  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  console[level](`[lightpanda-mcp] ${message}${payload}`);
}

const waitUntilSchema = z.enum(["domcontentloaded", "load", "networkidle0", "networkidle2"]);
const optionalUrlSchema = z.string().url().optional();

const navigateSchema = z.object({
  url: z.string().url(),
  waitUntil: waitUntilSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
});

const clickSchema = z.object({
  url: optionalUrlSchema,
  selector: z.string().min(1),
  waitUntil: waitUntilSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
});

const fillSchema = z.object({
  url: optionalUrlSchema,
  fields: z.array(z.object({
    selector: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()])
  })).min(1),
  submitSelector: z.string().min(1).optional(),
  waitUntil: waitUntilSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
});

const evaluateSchema = z.object({
  url: optionalUrlSchema,
  script: z.string().min(1),
  args: z.array(z.unknown()).optional(),
  waitUntil: waitUntilSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
});

const screenshotSchema = z.object({
  url: optionalUrlSchema,
  fullPage: z.boolean().optional(),
  type: z.enum(["png", "jpeg", "webp"]).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  waitUntil: waitUntilSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
});

const getTextSchema = z.object({
  url: optionalUrlSchema,
  selector: z.string().min(1).optional(),
  waitUntil: waitUntilSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
});

const waitForSchema = z.object({
  url: optionalUrlSchema,
  selector: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
}).refine((input) => (input.selector ? 1 : 0) + (input.text ? 1 : 0) === 1, {
  message: "Exactly one of selector or text must be provided",
  path: ["selector"]
});

const waitUntilStateSchema = z.enum(["networkidle", "domcontentloaded"]);
const waitUntilToolSchema = z.object({
  url: optionalUrlSchema,
  state: waitUntilStateSchema,
  timeoutMs: z.number().int().positive().max(120000).optional()
});

const selectSchema = z.object({
  url: optionalUrlSchema,
  selector: z.string().min(1),
  value: z.string().optional(),
  label: z.string().optional(),
  index: z.number().int().min(0).optional(),
  waitUntil: waitUntilSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional()
}).refine((input) => {
  const count = (input.value ? 1 : 0) + (input.label ? 1 : 0) + (typeof input.index === "number" ? 1 : 0);
  return count === 1;
}, {
  message: "Exactly one of value, label, or index must be provided",
  path: ["value"]
});

const toolDefinitions = [
  {
    name: "lightpanda_navigate",
    description: "Navigate to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        waitUntil: { type: "string", enum: ["domcontentloaded", "load", "networkidle0", "networkidle2"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: ["url"],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_click",
    description: "Click an element by CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        selector: { type: "string" },
        waitUntil: { type: "string", enum: ["domcontentloaded", "load", "networkidle0", "networkidle2"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: ["selector"],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_fill",
    description: "Fill a form with field/value pairs",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        fields: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              selector: { type: "string" },
              value: { oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] }
            },
            required: ["selector", "value"],
            additionalProperties: false
          }
        },
        submitSelector: { type: "string" },
        waitUntil: { type: "string", enum: ["domcontentloaded", "load", "networkidle0", "networkidle2"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: ["fields"],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_evaluate",
    description: "Execute JavaScript on the page",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        script: { type: "string" },
        args: { type: "array" },
        waitUntil: { type: "string", enum: ["domcontentloaded", "load", "networkidle0", "networkidle2"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: ["script"],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_screenshot",
    description: "Take a screenshot of the current page",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        fullPage: { type: "boolean" },
        type: { type: "string", enum: ["png", "jpeg", "webp"] },
        quality: { type: "integer", minimum: 1, maximum: 100 },
        waitUntil: { type: "string", enum: ["domcontentloaded", "load", "networkidle0", "networkidle2"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_get_text",
    description: "Extract plain text from the page",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        selector: { type: "string" },
        waitUntil: { type: "string", enum: ["domcontentloaded", "load", "networkidle0", "networkidle2"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_wait_for",
    description: "Wait for a condition (selector or text)",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        selector: { type: "string" },
        text: { type: "string" },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: [],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_wait_until",
    description: "Wait for page load state (networkidle or domcontentloaded)",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        state: { type: "string", enum: ["networkidle", "domcontentloaded"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: ["state"],
      additionalProperties: false
    }
  },
  {
    name: "lightpanda_select",
    description: "Select an option from a select element",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        selector: { type: "string" },
        value: { type: "string" },
        label: { type: "string" },
        index: { type: "integer", minimum: 0 },
        waitUntil: { type: "string", enum: ["domcontentloaded", "load", "networkidle0", "networkidle2"] },
        timeoutMs: { type: "integer", minimum: 1 }
      },
      required: ["selector"],
      additionalProperties: false
    }
  }
];

const client = new LightpandaClient({
  cdpUrl: config.lightpandaCdpUrl,
  defaultTimeoutMs: config.defaultTimeoutMs
});

const server = new Server(
  {
    name: "lightpanda",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

function successResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

function serializeForMcp(value) {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function parseInput(schema, args) {
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
    const error = new Error(message || "Invalid input");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  return parsed.data;
}

async function executeTool(name, args) {
  switch (name) {
    case "lightpanda_navigate": {
      const input = parseInput(navigateSchema, args);
      const response = await client.withPage(async (page) => {
        return {
          success: true,
          url: page.url(),
          state: "ready"
        };
      }, {
        url: input.url,
        waitUntil: input.waitUntil ?? "networkidle0",
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_click": {
      const input = parseInput(clickSchema, args);
      const response = await client.withPage(async (page) => {
        await page.waitForSelector(input.selector, { timeout: input.timeoutMs ?? config.defaultTimeoutMs });
        await page.click(input.selector);

        return {
          success: true,
          selector: input.selector,
          url: page.url()
        };
      }, {
        url: input.url,
        waitUntil: input.waitUntil,
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_fill": {
      const input = parseInput(fillSchema, args);
      const response = await client.withPage(async (page) => {
        for (const field of input.fields) {
          await page.waitForSelector(field.selector, { timeout: input.timeoutMs ?? config.defaultTimeoutMs });
          await page.focus(field.selector);
          await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) {
              el.value = "";
            }
          }, field.selector);
          await page.type(field.selector, String(field.value));
        }

        if (input.submitSelector) {
          await page.waitForSelector(input.submitSelector, { timeout: input.timeoutMs ?? config.defaultTimeoutMs });
          await page.click(input.submitSelector);
        }

        return {
          success: true,
          filledCount: input.fields.length,
          url: page.url()
        };
      }, {
        url: input.url,
        waitUntil: input.waitUntil,
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_evaluate": {
      const input = parseInput(evaluateSchema, args);
      const response = await client.withPage(async (page) => {
        const result = await page.evaluate(
          ({ script, args }) => {
            const executor = new Function("...args", script);
            return executor(...args);
          },
          { script: input.script, args: input.args ?? [] }
        );

        return {
          success: true,
          result: serializeForMcp(result),
          url: page.url()
        };
      }, {
        url: input.url,
        waitUntil: input.waitUntil,
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_screenshot": {
      const input = parseInput(screenshotSchema, args);
      const response = await client.withPage(async (page) => {
        const type = input.type ?? "png";
        const screenshotBuffer = await page.screenshot({
          fullPage: input.fullPage ?? false,
          type,
          quality: type === "png" ? undefined : input.quality
        });

        const mimeType = type === "jpeg" ? "image/jpeg" : `image/${type}`;
        return {
          success: true,
          mimeType,
          dataBase64: Buffer.from(screenshotBuffer).toString("base64"),
          url: page.url()
        };
      }, {
        url: input.url,
        waitUntil: input.waitUntil,
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_get_text": {
      const input = parseInput(getTextSchema, args);
      const response = await client.withPage(async (page) => {
        const text = await page.evaluate((selector) => {
          if (selector) {
            const element = document.querySelector(selector);
            return element?.textContent?.trim() ?? "";
          }

          return document.body?.innerText?.trim() ?? "";
        }, input.selector);

        return {
          success: true,
          text,
          url: page.url()
        };
      }, {
        url: input.url,
        waitUntil: input.waitUntil,
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_wait_for": {
      const input = parseInput(waitForSchema, args);
      const response = await client.withPage(async (page) => {
        if (input.selector) {
          await page.waitForSelector(input.selector, { timeout: input.timeoutMs ?? config.defaultTimeoutMs });
          return {
            success: true,
            condition: `selector:${input.selector}`,
            url: page.url()
          };
        }

        await page.waitForFunction(
          (expectedText) => document.body?.innerText?.includes(expectedText) ?? false,
          { timeout: input.timeoutMs ?? config.defaultTimeoutMs },
          input.text
        );

        return {
          success: true,
          condition: `text:${input.text}`,
          url: page.url()
        };
      }, {
        url: input.url,
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_wait_until": {
      const input = parseInput(waitUntilToolSchema, args);
      const response = await client.withPage(async (page) => {
        if (input.state === "networkidle") {
          await page.waitForNetworkIdle({ timeout: input.timeoutMs ?? config.defaultTimeoutMs });
        } else {
          await page.waitForFunction(
            () => ["interactive", "complete"].includes(document.readyState),
            { timeout: input.timeoutMs ?? config.defaultTimeoutMs }
          );
        }

        return {
          success: true,
          state: input.state,
          url: page.url()
        };
      }, {
        url: input.url,
        waitUntil: "domcontentloaded",
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    case "lightpanda_select": {
      const input = parseInput(selectSchema, args);
      const response = await client.withPage(async (page) => {
        await page.waitForSelector(input.selector, { timeout: input.timeoutMs ?? config.defaultTimeoutMs });

        let selected;
        if (input.value !== undefined) {
          await page.select(input.selector, input.value);
          selected = input.value;
        } else if (input.label !== undefined) {
          const value = await page.$eval(
            input.selector,
            (select, label) => {
              const option = Array.from(select.options).find((opt) => opt.label === label || opt.textContent?.trim() === label);
              return option?.value ?? null;
            },
            input.label
          );

          if (!value) {
            throw new Error(`No option found by label '${input.label}'`);
          }

          await page.select(input.selector, value);
          selected = input.label;
        } else {
          const value = await page.$eval(
            input.selector,
            (select, index) => select.options[index]?.value ?? null,
            input.index
          );

          if (!value) {
            throw new Error(`No option found at index ${input.index}`);
          }

          await page.select(input.selector, value);
          selected = input.index;
        }

        return {
          success: true,
          selected,
          url: page.url()
        };
      }, {
        url: input.url,
        waitUntil: input.waitUntil,
        timeoutMs: input.timeoutMs
      });

      return successResult(response);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefinitions
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    log("debug", "Tool call received", { name });
    return await executeTool(name, args);
  } catch (error) {
    const normalized = normalizeError(error, { success: false, tool: name });
    log("error", "Tool call failed", normalized);

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(normalized, null, 2)
        }
      ],
      structuredContent: normalized
    };
  }
});

async function shutdown(signal) {
  log("info", `Received ${signal}, shutting down`);

  await client.close().catch((error) => {
    log("warn", "Error while disconnecting browser", normalizeError(error));
  });

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("info", "Lightpanda MCP server started", {
    transport: "stdio",
    cdpUrl: config.lightpandaCdpUrl
  });
}

main().catch((error) => {
  log("error", "Failed to start server", normalizeError(error));
  process.exit(1);
});
