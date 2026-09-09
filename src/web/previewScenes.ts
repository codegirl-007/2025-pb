import { apply, bootMessages, identify, intro, landing, mcpConfigExample, rebootMessages, ship } from "../content/index";
import type { CreateSessionResponse, PublicSession, VisualState } from "../shared/types";

export const PREVIEW_SCENES = [
  { id: "setup", label: "Setup" },
  { id: "boot", label: "Boot" },
  { id: "identify", label: "Identify" },
  { id: "diagnose", label: "Diagnose" },
  { id: "decision", label: "Decision" },
  { id: "vetoes", label: "Both vetoes" },
  { id: "install", label: "Install" },
  { id: "frozen", label: "Frozen 99%" },
  { id: "reboot", label: "Reboot" },
  { id: "reveal", label: "Reveal" },
] as const;

export type PreviewSceneId = (typeof PREVIEW_SCENES)[number]["id"];

function emptyVisual(): VisualState {
  return {
    booted: true,
    wallpaper: "desktop",
    bootMessages: [...bootMessages],
    windows: [],
    terminalLines: [],
    dialogue: [],
    notifications: [],
    cursorTarget: null,
    filePreview: null,
    update: { visible: false, progress: 0, stepLabel: "", warning: null },
    activity: [],
  };
}

function fixture(stamp: number, stage: PublicSession["stage"], visual: Partial<VisualState>, rest: Partial<PublicSession> = {}): PublicSession {
  const now = new Date(stamp).toISOString();
  return {
    sessionId: `preview:${stage}:${stamp}`,
    sessionCode: "PRIME-PREV",
    stage,
    connectionState: stage === "complete" ? "complete" : stage === "identify_agent" ? "agent_connected" : "experience_running",
    stateVersion: 1,
    objective: "",
    transcript: [],
    completedActions: [],
    visual: { ...emptyVisual(), ...visual },
    createdAt: now,
    lastActivityAt: now,
    agentConnectedAt: now,
    completedAt: stage === "complete" ? now : null,
    complete: stage === "complete",
    agentLabel: "cursor",
    lastPrimeMessage: null,
    pendingPromptId: null,
    investigation: {},
    shipDecision: null,
    stats: { mcpCalls: 8, invalidCalls: 0, humanInterventions: 2, messagesExchanged: 6 },
    events: [],
    ...rest,
  };
}

export function previewCreated(): CreateSessionResponse {
  const mcpUrl = `${window.location.origin}/mcp`;
  return {
    sessionId: "preview",
    sessionCode: "PRIME-PREV",
    mcpUrl,
    mcpConfig: mcpConfigExample(mcpUrl),
    prompt: landing.prompt,
    inspectorHint: "",
  };
}

export function previewSnapshot(id: PreviewSceneId, stamp = Date.now()): PublicSession | null {
  if (id === "setup") return null;

  if (id === "boot" || id === "identify") {
    return fixture(stamp, "identify_agent", {
      cursorTarget: "notice-agent",
      dialogue: [
        { id: "d1", speaker: "stephanie", text: `${intro.stephanie}\n\n${intro.attribution}` },
      ],
    }, { pendingPromptId: identify.promptId });
  }

  if (id === "diagnose") {
    return fixture(stamp, "diagnose", {
      cursorTarget: "system-status",
      terminalLines: [{ id: "t1", kind: "input", text: "$ birthdayctl doctor" }],
    }, { lastPrimeMessage: "cursor" });
  }

  if (id === "decision") {
    return fixture(stamp, "human_decision", {
      cursorTarget: "system-status",
      dialogue: [{ id: "d1", speaker: "agent", text: ship.question }],
    }, { pendingPromptId: ship.promptId });
  }

  if (id === "vetoes") {
    return fixture(stamp, "human_decision", {
      cursorTarget: "system-status",
      dialogue: [
        { id: "d1", speaker: "prime", text: "roll back" },
        { id: "d2", speaker: "stephanie", text: ship.rollback },
        { id: "d3", speaker: "prime", text: "postpone" },
        { id: "d4", speaker: "stephanie", text: ship.postpone },
      ],
    }, {
      pendingPromptId: ship.promptId,
      lastPrimeMessage: "postpone",
      shipDecision: "postpone",
    });
  }

  if (id === "install") {
    const mid = apply.steps[2]!;
    return fixture(stamp, "apply_update", {
      cursorTarget: "update-manager",
      update: { visible: true, progress: mid.progress, stepLabel: mid.label, warning: null },
    }, { shipDecision: "ship" });
  }

  if (id === "frozen") {
    const last = apply.steps[apply.steps.length - 1]!;
    return fixture(stamp, "confirm_update", {
      cursorTarget: "update-manager",
      update: { visible: true, progress: last.progress, stepLabel: last.label, warning: apply.warning },
    }, {
      shipDecision: "ship",
      pendingPromptId: apply.continuePromptId,
    });
  }

  return fixture(stamp, "complete", {
    wallpaper: "reveal",
    bootMessages: [...rebootMessages],
    cursorTarget: "reveal",
    update: { visible: true, progress: 100, stepLabel: "Installation successful", warning: null },
  }, { shipDecision: "ship" });
}
