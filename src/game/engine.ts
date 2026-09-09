import { randomBytes, randomUUID } from "node:crypto";
import {
  apply,
  bootMessages,
  diagnose,
  identify,
  intro,
  objectives,
  rebootMessages,
  reveal,
  ship,
  updateErrors,
  agentReplies,
} from "../content/index";
import {
  TOOL_NAMES,
  type AppId,
  type EngineResult,
  type McpPayload,
  type PublicSession,
  type SessionEvent,
  type SessionState,
  type Stage,
  type ToolName,
  type VisualState,
  type WindowState,
} from "../shared/types";
import { classifyAgent, classifyContinue, classifyShipDecision } from "./classify";
import { runFakeCommand } from "./commands";
import { knownPaths, readFakeFile } from "./filesystem";
import { toolArgSchemas } from "./schemas";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSessionCode(): string {
  let body = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i += 1) {
    body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `PRIME-${body}`;
}

export function generateSecretToken(): string {
  return randomBytes(24).toString("base64url");
}

export function emptyVisual(): VisualState {
  return {
    booted: false,
    wallpaper: "lock",
    bootMessages: [],
    windows: [],
    terminalLines: [],
    dialogue: [],
    notifications: [],
    cursorTarget: null,
    filePreview: null,
    update: {
      visible: false,
      progress: 0,
      stepLabel: "",
      warning: null,
    },
    activity: [],
  };
}

export function createInitialState(now: Date, ids?: { sessionId?: string; sessionCode?: string; secretToken?: string }): SessionState {
  const createdAt = now.toISOString();
  return {
    sessionId: ids?.sessionId ?? randomUUID(),
    sessionCode: ids?.sessionCode ?? generateSessionCode(),
    secretToken: ids?.secretToken ?? generateSecretToken(),
    stage: "waiting",
    connectionState: "waiting_for_agent",
    stateVersion: 0,
    objective: objectives.waiting,
    transcript: [],
    completedActions: [],
    visual: emptyVisual(),
    createdAt,
    lastActivityAt: createdAt,
    agentConnectedAt: null,
    completedAt: null,
    complete: false,
    agentLabel: null,
    lastPrimeMessage: null,
    pendingPromptId: null,
    investigation: {},
    shipDecision: null,
    stats: {
      mcpCalls: 0,
      invalidCalls: 0,
      humanInterventions: 0,
      messagesExchanged: 0,
    },
    events: [],
  };
}

export function toPublicSession(state: SessionState): PublicSession {
  const { secretToken: _secret, ...rest } = state;
  return rest;
}

function cloneState(state: SessionState): SessionState {
  return structuredClone(state);
}

function pushEvent(state: SessionState, type: string, payload: unknown, now: Date): SessionEvent {
  const event: SessionEvent = {
    eventId: randomUUID(),
    sessionId: state.sessionId,
    stateVersion: state.stateVersion,
    type,
    payload,
    timestamp: now.toISOString(),
  };
  state.events.push(event);
  if (state.events.length > 400) {
    state.events.splice(0, state.events.length - 400);
  }
  return event;
}

function addActivity(state: SessionState, tool: string, summary: string, ok: boolean, now: Date) {
  state.visual.activity.unshift({
    id: randomUUID(),
    tool,
    summary,
    ok,
    at: now.toISOString(),
  });
  state.visual.activity = state.visual.activity.slice(0, 40);
}

function addDialogue(state: SessionState, speaker: "stephanie" | "prime" | "agent" | "system", text: string) {
  state.visual.dialogue.push({ id: randomUUID(), speaker, text });
  state.stats.messagesExchanged += 1;
}

function addToast(state: SessionState, title: string, body: string) {
  state.visual.notifications = [
    { id: randomUUID(), title, body },
    ...state.visual.notifications,
  ].slice(0, 6);
}

function addTerminal(state: SessionState, kind: "input" | "output" | "system", text: string) {
  for (const line of text.split("\n")) {
    state.visual.terminalLines.push({ id: randomUUID(), kind, text: line });
  }
  if (state.visual.terminalLines.length > 200) {
    state.visual.terminalLines.splice(0, state.visual.terminalLines.length - 200);
  }
}

function focusWindow(state: SessionState, id: string) {
  for (const win of state.visual.windows) {
    win.focused = win.id === id && win.open;
  }
}

