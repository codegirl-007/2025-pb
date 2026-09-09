import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import request from "supertest";
import { closeServer, listenApp } from "./helpers";
import { TOOL_NAMES } from "../src/shared/types";

describe("MCP transport", () => {
  let server: Awaited<ReturnType<typeof listenApp>>["server"];
  let app: Awaited<ReturnType<typeof listenApp>>["app"];
  let store: Awaited<ReturnType<typeof listenApp>>["store"];

  beforeAll(async () => {
    const ctx = await listenApp();
    server = ctx.server;
    app = ctx.app;
    store = ctx.store;
  });

  afterAll(async () => {
    await closeServer(server);
  });

  async function connect(mcpUrl: string) {
    const client = new Client({ name: "birthday-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    await client.connect(transport);
    return { client, transport };
  }

  it("registers every tool and isolates tokens", async () => {
    const created = await request(app).post("/api/sessions").expect(201);
    const other = await request(app).post("/api/sessions").expect(201);
    const { client } = await connect(created.body.mcpUrl);
    try {
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      expect(names).toEqual([...TOOL_NAMES].sort());
      expect(listed.tools.find((tool) => tool.name === "start_game")?.description).toContain("Call this first");

      await client.callTool({ name: "start_game" });
      expect(store.getById(created.body.sessionId)?.stage).toBe("identify_agent");
      expect(store.getById(other.body.sessionId)?.stage).toBe("waiting");
    } finally {
      await client.close();
    }
  });

  it("rejects unknown tokens", async () => {
    const res = await request(app)
      .post("/mcp/not-a-real-token")
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
  });
});
