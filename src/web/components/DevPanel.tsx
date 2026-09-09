import { useState } from "react";
import { TOOL_NAMES } from "../../shared/types";
import type { PublicSession, SessionEvent, ToolName } from "../../shared/types";
import { callDevTool } from "../api";

const defaults: Record<string, unknown> = {
  start_game: {},
  inspect_screen: {},
  get_status: {},
  open_app: { app: "system_status" },
  read_file: { path: "/var/log/birthday-migration.log" },
  run_command: { command: "birthdayctl doctor" },
  ask_prime: { promptId: "which-agent" },
  reply_to_stephanie: { promptId: "which-agent", message: "cursor" },
  choose_action: { choiceId: "open-system-status" },
  apply_update: { package: "primeagen", fromVersion: 40, toVersion: 41 },
  reset_game: { confirm: true },
};

export function DevPanel({
  sessionId,
  snapshot,
  events,
}: {
  sessionId: string;
  snapshot: PublicSession | null;
  events: SessionEvent[];
}) {
  const [tool, setTool] = useState<ToolName>("start_game");
  const [args, setArgs] = useState(JSON.stringify(defaults.start_game, null, 2));
  const [out, setOut] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <aside className="dev-panel">
      <strong>dev panel</strong>
      <p>Uses the same server tool handlers as MCP.</p>
      <div className="row">
        <select
          value={tool}
          onChange={(ev) => {
            const next = ev.target.value as ToolName;
            setTool(next);
            setArgs(JSON.stringify(defaults[next] ?? {}, null, 2));
          }}
        >
          {TOOL_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            void (async () => {
              try {
                setError(null);
                const parsed = JSON.parse(args) as unknown;
                const result = await callDevTool(sessionId, tool, parsed);
                setOut(JSON.stringify(result.mcp, null, 2));
              } catch (err) {
                setError(err instanceof Error ? err.message : "failed");
              }
            })();
          }}
        >
          Run tool
        </button>
        <button
          onClick={() => {
            void callDevTool(sessionId, "reset_game", { confirm: true });
          }}
        >
          Jump to beginning
        </button>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(JSON.stringify(events, null, 2));
          }}
        >
          Copy event log
        </button>
      </div>
      <textarea value={args} onChange={(ev) => setArgs(ev.target.value)} />
      {error ? <p className="warn">{error}</p> : null}
      <pre className="codebox">{out || JSON.stringify(snapshot, null, 2)}</pre>
    </aside>
  );
}
