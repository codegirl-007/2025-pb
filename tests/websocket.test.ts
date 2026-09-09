import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import request from "supertest";
import { closeServer, listenApp } from "./helpers";
import type { WsServerMessage } from "../src/shared/types";

function waitFor(ws: WebSocket, predicate: (msg: WsServerMessage) => boolean) {
  return new Promise<WsServerMessage>((resolve, reject) => {
    const onMessage = (raw: WebSocket.RawData) => {
      const msg = JSON.parse(String(raw)) as WsServerMessage;
      if (predicate(msg)) {
        ws.off("message", onMessage);
        resolve(msg);
      }
    };
    ws.on("message", onMessage);
    ws.on("error", reject);
    setTimeout(() => reject(new Error("timeout waiting for websocket message")), 5000);
  });
}

describe("websocket isolation", () => {
  it("does not leak events across sessions and recovers snapshots", async () => {
    const { server, store, app, baseUrl } = await listenApp();
    try {
      const a = await request(app).post("/api/sessions").expect(201);
      const b = await request(app).post("/api/sessions").expect(201);
      const wsA = new WebSocket(`${baseUrl.replace("http", "ws")}/ws?sessionId=${a.body.sessionId}`);
      const wsB = new WebSocket(`${baseUrl.replace("http", "ws")}/ws?sessionId=${b.body.sessionId}`);
      const helloA = waitFor(wsA, (msg) => msg.type === "snapshot");
      const helloB = waitFor(wsB, (msg) => msg.type === "snapshot");
      expect((await helloA).snapshot?.sessionId).toBe(a.body.sessionId);
      expect((await helloB).snapshot?.sessionId).toBe(b.body.sessionId);

      const nextA = waitFor(wsA, (msg) => msg.type === "event" && msg.event?.type === "agent_connected");
      let leaked = false;
      wsB.on("message", (raw) => {
        const msg = JSON.parse(String(raw)) as WsServerMessage;
        if (msg.event?.sessionId === a.body.sessionId) leaked = true;
      });

      const tokenA = new URL(a.body.mcpUrl).pathname.split("/").pop()!;
      store.dispatchByToken(tokenA, "start_game", {});
      const eventA = await nextA;
      expect(eventA.snapshot?.sessionId).toBe(a.body.sessionId);
      expect(leaked).toBe(false);

      wsA.close();
      const snap = await request(app).get(`/api/sessions/${a.body.sessionId}`).expect(200);
      expect(snap.body.stage).toBe("identify_agent");
      const wsA2 = new WebSocket(`${baseUrl.replace("http", "ws")}/ws?sessionId=${a.body.sessionId}`);
      const recovered = await waitFor(wsA2, (msg) => msg.type === "snapshot");
      expect(recovered.snapshot?.stage).toBe("identify_agent");
      expect(recovered.snapshot?.stateVersion).toBeGreaterThan(0);
      wsA2.close();
      wsB.close();
    } finally {
      await closeServer(server);
    }
  });
});
