import { agentReplies } from "../content/index";

export type AgentKind = keyof typeof agentReplies;

export function classifyAgent(message: string): AgentKind {
  const text = message.toLowerCase();
  if (text.includes("claude")) return "claude";
  if (text.includes("codex")) return "codex";
  if (text.includes("opencode")) return "opencode";
  if (text.includes("gemini")) return "gemini";
  if (text.includes("cursor")) return "cursor";
  return "other";
}

export function classifyShipDecision(message: string): "ship" | "rollback" | "postpone" | "unclear" {
  const text = message.toLowerCase();
  if (/\bship\b/.test(text) || text.includes("send") || text.includes("do it") || /\byes\b/.test(text)) {
    return "ship";
  }
  if (text.includes("rollback") || text.includes("roll back") || text.includes("revert")) {
    return "rollback";
  }
  if (text.includes("postpone") || text.includes("wait") || text.includes("later")) {
    return "postpone";
  }
  return "unclear";
}

export function classifyContinue(message: string): "continue" | "unclear" {
  const text = message.toLowerCase();
  if (
    text.includes("continue") ||
    text.includes("ship") ||
    text.includes("do it") ||
    /\byes\b/.test(text) ||
    text.includes("confirm") ||
    text.includes("proceed") ||
    /\bok\b/.test(text) ||
    /\bgo\b/.test(text)
  ) {
    return "continue";
  }
  return "unclear";
}
