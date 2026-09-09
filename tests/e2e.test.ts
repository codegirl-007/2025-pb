import { describe, expect, it } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import request from "supertest";
import { closeServer, listenApp } from "./helpers";

async function textResult(client: Client, name: string, args?: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("missing text result");
  return JSON.parse(text.text) as Record<string, unknown>;
}

describe("end-to-end birthday flow over MCP", () => {
  it("completes the experience and exposes complete browser state", async () => {
    const { server, app } = await listenApp();
    try {
      const created = await request(app).post("/api/sessions").expect(201);
      const client = new Client({ name: "e2e", version: "1.0.0" });
      await client.connect(new StreamableHTTPClientTransport(new URL(created.body.mcpUrl)));

      expect((await textResult(client, "start_game")).stage).toBe("identify_agent");
      await textResult(client, "ask_prime", { promptId: "which-agent" });
      const identified = await textResult(client, "reply_to_stephanie", {
        promptId: "which-agent",
        message: "cursor",
      });
      expect(identified.classifiedAs).toBe("cursor");

      await textResult(client, "read_file", { path: "/var/log/birthday-migration.log" });
      await textResult(client, "run_command", { command: "birthdayctl doctor" });
      await textResult(client, "ask_prime", { promptId: "ship-update" });
      const shipped = await textResult(client, "reply_to_stephanie", {
        promptId: "ship-update",
        message: "ship it",
      });
      expect(shipped.classifiedAs).toBe("ship");

      const applied = await textResult(client, "apply_update", {
        package: "primeagen",
        fromVersion: 40,
        toVersion: 41,
      });
      expect(applied.pausedAt).toBe(99);
      await textResult(client, "ask_prime", { promptId: "continue-update" });
      const done = await textResult(client, "reply_to_stephanie", {
        promptId: "continue-update",
        message: "continue",
      });
      expect(done.status).toBe("complete");
      expect(JSON.stringify(done)).not.toContain("Happy 41st birthday");

      const snap = await request(app).get(`/api/sessions/${created.body.sessionId}`).expect(200);
      expect(snap.body.complete).toBe(true);
      expect(snap.body.stage).toBe("complete");
      expect(snap.body.visual.wallpaper).toBe("reveal");
      expect(snap.body.agentLabel).toBe("cursor");
      expect(snap.body.visual.dialogue.some((line: { speaker: string; text: string }) => line.speaker === "prime" && line.text === "cursor")).toBe(true);
      await client.close();
    } finally {
      await closeServer(server);
    }
  });
});
