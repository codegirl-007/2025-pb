import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import request from "supertest";
import { closeServer, listenApp, playthrough } from "./helpers";
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

  it("registers every tool and drives only the session for that MCP URL", async () => {
    const created = await request(app).post("/api/sessions").expect(201);
    const other = await request(app).post("/api/sessions").expect(201);
    expect(created.body.mcpUrl).toMatch(/\/mcp\/[A-Za-z0-9_-]+$/);
    expect(created.body.mcpUrl).not.toBe(other.body.mcpUrl);
    const { client } = await connect(created.body.mcpUrl);
    try {
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      expect(names).toEqual([...TOOL_NAMES].sort());
      expect(listed.tools.find((tool) => tool.name === "start_game")?.description).toContain("Call this first");
      expect(JSON.stringify(listed.tools)).not.toContain(store.getById(created.body.sessionId)?.secretToken);

      await client.callTool({ name: "start_game" });
      expect(store.getById(created.body.sessionId)?.stage).toBe("identify_agent");
      expect(store.getById(other.body.sessionId)?.stage).toBe("waiting");
    } finally {
      await client.close();
    }
  });

  it("isolates two concurrent MCP clients", async () => {
    const a = await request(app).post("/api/sessions").expect(201);
    const b = await request(app).post("/api/sessions").expect(201);
    const clientA = (await connect(a.body.mcpUrl)).client;
    const clientB = (await connect(b.body.mcpUrl)).client;
    try {
      await clientA.callTool({ name: "start_game" });
      expect(store.getById(a.body.sessionId)?.stage).toBe("identify_agent");
      expect(store.getById(b.body.sessionId)?.stage).toBe("waiting");

      await clientB.callTool({ name: "start_game" });
      expect(store.getById(a.body.sessionId)?.stage).toBe("identify_agent");
      expect(store.getById(b.body.sessionId)?.stage).toBe("identify_agent");
    } finally {
      await clientA.close();
      await clientB.close();
    }
  });

  it("keeps the same MCP URL after reset and can start again", async () => {
    const created = await request(app).post("/api/sessions").expect(201);
    const other = await request(app).post("/api/sessions").expect(201);
    const token = store.getById(created.body.sessionId)?.secretToken;
    playthrough(store, other.body.sessionId, "claude");
    const { client } = await connect(created.body.mcpUrl);
    try {
      await client.callTool({ name: "start_game" });
      await client.callTool({ name: "ask_prime", arguments: { promptId: "which-agent" } });
      await client.callTool({
        name: "reply_to_stephanie",
        arguments: { promptId: "which-agent", message: "cursor" },
      });
      expect(store.getById(created.body.sessionId)?.stage).toBe("diagnose");

      await request(app)
        .post(`/api/sessions/${created.body.sessionId}/reset`)
        .send({ confirm: true })
        .expect(200);
      const reset = store.getById(created.body.sessionId);
      expect(reset?.stage).toBe("waiting");
      expect(reset?.secretToken).toBe(token);
      expect(reset?.generation).toBe(1);
      expect(store.getById(other.body.sessionId)?.complete).toBe(true);

      await client.callTool({ name: "start_game" });
      expect(store.getById(created.body.sessionId)?.stage).toBe("identify_agent");
      expect(store.getById(created.body.sessionId)?.secretToken).toBe(token);
      expect(store.getById(other.body.sessionId)?.complete).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("rejects unknown tokens without advertising OAuth", async () => {
    const res = await request(app)
      .post("/mcp/not-a-real-token")
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
    expect(res.status).toBe(404);
    expect(res.headers["www-authenticate"]).toBeUndefined();
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(JSON.stringify(res.body)).not.toMatch(/<!doctype html/i);
    expect(res.body.error.message).toMatch(/Unknown session token/i);
  });

  it("rejects a destroyed session token", async () => {
    const created = await request(app).post("/api/sessions").expect(201);
    await request(app)
      .post(`/api/sessions/${created.body.sessionId}/destroy`)
      .send({ confirm: true })
      .expect(200);
    const res = await request(app)
      .post(new URL(created.body.mcpUrl).pathname)
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(404);
    expect(res.headers["www-authenticate"]).toBeUndefined();
  });

  it("returns JSON 404 for OAuth discovery probes", async () => {
    for (const path of [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-authorization-server/mcp",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/openid-configuration",
      "/.well-known/openid-configuration/mcp",
      "/mcp/.well-known/oauth-protected-resource",
      "/register",
    ]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(404);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.headers["www-authenticate"]).toBeUndefined();
      expect(res.body).toEqual({ error: "not_found" });
      expect(JSON.stringify(res.body)).not.toMatch(/<!doctype html/i);
    }
  });

  it("initializes and lists tools without authentication", async () => {
    const created = await request(app).post("/api/sessions").expect(201);
    const init = await request(app)
      .post(new URL(created.body.mcpUrl).pathname)
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } },
      });
    expect(init.status).toBe(200);
    expect(init.headers["www-authenticate"]).toBeUndefined();
    const { client } = await connect(created.body.mcpUrl);
    try {
      const listed = await client.listTools();
      expect(listed.tools.some((tool) => tool.name === "start_game")).toBe(true);
      await client.callTool({ name: "start_game" });
      expect(store.getById(created.body.sessionId)?.stage).toBe("identify_agent");
    } finally {
      await client.close();
    }
  });
});
