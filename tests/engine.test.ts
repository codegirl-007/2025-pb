import { describe, expect, it } from "vitest";
import { createInitialState, handleTool } from "../src/game/engine";
import { agentReplies, apply, intro, ship } from "../src/content/index";

function session() {
  return createInitialState(new Date("2026-09-09T00:00:00Z"), {
    sessionId: "sess-1",
    sessionCode: "PRIME-TEST",
    secretToken: "secret-token",
  });
}

describe("start_game", () => {
  it("is idempotent and does not replay the intro", () => {
    const first = handleTool(session(), "start_game", {});
    expect(first.ok).toBe(true);
    expect(first.state.stage).toBe("identify_agent");
    expect(first.state.connectionState).toBe("agent_connected");
    expect(first.mcp.role).toContain("control the website");
    const dialogueCount = first.state.visual.dialogue.length;
    const second = handleTool(first.state, "start_game", {});
    expect(second.ok).toBe(true);
    expect(second.mcp.resumed).toBe(true);
    expect(second.state.visual.dialogue).toHaveLength(dialogueCount);
    expect(second.state.visual.dialogue.some((line) => line.text.includes(intro.stephanie.split("\n")[0]!))).toBe(true);
  });
});

describe("state progression", () => {
  it("rejects out-of-order calls", () => {
    const waiting = session();
    expect(handleTool(waiting, "open_app", { app: "terminal" }).ok).toBe(false);
    expect(handleTool(waiting, "apply_update", { package: "primeagen", fromVersion: 39, toVersion: 40 }).ok).toBe(false);
    const started = handleTool(waiting, "start_game", {}).state;
    expect(handleTool(started, "read_file", { path: "/var/log/birthday-migration.log" }).ok).toBe(false);
    expect(handleTool(started, "run_command", { command: "birthdayctl status" }).ok).toBe(false);
    expect(handleTool(started, "ask_prime", { promptId: "ship-update" }).ok).toBe(false);
  });

  it("plays the authored path including rollback and postpone loops", () => {
    let state = handleTool(session(), "start_game", {}).state;
    state = handleTool(state, "ask_prime", { promptId: "which-agent" }).state;
    const identified = handleTool(state, "reply_to_stephanie", { promptId: "which-agent", message: "I brought Claude" });
    expect(identified.mcp.stephanie).toBe(agentReplies.claude);
    state = identified.state;
    expect(state.stage).toBe("diagnose");
    expect(state.agentLabel).toBe("I brought Claude");

    state = handleTool(state, "open_app", { app: "system_status" }).state;
    state = handleTool(state, "read_file", { path: "/var/log/birthday-migration.log" }).state;
    expect(state.stage).toBe("human_decision");

    state = handleTool(state, "ask_prime", { promptId: "ship-update" }).state;
    const rollback = handleTool(state, "reply_to_stephanie", { promptId: "ship-update", message: "roll back" });
    expect(rollback.ok).toBe(true);
    expect(rollback.mcp.stephanie).toBe(ship.rollback);
    expect(rollback.state.stage).toBe("human_decision");

    const postpone = handleTool(rollback.state, "reply_to_stephanie", { promptId: "ship-update", message: "postpone until later" });
    expect(postpone.mcp.stephanie).toBe(ship.postpone);
    expect(postpone.state.stage).toBe("human_decision");

    const unclear = handleTool(postpone.state, "reply_to_stephanie", { promptId: "ship-update", message: "maybe" });
    expect(unclear.mcp.classifiedAs).toBe("unclear");

    const shipped = handleTool(unclear.state, "reply_to_stephanie", { promptId: "ship-update", message: "ship it" });
    expect(shipped.mcp.stephanie).toBe(ship.ship);
    expect(shipped.state.stage).toBe("apply_update");

    const badPkg = handleTool(shipped.state, "apply_update", { package: "vim", fromVersion: 39, toVersion: 40 });
    expect(badPkg.ok).toBe(false);
    const badFrom = handleTool(shipped.state, "apply_update", { package: "primeagen", fromVersion: 40, toVersion: 40 });
    expect(badFrom.ok).toBe(false);
    const badTo = handleTool(shipped.state, "apply_update", { package: "primeagen", fromVersion: 39, toVersion: 41 });
    expect(badTo.ok).toBe(false);
    expect(badTo.state.stage).toBe("apply_update");

    const applied = handleTool(shipped.state, "apply_update", {
      package: apply.required.package,
      fromVersion: 39,
      toVersion: 40,
    });
    expect(applied.ok).toBe(true);
    expect(applied.state.stage).toBe("confirm_update");
    expect(applied.state.visual.update.progress).toBe(99);
    expect(applied.mcp.instruction).toContain("Ask the human whether to continue");

    const replay = handleTool(applied.state, "apply_update", { package: "primeagen", fromVersion: 39, toVersion: 40 });
    expect(replay.ok).toBe(false);

    state = handleTool(applied.state, "ask_prime", { promptId: "continue-update" }).state;
    const done = handleTool(state, "reply_to_stephanie", { promptId: "continue-update", message: "yes" });
    expect(done.ok).toBe(true);
    expect(done.state.complete).toBe(true);
    expect(done.mcp.status).toBe("complete");
    expect(JSON.stringify(done.mcp)).not.toContain("Happy 40th birthday");
    expect(done.mcp.instruction).toContain("Ask Prime to read the website");
  });

  it("resets only this session", () => {
    const started = handleTool(session(), "start_game", {}).state;
    const reset = handleTool(started, "reset_game", { confirm: true });
    expect(reset.ok).toBe(true);
    expect(reset.state.stage).toBe("waiting");
    expect(reset.state.sessionId).toBe(started.sessionId);
    expect(reset.state.secretToken).toBe(started.secretToken);
    expect(reset.state.generation).toBe(started.generation + 1);
    expect(reset.state.sessionCode).toBe(started.sessionCode);
    expect(reset.state.completedActions).toEqual([]);
    expect(reset.state.agentLabel).toBeNull();
    expect(handleTool(started, "reset_game", { confirm: false }).ok).toBe(false);
  });
});
