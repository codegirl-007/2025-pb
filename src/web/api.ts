import type { CreateSessionResponse, PublicSession, ToolName } from "../shared/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new HttpError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export function createSession(): Promise<CreateSessionResponse> {
  return fetch("/api/sessions", { method: "POST" }).then((res) => parseJson<CreateSessionResponse>(res));
}

export function fetchSnapshot(sessionId: string): Promise<PublicSession & { summary?: unknown }> {
  return fetch(`/api/sessions/${sessionId}`).then((res) => parseJson(res));
}

export function resetSession(sessionId: string): Promise<PublicSession> {
  return fetch(`/api/sessions/${sessionId}/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  }).then((res) => parseJson(res));
}

export function callDevTool(sessionId: string, name: ToolName, args: unknown) {
  return fetch(`/api/dev/sessions/${sessionId}/tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, arguments: args }),
  }).then((res) => parseJson<{ ok: boolean; mcp: unknown; snapshot: PublicSession }>(res));
}