function upsertWindow(state: SessionState, window: Omit<WindowState, "open" | "focused"> & { focused?: boolean }) {
  const existing = state.visual.windows.find((win) => win.id === window.id);
  if (existing) {
    existing.open = true;
    existing.title = window.title;
    existing.path = window.path;
    existing.app = window.app;
    focusWindow(state, existing.id);
    return existing;
  }
  const created: WindowState = {
    ...window,
    open: true,
    focused: true,
  };
  for (const win of state.visual.windows) win.focused = false;
  state.visual.windows.push(created);
  return created;
}

function setStage(state: SessionState, stage: Stage) {
  state.stage = stage;
  state.objective = objectives[stage];
  if (stage === "complete") {
    state.connectionState = "complete";
    state.complete = true;
  }
}

function investigationCount(state: SessionState): number {
  return Object.values(state.investigation).filter(Boolean).length;
}

function maybeUnlockDecision(state: SessionState, now: Date) {
  if (state.stage !== "diagnose") return;
  if (investigationCount(state) < 2) return;
  if (state.completedActions.includes("investigation-complete")) return;
  state.completedActions.push("investigation-complete");
  setStage(state, "human_decision");
  addToast(state, "Update available", diagnose.unlockMessage);
  addDialogue(state, "stephanie", diagnose.unlockMessage);
  state.visual.cursorTarget = "dialogue-dock";
  pushEvent(state, "decision_unlocked", { message: diagnose.unlockMessage }, now);
}

function started(state: SessionState): boolean {
  return state.stage !== "waiting";
}

function errorResult(
  state: SessionState,
  tool: string,
  message: string,
  now: Date,
  extra?: Record<string, unknown>,
  extraEvents: SessionEvent[] = [],
): EngineResult {
  state.stats.mcpCalls += 1;
  state.stats.invalidCalls += 1;
  state.lastActivityAt = now.toISOString();
  state.stateVersion += 1;
  addActivity(state, tool, message, false, now);
  state.transcript.push({
    id: randomUUID(),
    at: now.toISOString(),
    actor: "mcp",
    tool,
    text: message,
    ok: false,
  });
  const event = pushEvent(state, "tool_error", { tool, message }, now);
  const mcp: McpPayload = {
    status: "error",
    stage: state.stage,
    objective: state.objective,
    connectionState: state.connectionState,
    stateVersion: state.stateVersion,
    error: message,
    instruction: `Do not skip stages. Current objective: ${state.objective}`,
    humanResponseRequired: Boolean(state.pendingPromptId),
    ...extra,
  };
  return { ok: false, state, events: [...extraEvents, event], mcp };
}

function okResult(state: SessionState, tool: string, summary: string, now: Date, mcpExtra: Partial<McpPayload>, events: SessionEvent[]): EngineResult {
  state.stats.mcpCalls += 1;
  state.lastActivityAt = now.toISOString();
  if (state.stage !== "waiting" && state.stage !== "complete" && tool !== "start_game") {
    state.connectionState = "experience_running";
  }
  addActivity(state, tool, summary, true, now);
  state.transcript.push({
    id: randomUUID(),
    at: now.toISOString(),
    actor: "mcp",
    tool,
    text: summary,
    ok: true,
  });
  const mcp: McpPayload = {
    status: "ok",
    stage: state.stage,
    objective: state.objective,
    connectionState: state.connectionState,
    stateVersion: state.stateVersion,
    instruction: state.objective,
    humanResponseRequired: Boolean(state.pendingPromptId),
    completedActions: state.completedActions,
    ...mcpExtra,
  };
  return { ok: true, state, events, mcp };
}

function visibleWindows(state: SessionState) {
  return state.visual.windows.filter((win) => win.open).map((win) => ({
    id: win.id,
    app: win.app,
    title: win.title,
    focused: win.focused,
  }));
}

function onScreenText(state: SessionState): string[] {
  const texts = [
    ...state.visual.dialogue.slice(-6).map((line) => `${line.speaker}: ${line.text}`),
    ...state.visual.notifications.slice(0, 3).map((n) => `${n.title}: ${n.body}`),
  ];
  const status = state.visual.windows.find((win) => win.id === "system-status" && win.open);
  if (status) texts.push(diagnose.statusText);
  if (state.visual.filePreview) texts.push(`${state.visual.filePreview.path}\n${state.visual.filePreview.content}`);
  if (state.visual.update.visible) {
    texts.push(`Update ${state.visual.update.progress}% ${state.visual.update.stepLabel}`);
    if (state.visual.update.warning) texts.push(state.visual.update.warning);
  }
  if (state.complete) texts.push(reveal.banner);
  return texts;
}

