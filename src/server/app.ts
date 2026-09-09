import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, NextFunction, Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { inspectorHint, landing, mcpConfigExample } from "../content/index";
import { sessionSummary, toPublicSession } from "../game/engine";
import { TOOL_NAMES } from "../shared/types";
import type { ToolName } from "../shared/types";
import type { ServerConfig } from "./config";
import { mountMcp } from "./mcp";
import { RateLimiter } from "./rateLimit";
import { SessionStore } from "./store";

const here = path.dirname(fileURLToPath(import.meta.url));

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function publicSnapshot(store: SessionStore, sessionId: string) {
  const state = store.getById(sessionId);
  if (!state) return undefined;
  return {
    ...toPublicSession(state),
    summary: sessionSummary(state),
  };
}

export function createApp(config: ServerConfig, store = new SessionStore(config.sessionTtlMs)) {
  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: ["127.0.0.1", "localhost", "[::1]"],
    allowedOrigins: ["127.0.0.1", "localhost", "[::1]"],
    jsonLimit: "1mb",
  });
  const limiter = new RateLimiter();

  app.set("trust proxy", false);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "birthday-mcp" });
  });

  app.post("/api/sessions", (req, res) => {
    if (!limiter.allow(`create:${clientIp(req)}`, config.sessionCreateLimit, config.sessionCreateWindowMs)) {
      res.status(429).json({ error: "Too many sessions. Wait and try again." });
      return;
    }
    const session = store.create();
    const mcpUrl = `${config.publicUrl}/mcp/${session.secretToken}`;
    res.status(201).json({
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      mcpUrl,
      mcpConfig: mcpConfigExample(mcpUrl),
      prompt: landing.prompt,
      inspectorHint,
    });
  });

  app.get("/api/sessions/:sessionId", (req, res) => {
    const sessionId = param(req.params.sessionId);
    const snapshot = publicSnapshot(store, sessionId);
    if (!snapshot) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json(snapshot);
  });

  app.post("/api/sessions/:sessionId/reset", (req, res) => {
    if (req.body?.confirm !== true) {
      res.status(400).json({ error: "Pass { confirm: true } to reset." });
      return;
    }
    const sessionId = param(req.params.sessionId);
    const result = store.dispatchById(sessionId, "reset_game", { confirm: true });
    if (!("mcp" in result)) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(publicSnapshot(store, sessionId));
  });

  if (!config.isProduction) {
    app.post("/api/dev/sessions/:sessionId/tools", (req, res) => {
      const sessionId = param(req.params.sessionId);
      const name = req.body?.name as ToolName | undefined;
      if (!name || !TOOL_NAMES.includes(name)) {
        res.status(400).json({ error: "Unknown tool name." });
        return;
      }
      if (!limiter.allow(`mcp:dev:${sessionId}`, config.mcpCallLimit, config.mcpCallWindowMs)) {
        res.status(429).json({ error: "Rate limited." });
        return;
      }
      const result = store.dispatchById(sessionId, name, req.body?.arguments ?? {});
      if (!("mcp" in result)) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json({
        ok: result.ok,
        mcp: result.mcp,
        snapshot: publicSnapshot(store, sessionId),
      });
    });
  }

  mountMcp(app, store, limiter, config);

  return { app, store };
}

export function mountFrontend(app: Express, config: ServerConfig) {
  if (config.isProduction) {
    const webRoot = path.resolve(here, "../web");
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/mcp") || req.path.startsWith("/ws")) {
        next();
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      const file = req.path === "/" ? "index.html" : req.path;
      const target = path.join(webRoot, file);
      res.sendFile(target, (err) => {
        if (!err) return;
        res.sendFile(path.join(webRoot, "index.html"), (fallbackErr) => {
          if (fallbackErr) next();
        });
      });
    });
  }
}
