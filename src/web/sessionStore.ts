import type { CreateSessionResponse } from "../shared/types";

const PUBLIC_KEY = "birthday-mcp-session";
const TOKEN_KEY = "birthday-mcp-token";

export interface StoredSession {
  sessionId: string;
  sessionCode: string;
  mcpUrl?: string;
  mcpConfig?: Record<string, unknown>;
  prompt?: string;
  inspectorHint?: string;
}

export function loadStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(PUBLIC_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.sessionId || !parsed.sessionCode) return null;
    const tokenUrl = sessionStorage.getItem(TOKEN_KEY);
    return { ...parsed, mcpUrl: tokenUrl ?? parsed.mcpUrl };
  } catch {
    return null;
  }
}

export function storeCreatedSession(created: CreateSessionResponse) {
  localStorage.setItem(
    PUBLIC_KEY,
    JSON.stringify({
      sessionId: created.sessionId,
      sessionCode: created.sessionCode,
      prompt: created.prompt,
      inspectorHint: created.inspectorHint,
    } satisfies StoredSession),
  );
  sessionStorage.setItem(TOKEN_KEY, created.mcpUrl);
}

export function clearStoredSession() {
  localStorage.removeItem(PUBLIC_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