function inspectPayload(state: SessionState) {
  return {
    stage: state.stage,
    objective: state.objective,
    visibleWindows: visibleWindows(state),
    interactiveElementIds: [
      ...state.visual.windows.filter((w) => w.open).map((w) => w.id),
      state.visual.cursorTarget,
    ].filter(Boolean),
    onScreenText: onScreenText(state),
    humanResponseRequired: Boolean(state.pendingPromptId),
    suggestedNextStep: state.objective,
    pendingPromptId: state.pendingPromptId,
    knownFiles: knownPaths(),
  };
}

function handleStart(state: SessionState, now: Date): EngineResult {
  if (started(state) && state.completedActions.includes("start_game")) {
    const event = pushEvent(state, "start_game_idempotent", { stage: state.stage }, now);
    return okResult(state, "start_game", "Already started; resuming current objective.", now, {
      role: "You control the website. Prime is watching. Ask him questions only when instructed.",
      resumed: true,
      inspect: inspectPayload(state),
    }, [event]);
  }

  state.stateVersion += 1;
  state.agentConnectedAt = now.toISOString();
  state.connectionState = "agent_connected";
  state.visual.booted = true;
  state.visual.wallpaper = "desktop";
  state.visual.bootMessages = [...bootMessages];
  state.completedActions.push("start_game");
  addToast(state, "MCP", intro.agentConnected);
  addDialogue(state, "system", intro.agentConnected);
  addDialogue(state, "stephanie", `${intro.stephanie}\n\n${intro.attribution}`);
  upsertWindow(state, {
    id: "notice-agent",
    app: "notice",
    title: "before we begin",
  });
  state.visual.cursorTarget = "notice-agent";
  setStage(state, "identify_agent");
  const events = [
    pushEvent(state, "agent_connected", { message: intro.agentConnected }, now),
    pushEvent(state, "boot", { messages: bootMessages }, now),
    pushEvent(state, "dialogue", { speaker: "stephanie", text: intro.stephanie }, now),
  ];
  return okResult(state, "start_game", "Booted the simulated desktop and began the introduction.", now, {
    role: "You control the website through MCP tools. Prime is watching. Inspect the screen. Ask Prime questions when instructed. Do not invent tool names or bypass objectives.",
    firstObjective: state.objective,
    inspect: inspectPayload(state),
  }, events);
}

function handleOpenApp(state: SessionState, app: AppId, now: Date): EngineResult {
  if (!started(state)) return errorResult(state, "open_app", "Call start_game first.", now);
  if (app === "update_manager" && state.stage !== "apply_update" && state.stage !== "confirm_update" && state.stage !== "complete") {
    return errorResult(state, "open_app", "Update Manager is locked until Prime ships the update.", now);
  }

  state.stateVersion += 1;
  const titles: Record<AppId, string> = {
    terminal: "terminal",
    files: "files — /home/prime",
    system_status: "system status",
    update_manager: "update manager",
  };
  const ids: Record<AppId, string> = {
    terminal: "terminal",
    files: "files",
    system_status: "system-status",
    update_manager: "update-manager",
  };
  upsertWindow(state, { id: ids[app], app, title: titles[app] });
  state.visual.cursorTarget = ids[app];
  if (app === "system_status") state.investigation.openedSystemStatus = true;
  if (app === "terminal" && state.visual.terminalLines.length === 0) {
    addTerminal(state, "system", "birthdaysh 41.0 (simulated). Type is controlled by the agent.");
  }
  maybeUnlockDecision(state, now);
  const event = pushEvent(state, "window_open", { app, id: ids[app] }, now);
  return okResult(state, "open_app", `Opened ${app}.`, now, { inspect: inspectPayload(state) }, [event]);
}

