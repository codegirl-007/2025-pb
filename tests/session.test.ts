import { describe, expect, it } from "vitest";
import request from "supertest";
import { SessionStore } from "../src/server/store";
import { closeServer, listenApp, playthrough } from "./helpers";

describe("sessions", () => {
  it("creates sessions and isolates tokens", async () => {
    const { server, store, app, baseUrl } = await listenApp();
    try {
      const a = await request(app).post("/api/sessions").expect(201);
      const b = await request(app).post("/api/sessions").expect(201);
      expect(a.body.sessionCode).toMatch(/^PRIME-/);
      expect(a.body.mcpUrl).toContain("/mcp/");
      expect(a.body.sessionId).not.toBe(b.body.sessionId);

      const tokenA = new URL(a.body.mcpUrl).pathname.split("/").pop()!;
      const tokenB = new URL(b.body.mcpUrl).pathname.split("/").pop()!;
      expect(tokenA).not.toBe(tokenB);
      expect(a.body.sessionCode).not.toBe(tokenA);

      store.dispatchByToken(tokenA, "start_game", {});
      expect(store.getById(a.body.sessionId)?.stage).toBe("identify_agent");
      expect(store.getById(b.body.sessionId)?.stage).toBe("waiting");

      const snap = await request(app).get(`/api/sessions/${a.body.sessionId}`).expect(200);
      expect(snap.body.secretToken).toBeUndefined();
      expect(JSON.stringify(snap.body)).not.toContain(tokenA);

      const unknown = store.dispatchByToken("not-a-token", "start_game", {});
      expect(unknown).toEqual({ ok: false, error: "Unknown session token." });
      expect(baseUrl).toContain("127.0.0.1");

      await request(app).post("/api/dev/sessions/nope/tools").send({ name: "start_game" }).expect(404);
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
  });
});

describe("reset and snapshot recovery", () => {
  it("restores public state and reset uses the same handler", async () => {
    const { server, store, app } = await listenApp();
    try {
      const created = await request(app).post("/api/sessions").expect(201);
      const token = new URL(created.body.mcpUrl).pathname.split("/").pop()!;
      playthrough(store, token, "gemini");
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
    } finally {
      await closeServer(server);
    }
  });
});
