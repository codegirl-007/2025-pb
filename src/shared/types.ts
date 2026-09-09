export const CONNECTION_STATES = [
  "waiting_for_agent",
  "agent_connected",
  "experience_running",
  "complete",
] as const;

export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const STAGES = [
  "waiting",
  "intro",
  "identify_agent",
  "diagnose",
  "human_decision",
  "apply_update",
  "confirm_update",
  "complete",
] as const;

export type Stage = (typeof STAGES)[number];

export const APPS = ["terminal", "files", "system_status", "update_manager"] as const;
export type AppId = (typeof APPS)[number];

export const SPEAKERS = ["stephanie", "prime", "agent", "system"] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const TOOL_NAMES = [
  "start_game",
  "inspect_screen",
  "open_app",
  "read_file",
  "run_command",
  "ask_prime",
  "reply_to_stephanie",
  "choose_action",
  "apply_update",
  "get_status",
  "reset_game",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface WindowState {
  id: string;
  app: AppId | "editor" | "notice" | "reveal";
  title: string;
  open: boolean;
  focused: boolean;
  path?: string;
}

export interface DialogueLine {
  id: string;
  speaker: Speaker;
  text: string;
}

export interface TerminalLine {
  id: string;
  kind: "input" | "output" | "system";
  text: string;
}

export interface ToastNotification {
  id: string;
  title: string;
  body: string;
}

export interface ActivityEntry {
  id: string;
  tool: string;
  summary: string;
  ok: boolean;
  at: string;
}

export interface TranscriptEntry {
  id: string;
  at: string;
  actor: "mcp" | "human" | "system";
  tool?: string;
  text: string;
  ok: boolean;
}

export interface FilePreview {
  path: string;
  content: string;
}

export interface UpdateVisual {
  visible: boolean;
  progress: number;
  stepLabel: string;
  warning: string | null;
}

export interface VisualState {
  booted: boolean;
  wallpaper: "lock" | "desktop" | "reboot" | "reveal";
  bootMessages: string[];
  windows: WindowState[];
  terminalLines: TerminalLine[];
  dialogue: DialogueLine[];
  notifications: ToastNotification[];
  cursorTarget: string | null;
  filePreview: FilePreview | null;
  update: UpdateVisual;
  activity: ActivityEntry[];
}

export interface SessionStats {
  mcpCalls: number;
  invalidCalls: number;
  humanInterventions: number;
  messagesExchanged: number;
}

export interface SessionSummary {
  agentUsed: string | null;
  mcpCalls: number;
  invalidCalls: number;
  humanInterventions: number;
  messagesExchanged: number;
  updateResult: string;
  elapsedMs: number;
}

export interface SessionState {
  sessionId: string;
  sessionCode: string;
  secretToken: string;
  stage: Stage;
  connectionState: ConnectionState;
  stateVersion: number;
  objective: string;
  transcript: TranscriptEntry[];
  completedActions: string[];
  visual: VisualState;
  createdAt: string;
  lastActivityAt: string;
  agentConnectedAt: string | null;
  completedAt: string | null;
  complete: boolean;
  agentLabel: string | null;
  lastPrimeMessage: string | null;
  pendingPromptId: string | null;
  investigation: Record<string, boolean>;
  shipDecision: "ship" | "rollback" | "postpone" | null;
  stats: SessionStats;
  events: SessionEvent[];
}

export type PublicSession = Omit<SessionState, "secretToken">;

export interface SessionEvent {
  eventId: string;
  sessionId: string;
  stateVersion: number;
  type: string;
  payload: unknown;
  timestamp: string;
}

export interface McpPayload {
  status: string;
  stage: Stage;
  objective: string;
  connectionState: ConnectionState;
  stateVersion: number;
  instruction?: string;
  humanResponseRequired?: boolean;
  [key: string]: unknown;
}

export interface EngineResult {
  ok: boolean;
  state: SessionState;
  events: SessionEvent[];
  mcp: McpPayload;
}

export interface CreateSessionResponse {
  sessionId: string;
  sessionCode: string;
  mcpUrl: string;
  mcpConfig: Record<string, unknown>;
  prompt: string;
  inspectorHint: string;
}

export interface WsClientMessage {
  type: "ping";
}

export interface WsServerMessage {
  type: "snapshot" | "event" | "error";
  snapshot?: PublicSession;
  event?: SessionEvent;
  message?: string;
}