function handleReadFile(state: SessionState, path: string, now: Date): EngineResult {
  if (!started(state)) return errorResult(state, "read_file", "Call start_game first.", now);
  if (state.stage === "identify_agent") {
    return errorResult(state, "read_file", 'Identify the agent first via ask_prime("which-agent").', now);
  }
  const content = readFakeFile(path);
  if (!content) {
    return errorResult(state, "read_file", `No such file in the simulated filesystem: ${path}. Known files: ${knownPaths().join(", ")}`, now);
  }
  state.stateVersion += 1;
  upsertWindow(state, { id: "editor", app: "editor", title: path, path });
  state.visual.filePreview = { path, content };
  state.visual.cursorTarget = "editor";
  if (path.includes("birthday-migration.log")) state.investigation.readLog = true;
  if (path.includes("README.md")) state.investigation.readReadme = true;
  maybeUnlockDecision(state, now);
  const event = pushEvent(state, "file_open", { path, content }, now);
  return okResult(state, "read_file", `Read ${path}.`, now, { path, content, inspect: inspectPayload(state) }, [event]);
}

function handleRunCommand(state: SessionState, command: string, now: Date): EngineResult {
  if (!started(state)) return errorResult(state, "run_command", "Call start_game first.", now);
  if (state.stage === "identify_agent") {
    return errorResult(state, "run_command", 'Identify the agent first via ask_prime("which-agent").', now);
  }
  const result = runFakeCommand(command);
  state.stateVersion += 1;
  upsertWindow(state, { id: "terminal", app: "terminal", title: "terminal" });
  addTerminal(state, "input", `$ ${command}`);
  addTerminal(state, "output", result.output);
  state.visual.cursorTarget = "terminal";
  if (result.opensPath) {
    const content = readFakeFile(result.opensPath);
    if (content) {
      upsertWindow(state, { id: "editor", app: "editor", title: result.opensPath, path: result.opensPath });
      state.visual.filePreview = { path: result.opensPath, content };
    }
  }
  for (const flag of result.countsAs) {
    state.investigation[flag] = true;
  }
  maybeUnlockDecision(state, now);
  const event = pushEvent(state, "terminal", { command, output: result.output }, now);
  return okResult(state, "run_command", `Ran simulated command: ${command}`, now, {
    output: result.output,
    inspect: inspectPayload(state),
  }, [event]);
}

function handleAskPrime(state: SessionState, promptId: string, now: Date): EngineResult {
  if (!started(state)) return errorResult(state, "ask_prime", "Call start_game first.", now);

  const catalog: Record<string, { question: string; stage: Stage; instruction: string }> = {
    [identify.promptId]: {
      question: identify.question,
      stage: "identify_agent",
      instruction: identify.askInstruction,
    },
    [ship.promptId]: {
      question: ship.question,
      stage: "human_decision",
      instruction: ship.askInstruction,
    },
    [apply.continuePromptId]: {
      question: apply.continueQuestion,
      stage: "confirm_update",
      instruction: apply.continueInstruction,
    },
  };
  const spec = catalog[promptId];
  if (!spec) {
    return errorResult(state, "ask_prime", `Unknown promptId '${promptId}'. Valid: ${Object.keys(catalog).join(", ")}`, now);
  }
  if (state.stage !== spec.stage) {
    return errorResult(state, "ask_prime", `promptId '${promptId}' is not valid in stage '${state.stage}'. ${state.objective}`, now);
  }

  state.stateVersion += 1;
  state.pendingPromptId = promptId;
  addDialogue(state, "agent", spec.question);
  addToast(state, "Ask Prime", spec.question.split("\n")[0] ?? spec.question);
  state.visual.cursorTarget = "dialogue-dock";
  const event = pushEvent(state, "ask_prime", { promptId, question: spec.question }, now);
  return okResult(state, "ask_prime", "Ask Prime the question verbatim, then submit his answer.", now, {
    promptId,
    question: spec.question,
    instruction: spec.instruction,
    humanResponseRequired: true,
  }, [event]);
}

