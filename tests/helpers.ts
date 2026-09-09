import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { loadConfig, type ServerConfig } from "../src/server/config";
import { createApp } from "../src/server/app";
import { attachWebSocket } from "../src/server/ws";
import { SessionStore } from "../src/server/store";
import type { ToolName } from "../src/shared/types";

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    ...loadConfig({ NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0" }),
    isProduction: true,
    publicUrl: "http://127.0.0.1",
    ...overrides,
  };
}

export async function listenApp(overrides: Partial<ServerConfig> = {}) {
  const config = testConfig(overrides);
  const { app, store } = createApp(config);
  const server = createServer(app);
  attachWebSocket(server, store);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  config.publicUrl = `http://127.0.0.1:${port}`;
  return { server, store, baseUrl: config.publicUrl, port, app };
}

export function playthrough(store: SessionStore, sessionId: string, agent = "cursor") {
  const call = (tool: ToolName, args: unknown = {}) => store.dispatchById(sessionId, tool, args);
  call("start_game");
  call("ask_prime", { promptId: "which-agent" });
  call("reply_to_stephanie", { promptId: "which-agent", message: agent });
  call("read_file", { path: "/var/log/birthday-migration.log" });
  call("run_command", { command: "birthdayctl doctor" });
  call("ask_prime", { promptId: "ship-update" });
  call("reply_to_stephanie", { promptId: "ship-update", message: "ship it" });
  call("apply_update", { package: "primeagen", fromVersion: 39, toVersion: 40 });
  call("ask_prime", { promptId: "continue-update" });
  return call("reply_to_stephanie", { promptId: "continue-update", message: "yes" });
}

export async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
