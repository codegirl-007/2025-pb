import { describe, expect, it } from "vitest";
import request from "supertest";
import { handleTool } from "../src/game/engine";
import { SessionStore } from "../src/server/store";
import { closeServer, listenApp, playthrough } from "./helpers";

describe("sessions", () => {
  it("creates a unique session-specific MCP URL per game", async () => {
    const { server, store, app, baseUrl } = await listenApp();
    try {
      const a = await request(app).post("/api/sessions").expect(201);
      const b = await request(app).post("/api/sessions").expect(201);
      expect(a.body.sessionCode).toMatch(/^PRIME-/);
      expect(a.body.mcpUrl).toMatch(/\/mcp\/[A-Za-z0-9_-]+$/);
      expect(b.body.mcpUrl).toMatch(/\/mcp\/[A-Za-z0-9_-]+$/);
      expect(a.body.mcpUrl).not.toBe(b.body.mcpUrl);
      expect(a.body.sessionId).not.toBe(b.body.sessionId);
      expect(a.body.mcpConfig.mcpServers["birthday-mcp"].url).toBe(a.body.mcpUrl);
      expect(a.body.mcpConfig.mcpServers["birthday-mcp"].transport).toBe("http");
      expect(a.body.secretToken).toBeUndefined();

      store.dispatchById(a.body.sessionId, "start_game", {});
      expect(store.getById(a.body.sessionId)?.stage).toBe("identify_agent");
      expect(store.getById(b.body.sessionId)?.stage).toBe("waiting");

      const snap = await request(app).get(`/api/sessions/${a.body.sessionId}`).expect(200);
      expect(snap.body.secretToken).toBeUndefined();
      expect(snap.body.mcpUrl).toBeUndefined();
      const tokenA = store.getById(a.body.sessionId)?.secretToken;
      expect(tokenA).toBeTruthy();
      expect(JSON.stringify(snap.body)).not.toContain(tokenA);
      expect(a.body.mcpUrl).toBe(`${baseUrl}/mcp/${tokenA}`);

      const unknown = store.dispatchByToken("not-a-token", "start_game", {});
      expect(unknown).toEqual({ ok: false, error: "Unknown session token." });
      expect(baseUrl).toContain("127.0.0.1");

      await request(app).post("/api/dev/sessions/nope/tools").send({ name: "start_game" }).expect(404);
      await request(app).get("/api/sessions/nope").expect(404);
    } finally {
      await closeServer(server);
    }
  });

  it("expires inactive sessions", () => {
    let now = 1_000_000;
    const store = new SessionStore(50, () => new Date(now));
    const session = store.create();
    now += 51;
    expect(store.getById(session.sessionId)).toBeUndefined();
    expect(store.getLive()).toBeUndefined();
  });
});

describe("reset and snapshot recovery", () => {
  it("restores public state and reset uses the same handler", async () => {
    const { server, store, app } = await listenApp();
    try {
      const created = await request(app).post("/api/sessions").expect(201);
      const token = store.getById(created.body.sessionId)?.secretToken;
      playthrough(store, created.body.sessionId, "gemini");
      const snap = await request(app).get(`/api/sessions/${created.body.sessionId}`).expect(200);
      expect(snap.body.complete).toBe(true);
      expect(snap.body.stage).toBe("complete");

      await request(app)
        .post(`/api/sessions/${created.body.sessionId}/reset`)
        .send({ confirm: true })
        .expect(200);
      const after = await request(app).get(`/api/sessions/${created.body.sessionId}`).expect(200);
      expect(after.body.stage).toBe("waiting");
      expect(after.body.complete).toBe(false);
      expect(after.body.generation).toBe(1);
      expect(store.getById(created.body.sessionId)?.secretToken).toBe(token);
      expect(created.body.mcpUrl.endsWith(`/mcp/${token}`)).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it("disconnects by destroying the session and invalidating the token", async () => {
    const { server, store, app } = await listenApp();
    try {
      const created = await request(app).post("/api/sessions").expect(201);
      const token = store.getById(created.body.sessionId)?.secretToken ?? "";
      expect(store.getByToken(token)?.sessionId).toBe(created.body.sessionId);

      await request(app)
        .post(`/api/sessions/${created.body.sessionId}/destroy`)
        .send({ confirm: true })
        .expect(200);

      expect(store.getById(created.body.sessionId)).toBeUndefined();
      expect(store.getByToken(token)).toBeUndefined();
      await request(app).get(`/api/sessions/${created.body.sessionId}`).expect(404);
    } finally {
      await closeServer(server);
    }
  });
});

describe("generation safety", () => {
  it("rejects a stale operation after reset", () => {
    const store = new SessionStore(60_000, () => new Date("2026-09-09T00:00:00Z"));
    const session = store.create();
    const started = handleTool(session, "start_game", {});
    expect(started.state.stage).toBe("identify_agent");

    const reset = store.resetGame(session.sessionId);
    expect("mcp" in reset && reset.ok).toBe(true);
    expect(store.getById(session.sessionId)?.stage).toBe("waiting");
    expect(store.getById(session.sessionId)?.generation).toBe(1);
    expect(store.getById(session.sessionId)?.secretToken).toBe(session.secretToken);

    const stale = store.commitIfCurrent(session.sessionId, session.generation, started);
    expect(stale).toEqual({ ok: false, error: "Session was reset. Continue from the current objective." });
    expect(store.getById(session.sessionId)?.stage).toBe("waiting");
    expect(store.getById(session.sessionId)?.generation).toBe(1);
  });
});