function handleReply(state: SessionState, promptId: string, message: string, now: Date): EngineResult {
  if (!started(state)) return errorResult(state, "reply_to_stephanie", "Call start_game first.", now);
  if (state.pendingPromptId !== promptId) {
    return errorResult(
      state,
      "reply_to_stephanie",
      state.pendingPromptId
        ? `Pending prompt is '${state.pendingPromptId}'. Call ask_prime first if needed.`
        : "No question is pending. Call ask_prime with the current promptId first.",
      now,
    );
  }

  state.stateVersion += 1;
  state.lastPrimeMessage = message;
  state.stats.humanInterventions += 1;
  addDialogue(state, "prime", message);
  const events: SessionEvent[] = [pushEvent(state, "prime_reply", { promptId, message }, now)];

  if (promptId === identify.promptId) {
    const kind = classifyAgent(message);
    const reply = agentReplies[kind];
    state.agentLabel = message;
    addDialogue(state, "stephanie", reply);
    state.pendingPromptId = null;
    state.completedActions.push("identified_agent");
    setStage(state, "diagnose");
    upsertWindow(state, { id: "system-status", app: "system_status", title: "system status" });
    state.investigation.openedSystemStatus = true;
    state.visual.cursorTarget = "system-status";
    events.push(pushEvent(state, "stephanie_reply", { text: reply, kind }, now));
    events.push(pushEvent(state, "window_open", { app: "system_status" }, now));
    return okResult(state, "reply_to_stephanie", "Recorded the agent identity.", now, {
      classifiedAs: kind,
      stephanie: reply,
      inspect: inspectPayload(state),
    }, events);
  }

  if (promptId === ship.promptId) {
    const decision = classifyShipDecision(message);
    if (decision === "unclear") {
      addDialogue(state, "stephanie", ship.unclear);
      events.push(pushEvent(state, "stephanie_reply", { text: ship.unclear, decision }, now));
      return okResult(state, "reply_to_stephanie", "Need an explicit choice. Ask again if needed.", now, {
        classifiedAs: "unclear",
        stephanie: ship.unclear,
        humanResponseRequired: true,
        instruction: ship.askInstruction,
      }, events);
    }
    if (decision === "rollback") {
      addDialogue(state, "stephanie", ship.rollback);
      state.shipDecision = "rollback";
      events.push(pushEvent(state, "stephanie_reply", { text: ship.rollback, decision }, now));
      return okResult(state, "reply_to_stephanie", "Rollback rejected. Ask Prime again.", now, {
        classifiedAs: "rollback",
        stephanie: ship.rollback,
        humanResponseRequired: true,
        instruction: ship.askInstruction,
      }, events);
    }
    if (decision === "postpone") {
      addDialogue(state, "stephanie", ship.postpone);
      state.shipDecision = "postpone";
      events.push(pushEvent(state, "stephanie_reply", { text: ship.postpone, decision }, now));
      return okResult(state, "reply_to_stephanie", "Postpone rejected. Ask Prime again.", now, {
        classifiedAs: "postpone",
        stephanie: ship.postpone,
        humanResponseRequired: true,
        instruction: ship.askInstruction,
      }, events);
    }
    addDialogue(state, "stephanie", ship.ship);
    state.shipDecision = "ship";
    state.pendingPromptId = null;
    state.completedActions.push("shipped");
    setStage(state, "apply_update");
    events.push(pushEvent(state, "stephanie_reply", { text: ship.ship, decision: "ship" }, now));
    return okResult(state, "reply_to_stephanie", "Prime shipped it. Apply the update.", now, {
      classifiedAs: "ship",
      stephanie: ship.ship,
      inspect: inspectPayload(state),
    }, events);
  }

  if (promptId === apply.continuePromptId) {
    const decision = classifyContinue(message);
    if (decision !== "continue") {
      addDialogue(state, "stephanie", apply.continueUnclear);
      events.push(pushEvent(state, "stephanie_reply", { text: apply.continueUnclear, decision }, now));
      return okResult(state, "reply_to_stephanie", "Need confirmation to finish the update.", now, {
        classifiedAs: "unclear",
        stephanie: apply.continueUnclear,
        humanResponseRequired: true,
      }, events);
    }
    finishUpdate(state, now, events);
    return okResult(state, "reply_to_stephanie", "Update completed.", now, {
      status: "complete",
      instruction: apply.completeInstruction,
      classifiedAs: "continue",
    }, events);
  }

  return errorResult(state, "reply_to_stephanie", "Unhandled prompt.", now);
}

