import { describe, expect, it } from "vitest";
import { classifyAgent, classifyContinue, classifyShipDecision } from "../src/game/classify";
import { agentReplies } from "../src/content/index";

describe("agent classification", () => {
  it("matches authored insults case-insensitively", () => {
    expect(classifyAgent("I brought Claude")).toBe("claude");
    expect(classifyAgent("CODEX")).toBe("codex");
    expect(classifyAgent("opencode nightly")).toBe("opencode");
    expect(classifyAgent("Gemini 2.5")).toBe("gemini");
    expect(classifyAgent("Cursor")).toBe("cursor");
    expect(classifyAgent("some local llama")).toBe("other");
    expect(agentReplies.claude).toContain("difficulty");
    expect(agentReplies.other).toContain("prepared insult");
  });
});

describe("ship classification", () => {
  it("selects ship, rollback, postpone, or unclear", () => {
    expect(classifyShipDecision("Ship it")).toBe("ship");
    expect(classifyShipDecision("yes")).toBe("ship");
    expect(classifyShipDecision("send it")).toBe("ship");
    expect(classifyShipDecision("just do it")).toBe("ship");
    expect(classifyShipDecision("rollback")).toBe("rollback");
    expect(classifyShipDecision("roll back")).toBe("rollback");
    expect(classifyShipDecision("revert")).toBe("rollback");
    expect(classifyShipDecision("postpone")).toBe("postpone");
    expect(classifyShipDecision("wait")).toBe("postpone");
    expect(classifyShipDecision("later")).toBe("postpone");
    expect(classifyShipDecision("hmm")).toBe("unclear");
  });
});

describe("continue classification", () => {
  it("accepts confirmation language", () => {
    expect(classifyContinue("yes")).toBe("continue");
    expect(classifyContinue("continue")).toBe("continue");
    expect(classifyContinue("nope")).toBe("unclear");
  });
});
