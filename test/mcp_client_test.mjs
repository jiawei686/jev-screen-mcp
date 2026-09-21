// Canonical MCP protocol test using the SDK's own Client + StdioClientTransport.
// This is the authoritative check that the server speaks MCP (hand-rolled
// stdio framing tests are unreliable).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  cwd: process.cwd(),
  env: { ...process.env, JEV_MCP_MOCK: "1" },
});

const client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: {} });

await client.connect(transport);
console.log("CONNECTED");

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));
assertSingleTool(tools.tools.map((t) => t.name));

const spam = await client.callTool({
  name: "screen_content",
  arguments: { text: "Buy cheap viagra now!!! click here http://spam.example" },
});
console.log("SCREEN(spammy):", spam.content[0].text);

const clean = await client.callTool({
  name: "screen_content",
  arguments: { text: "Thanks for the update, the meeting is at 3pm." },
});
console.log("SCREEN(clean):", clean.content[0].text);

await client.close();
console.log("DONE_OK");

function assertSingleTool(names) {
  if (names.length !== 1 || names[0] !== "screen_content") {
    throw new Error("expected exactly [screen_content], got: " + JSON.stringify(names));
  }
}