function finishUpdate(state: SessionState, now: Date, events: SessionEvent[]) {
  state.visual.update.progress = 100;
  state.visual.update.stepLabel = "Installation successful";
  state.visual.update.warning = null;
  addTerminal(state, "output", "100% Installation successful");
  state.visual.wallpaper = "reboot";
  state.visual.bootMessages = [...rebootMessages];
  events.push(pushEvent(state, "update_progress", { progress: 100 }, now));
  events.push(pushEvent(state, "reboot", { messages: rebootMessages }, now));
  state.visual.wallpaper = "reveal";
  upsertWindow(state, { id: "reveal", app: "reveal", title: "primeagen 41.0" });
  state.visual.cursorTarget = "reveal";
  state.pendingPromptId = null;
  state.completedAt = now.toISOString();
  state.completedActions.push("completed");
  setStage(state, "complete");
  events.push(pushEvent(state, "reveal", { complete: true }, now));
}

function handleApplyUpdate(state: SessionState, args: { package: string; fromVersion: number; toVersion: number }, now: Date): EngineResult {
  if (state.stage === "complete" || state.completedActions.includes("apply_update")) {
    return errorResult(state, "apply_update", "Update already applied. Do not replay completed transitions.", now);
  }
  if (state.stage === "confirm_update") {
    return errorResult(state, "apply_update", "Update is paused at 99%. Ask Prime whether to continue.", now);
  }
  if (state.stage !== "apply_update") {
    return errorResult(state, "apply_update", updateErrors.wrongStage, now);
  }
  if (args.package !== apply.required.package) {
    upsertWindow(state, { id: "terminal", app: "terminal", title: "terminal" });
    addToast(state, "Update failed", updateErrors.wrongPackage(args.package));
    addTerminal(state, "output", updateErrors.wrongPackage(args.package));
    return errorResult(state, "apply_update", updateErrors.wrongPackage(args.package), now, { visible: true });
  }
  if (args.fromVersion !== apply.required.fromVersion) {
    addToast(state, "Update failed", updateErrors.wrongFrom(args.fromVersion));
    addTerminal(state, "output", updateErrors.wrongFrom(args.fromVersion));
    return errorResult(state, "apply_update", updateErrors.wrongFrom(args.fromVersion), now, { visible: true });
  }
  if (args.toVersion !== apply.required.toVersion) {
    addToast(state, "Update failed", updateErrors.wrongTo(args.toVersion));
    addTerminal(state, "output", updateErrors.wrongTo(args.toVersion));
    return errorResult(state, "apply_update", updateErrors.wrongTo(args.toVersion), now, { visible: true });
  }

  state.stateVersion += 1;
  state.completedActions.push("apply_update");
  upsertWindow(state, { id: "update-manager", app: "update_manager", title: "update manager" });
  upsertWindow(state, { id: "terminal", app: "terminal", title: "terminal" });
  state.visual.update.visible = true;
  state.visual.update.warning = apply.warning;
  const last = apply.steps[apply.steps.length - 1]!;
  state.visual.update.progress = last.progress;
  state.visual.update.stepLabel = last.label;
  for (const step of apply.steps) {
    addTerminal(state, "output", `${step.progress}%  ${step.label}`);
  }
  addTerminal(state, "system", apply.warning);
  addToast(state, "Warning", apply.warning);
  setStage(state, "confirm_update");
  state.visual.cursorTarget = "update-manager";
  const events = [
    pushEvent(state, "window_open", { app: "update_manager" }, now),
    pushEvent(state, "update_progress", { steps: apply.steps, paused: true, warning: apply.warning }, now),
  ];
  return okResult(state, "apply_update", "Update paused at 99%. Ask the human whether to continue.", now, {
    pausedAt: 99,
    warning: apply.warning,
    instruction: apply.continueInstruction,
    nextPromptId: apply.continuePromptId,
    inspect: inspectPayload(state),
  }, events);
}

function handleChooseAction(state: SessionState, choiceId: string, now: Date): EngineResult {
  switch (choiceId) {
    case "open-terminal":
      return handleOpenApp(state, "terminal", now);
    case "open-files":
      return handleOpenApp(state, "files", now);
    case "open-system-status":
      return handleOpenApp(state, "system_status", now);
    case "open-update-manager":
      return handleOpenApp(state, "update_manager", now);
    case "read-migration-log":
      return handleReadFile(state, "/var/log/birthday-migration.log", now);
    case "read-readme":
      return handleReadFile(state, "/home/prime/README.md", now);
    case "run-doctor":
      return handleRunCommand(state, "birthdayctl doctor", now);
    case "run-status":
      return handleRunCommand(state, "birthdayctl status", now);
    case "apply-primeagen-41":
      return handleApplyUpdate(state, { package: "primeagen", fromVersion: 40, toVersion: 41 }, now);
    default:
      return errorResult(state, "choose_action", `Unknown or unavailable choiceId '${choiceId}'.`, now);
  }
}

