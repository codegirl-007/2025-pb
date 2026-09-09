import { AsyncLocalStorage } from "node:async_hooks";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import type { Express, Request, Response } from "express";
import { mcpInstructions, toolDescriptions } from "../content/index";
import { toolArgSchemas } from "../game/schemas";
import type { ToolName } from "../shared/types";
import { RateLimiter } from "./rateLimit";
import type { ServerConfig } from "./config";
import type { SessionStore } from "./store";

const mcpAls = new AsyncLocalStorage<{ token?: string; live?: boolean }>();

function jsonResult(payload: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

function createBirthdayServer(store: SessionStore, limiter: RateLimiter, config: ServerConfig) {
  const server = new McpServer(
    {
      name: "birthday-mcp",
      version: "40.0.0",
      title: "The Birthday MCP",
    },
    { instructions: mcpInstructions },
  );

  const run = (name: ToolName, args: unknown) => {
    const scope = mcpAls.getStore();
    if (!scope) {
      return jsonResult({ status: "error", error: "Missing session token." }, true);
    }
    const limitKey = scope.live ? "mcp:live" : `mcp:${scope.token}`;
    if (!limiter.allow(limitKey, config.mcpCallLimit, config.mcpCallWindowMs)) {
      return jsonResult({ status: "error", error: "Rate limited. Wait a moment and continue." }, true);
    }
    const result = scope.live
      ? store.dispatchLive(name, args)
      : store.dispatchByToken(scope.token ?? "", name, args);
    if (!("mcp" in result)) {
      return jsonResult({ status: "error", error: result.error }, true);
    }
    return jsonResult(result.mcp, !result.ok);
  };

  server.registerTool("start_game", { description: toolDescriptions.start_game }, async () => run("start_game", {}));
  server.registerTool(
    "inspect_screen",
    { description: toolDescriptions.inspect_screen },
    async () => run("inspect_screen", {}),
  );
  server.registerTool(
    "open_app",
    { description: toolDescriptions.open_app, inputSchema: toolArgSchemas.open_app },
    async (args) => run("open_app", args),
  );
  server.registerTool(
    "read_file",
    { description: toolDescriptions.read_file, inputSchema: toolArgSchemas.read_file },
    async (args) => run("read_file", args),
  );
  server.registerTool(
    "run_command",
    { description: toolDescriptions.run_command, inputSchema: toolArgSchemas.run_command },
    async (args) => run("run_command", args),
  );
  server.registerTool(
    "ask_prime",
    { description: toolDescriptions.ask_prime, inputSchema: toolArgSchemas.ask_prime },
    async (args) => run("ask_prime", args),
  );
  server.registerTool(
    "reply_to_stephanie",
    { description: toolDescriptions.reply_to_stephanie, inputSchema: toolArgSchemas.reply_to_stephanie },
    async (args) => run("reply_to_stephanie", args),
  );
  server.registerTool(
    "choose_action",
    { description: toolDescriptions.choose_action, inputSchema: toolArgSchemas.choose_action },
    async (args) => run("choose_action", args),
  );
  server.registerTool(
    "apply_update",
    { description: toolDescriptions.apply_update, inputSchema: toolArgSchemas.apply_update },
    async (args) => run("apply_update", args),
  );
  server.registerTool("get_status", { description: toolDescriptions.get_status }, async () => run("get_status", {}));
  server.registerTool(
    "reset_game",
    { description: toolDescriptions.reset_game, inputSchema: toolArgSchemas.reset_game },
    async (args) => run("reset_game", args),
  );

  return server;
}

export function mountMcp(app: Express, store: SessionStore, limiter: RateLimiter, config: ServerConfig) {
  const handler = createMcpHandler(
    () => createBirthdayServer(store, limiter, config),
    { responseMode: "json" },
  );
  const node = toNodeHandler(handler);

  const handleLive = (req: Request, res: Response) => {
    void mcpAls.run({ live: true }, () => node(req, res, req.body));
  };
  app.all("/mcp", handleLive);
  app.all("/mcp/", handleLive);

  app.all("/mcp/:token", (req: Request, res: Response) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    if (!token || !store.getByToken(token)) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unknown session token" },
        id: null,
      });
      return;
    }
    void mcpAls.run({ token }, () => node(req, res, req.body));
  });

  return handler;
}
