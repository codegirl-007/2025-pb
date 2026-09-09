import type { CreateSessionResponse } from "../shared/types";

const PUBLIC_KEY = "birthday-mcp-session";

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
    return parsed;
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
      mcpUrl: created.mcpUrl,
      mcpConfig: created.mcpConfig,
      prompt: created.prompt,
      inspectorHint: created.inspectorHint,
    } satisfies StoredSession),
  );
}

export function clearStoredSession() {
  localStorage.removeItem(PUBLIC_KEY);
}
