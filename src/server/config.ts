export const PRODUCTION_ORIGIN = "https://www.theprimeagenbirthday.com";

const LOCAL_HOSTS = ["127.0.0.1", "localhost", "[::1]"];
const PRODUCTION_HOSTS = [
  "www.theprimeagenbirthday.com",
  "theprimeagenbirthday.com",
  "theprimeagen-mcp-2hz75.ondigitalocean.app",
];

export interface ServerConfig {
  host: string;
  port: number;
  publicUrl: string;
  allowedHosts: string[];
  sessionTtlMs: number;
  isProduction: boolean;
  sessionCreateLimit: number;
  sessionCreateWindowMs: number;
  mcpCallLimit: number;
  mcpCallWindowMs: number;
}

export function allowedHostnames(publicUrl: string, extra: string[] = []): string[] {
  const hosts = new Set<string>([...LOCAL_HOSTS, ...PRODUCTION_HOSTS]);
  try {
    const hostname = new URL(publicUrl).hostname;
    if (hostname) {
      hosts.add(hostname);
      if (hostname.startsWith("www.")) hosts.add(hostname.slice(4));
      else hosts.add(`www.${hostname}`);
    }
  } catch {
    /* ignore unparseable PUBLIC_URL */
  }
  for (const host of extra) {
    const trimmed = host.trim();
    if (trimmed) hosts.add(trimmed);
  }
  return [...hosts];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProduction = env.NODE_ENV === "production";
  const port = Number(env.PORT ?? 8787);
  const host = env.HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1");
  const publicUrl = env.PUBLIC_URL ?? (isProduction ? PRODUCTION_ORIGIN : `http://${host}:${port}`);
  const extraHosts = (env.ALLOWED_HOSTS ?? "").split(",");
  return {
    host,
    port,
    publicUrl,
    allowedHosts: allowedHostnames(publicUrl, extraHosts),
    sessionTtlMs: Number(env.SESSION_TTL_MS ?? 2 * 60 * 60 * 1000),
    isProduction,
    sessionCreateLimit: Number(env.SESSION_CREATE_LIMIT ?? 20),
    sessionCreateWindowMs: Number(env.SESSION_CREATE_WINDOW_MS ?? 10 * 60 * 1000),
    mcpCallLimit: Number(env.MCP_CALL_LIMIT ?? 120),
    mcpCallWindowMs: Number(env.MCP_CALL_WINDOW_MS ?? 60 * 1000),
  };
}