function handleInspect(state: SessionState, now: Date): EngineResult {
  if (!started(state)) return errorResult(state, "inspect_screen", "Call start_game first.", now);
  state.stateVersion += 1;
  const event = pushEvent(state, "inspect_screen", { stage: state.stage }, now);
  return okResult(state, "inspect_screen", "Current screen inspected.", now, inspectPayload(state), [event]);
}

function handleStatus(state: SessionState, now: Date): EngineResult {
  state.stateVersion += 1;
  const event = pushEvent(state, "get_status", { stage: state.stage }, now);
  return okResult(state, "get_status", "Status retrieved.", now, {
    completedSteps: state.completedActions,
    humanMustBeConsulted: Boolean(state.pendingPromptId) || ["identify_agent", "human_decision", "confirm_update"].includes(state.stage),
    inspect: inspectPayload(state),
  }, [event]);
}

function handleReset(state: SessionState, now: Date): EngineResult {
  const preserved = {
    sessionId: state.sessionId,
    sessionCode: state.sessionCode,
    secretToken: state.secretToken,
  };
  const next = createInitialState(now, preserved);
  next.stateVersion = state.stateVersion + 1;
  next.lastActivityAt = now.toISOString();
  const event = pushEvent(next, "reset", { sessionId: next.sessionId }, now);
  next.stats.mcpCalls = state.stats.mcpCalls + 1;
  next.transcript.push({
    id: randomUUID(),
    at: now.toISOString(),
    actor: "system",
    tool: "reset_game",
    text: "Session reset.",
    ok: true,
  });
  addActivity(next, "reset_game", "Session reset.", true, now);
  return {
    ok: true,
    state: next,
    events: [event],
    mcp: {
      status: "ok",
      stage: next.stage,
      objective: next.objective,
      connectionState: next.connectionState,
      stateVersion: next.stateVersion,
      instruction: next.objective,
    },
  };
}

export function handleTool(state: SessionState, tool: ToolName, rawArgs: unknown, now = new Date()): EngineResult {
  const schema = toolArgSchemas[tool];
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const next = cloneState(state);
    return errorResult(next, tool, `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}`, now);
  }
  const next = cloneState(state);
  const args = parsed.data;
  switch (tool) {
    case "start_game":
      return handleStart(next, now);
    case "inspect_screen":
      return handleInspect(next, now);
    case "open_app":
      return handleOpenApp(next, (args as { app: AppId }).app, now);
    case "read_file":
      return handleReadFile(next, (args as { path: string }).path, now);
    case "run_command":
      return handleRunCommand(next, (args as { command: string }).command, now);
    case "ask_prime":
      return handleAskPrime(next, (args as { promptId: string }).promptId, now);
    case "reply_to_stephanie":
      return handleReply(next, (args as { promptId: string; message: string }).promptId, (args as { promptId: string; message: string }).message, now);
    case "choose_action":
      return handleChooseAction(next, (args as { choiceId: string }).choiceId, now);
    case "apply_update":
      return handleApplyUpdate(next, args as { package: string; fromVersion: number; toVersion: number }, now);
    case "get_status":
      return handleStatus(next, now);
    case "reset_game":
      return handleReset(next, now);
    default:
      return errorResult(next, tool, `Unknown tool '${tool as string}'.`, now);
  }
}

export { TOOL_NAMES };

export function sessionSummary(state: SessionState, now = new Date()): {
  agentUsed: string | null;
  mcpCalls: number;
  invalidCalls: number;
  humanInterventions: number;
  messagesExchanged: number;
  updateResult: string;
  elapsedMs: number;
} {
  const end = state.completedAt ? new Date(state.completedAt).getTime() : now.getTime();
  const start = new Date(state.createdAt).getTime();
  return {
    agentUsed: state.agentLabel,
    mcpCalls: state.stats.mcpCalls,
    invalidCalls: state.stats.invalidCalls,
    humanInterventions: state.stats.humanInterventions,
    messagesExchanged: state.stats.messagesExchanged,
    updateResult: state.complete ? "primeagen 40 → 41" : "not applied",
    elapsedMs: Math.max(0, end - start),
  };
}
