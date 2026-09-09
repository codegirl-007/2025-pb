export interface ServerConfig {
  host: string;
  port: number;
  publicUrl: string;
  sessionTtlMs: number;
  isProduction: boolean;
  sessionCreateLimit: number;
  sessionCreateWindowMs: number;
  mcpCallLimit: number;
  mcpCallWindowMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 8787);
  const host = env.HOST ?? "127.0.0.1";
  return {
    host,
    port,
    publicUrl: env.PUBLIC_URL ?? `http://${host}:${port}`,
    sessionTtlMs: Number(env.SESSION_TTL_MS ?? 2 * 60 * 60 * 1000),
    isProduction: env.NODE_ENV === "production",
    sessionCreateLimit: Number(env.SESSION_CREATE_LIMIT ?? 20),
    sessionCreateWindowMs: Number(env.SESSION_CREATE_WINDOW_MS ?? 10 * 60 * 1000),
    mcpCallLimit: Number(env.MCP_CALL_LIMIT ?? 120),
    mcpCallWindowMs: Number(env.MCP_CALL_WINDOW_MS ?? 60 * 1000),
  };
}
