import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { PublicSession, SessionEvent, WsServerMessage } from "../shared/types";
import type { SessionStore } from "./store";

function send(ws: WebSocket, message: WsServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function attachWebSocket(server: Server, store: SessionStore) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname !== "/ws") return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/ws", "http://127.0.0.1");
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      send(ws, { type: "error", message: "sessionId required" });
      ws.close(4401, "sessionId required");
      return;
    }
    const snapshot = store.snapshot(sessionId);
    if (!snapshot) {
      send(ws, { type: "error", message: "unknown session" });
      ws.close(4404, "unknown session");
      return;
    }

    store.claim(sessionId);
    send(ws, { type: "snapshot", snapshot });
    const unsubscribe = store.subscribe(sessionId, (event: SessionEvent, next: PublicSession) => {
      if (event.type === "destroyed") {
        send(ws, { type: "error", message: "session destroyed" });
        ws.close(4404, "unknown session");
        return;
      }
      send(ws, { type: "event", event, snapshot: next });
    });

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(String(raw)) as { type?: string };
        if (parsed.type === "ping") {
          const latest = store.snapshot(sessionId);
          if (!latest) {
            send(ws, { type: "error", message: "unknown session" });
            ws.close(4404, "unknown session");
            return;
          }
          send(ws, { type: "snapshot", snapshot: latest });
        }
      } catch {
        send(ws, { type: "error", message: "invalid message" });
      }
    });

    ws.on("close", () => {
      unsubscribe();
    });
  });

  return wss;
}
