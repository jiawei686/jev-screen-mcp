#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { screenContent } from "./tools/screen_content.js";
import { runDoctor } from "./doctor.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "doctor") {
    await runDoctor(args.includes("--json"));
    return;
  }

  const server = new McpServer({
    name: "jev-screen-mcp",
    version: "0.1.0",
  });

  server.tool(
    "screen_content",
    "Content-moderation & classification gate powered by Jev (System One decision model). Given text, returns spam and toxicity probabilities, a category, a severity score, a calibrated confidence, and an action (allow / review / block). Low confidence routes to review; clear, severe violations route to block.",
    {
      text: z.string().describe("The text to screen."),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional custom category list (replaces defaults)."),
    },
    async ({ text, categories }) => {
      const r = await screenContent(text, categories);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
