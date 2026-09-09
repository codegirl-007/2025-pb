import { createInitialState, handleTool, toPublicSession } from "../game/engine";
import type { EngineResult, PublicSession, SessionEvent, SessionState, ToolName } from "../shared/types";

type Listener = (event: SessionEvent, snapshot: PublicSession) => void;

const STALE_RESET_ERROR = "Session was reset. Continue from the current objective.";

export class SessionStore {
  private sessions = new Map<string, SessionState>();
  private byCode = new Map<string, string>();
  private byToken = new Map<string, string>();
  private listeners = new Map<string, Set<Listener>>();
  private liveId: string | undefined;

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(): SessionState {
    const state = createInitialState(this.now());
    this.sessions.set(state.sessionId, state);
    this.byCode.set(state.sessionCode, state.sessionId);
    this.byToken.set(state.secretToken, state.sessionId);
    this.liveId = state.sessionId;
    return state;
  }

  claim(sessionId: string): SessionState | undefined {
    const state = this.getById(sessionId);
    if (!state) return undefined;
    this.liveId = sessionId;
    return state;
  }

  getLive(): SessionState | undefined {
    return this.liveId ? this.getById(this.liveId) : undefined;
  }

  getById(id: string): SessionState | undefined {
    const state = this.sessions.get(id);
    if (!state || this.isExpired(state)) {
      if (state) this.delete(state);
      return undefined;
    }
    return state;
  }

  getByCode(code: string): SessionState | undefined {
    const id = this.byCode.get(code);
    return id ? this.getById(id) : undefined;
  }

  getByToken(token: string): SessionState | undefined {
    const id = this.byToken.get(token);
    return id ? this.getById(id) : undefined;
  }

  dispatchByToken(token: string, tool: ToolName, args: unknown): EngineResult | { ok: false; error: string } {
    const state = this.getByToken(token);
    if (!state) return { ok: false, error: "Unknown session token." };
    return this.apply(state, tool, args);
  }

  dispatchById(sessionId: string, tool: ToolName, args: unknown): EngineResult | { ok: false; error: string } {
    const state = this.getById(sessionId);
    if (!state) return { ok: false, error: "Unknown session." };
    return this.apply(state, tool, args);
  }

  dispatchLive(tool: ToolName, args: unknown): EngineResult | { ok: false; error: string } {
    const state = this.getLive();
    if (!state) return { ok: false, error: "No live session. Create one on the website." };
    return this.apply(state, tool, args);
  }

  resetGame(sessionId: string): EngineResult | { ok: false; error: string } {
    return this.dispatchById(sessionId, "reset_game", { confirm: true });
  }

  destroy(sessionId: string): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return false;
    const snapshot = toPublicSession(state);
    const event: SessionEvent = {
      eventId: `${sessionId}:destroyed`,
      sessionId,
      stateVersion: state.stateVersion,
      type: "destroyed",
      payload: {},
      timestamp: this.now().toISOString(),
    };
    this.emit(sessionId, event, snapshot);
    this.delete(state);
    return true;
  }

  commitIfCurrent(sessionId: string, generation: number, result: EngineResult): EngineResult | { ok: false; error: string } {
    const current = this.sessions.get(sessionId);
    if (!current || this.isExpired(current)) {
      if (current) this.delete(current);
      return { ok: false, error: "Unknown session." };
    }
    if (current.generation !== generation) {
      return { ok: false, error: STALE_RESET_ERROR };
    }
    return this.write(result);
  }

  subscribe(sessionId: string, listener: Listener): () => void {
    const set = this.listeners.get(sessionId) ?? new Set();
    set.add(listener);
    this.listeners.set(sessionId, set);
    return () => {
      set.delete(listener);
    };
  }

  snapshot(sessionId: string): PublicSession | undefined {
    const state = this.getById(sessionId);
    return state ? toPublicSession(state) : undefined;
  }

  sweep(): number {
    let removed = 0;
    for (const state of this.sessions.values()) {
      if (this.isExpired(state)) {
        this.delete(state);
        removed += 1;
      }
    }
    return removed;
  }

  private apply(state: SessionState, tool: ToolName, args: unknown): EngineResult | { ok: false; error: string } {
    const generation = state.generation;
    const result = handleTool(state, tool, args, this.now());
    return this.commitIfCurrent(state.sessionId, generation, result);
  }

  private write(result: EngineResult): EngineResult {
    const previous = this.sessions.get(result.state.sessionId);
    if (previous && previous.secretToken !== result.state.secretToken) {
      this.byToken.delete(previous.secretToken);
      this.byToken.set(result.state.secretToken, result.state.sessionId);
    }
    this.sessions.set(result.state.sessionId, result.state);
    this.byCode.set(result.state.sessionCode, result.state.sessionId);
    const publicState = toPublicSession(result.state);
    for (const event of result.events) {
      this.emit(result.state.sessionId, event, publicState);
    }
    return result;
  }

  private emit(sessionId: string, event: SessionEvent, snapshot: PublicSession) {
    const set = this.listeners.get(sessionId);
    if (!set) return;
    for (const listener of set) listener(event, snapshot);
  }

  private isExpired(state: SessionState): boolean {
    return this.now().getTime() - new Date(state.lastActivityAt).getTime() > this.ttlMs;
  }

  private delete(state: SessionState) {
    this.sessions.delete(state.sessionId);
    this.byCode.delete(state.sessionCode);
    this.byToken.delete(state.secretToken);
    this.listeners.delete(state.sessionId);
    if (this.liveId === state.sessionId) this.liveId = undefined;
  }
}
