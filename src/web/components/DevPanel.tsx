import { useState } from "react";
import { TOOL_NAMES } from "../../shared/types";
import type { PublicSession, SessionEvent, ToolName } from "../../shared/types";
import { callDevTool } from "../api";
import { PREVIEW_SCENES, type PreviewSceneId } from "../previewScenes";

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
  apply_update: { package: "primeagen", fromVersion: 39, toVersion: 40 },
  reset_game: { confirm: true },
};

export function DevPanel({
  sessionId,
  snapshot,
  events,
  preview,
  onPreview,
}: {
  sessionId: string | null;
  snapshot: PublicSession | null;
  events: SessionEvent[];
  preview: PreviewSceneId | null;
  onPreview: (id: PreviewSceneId | null) => void;
}) {
  const [tool, setTool] = useState<ToolName>("start_game");
  const [args, setArgs] = useState(JSON.stringify(defaults.start_game, null, 2));
  const [out, setOut] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <aside className="dev-panel">
      <strong>dev panel</strong>
      <p>Scene jumper is local preview only. It does not change the live game.</p>
      <div className="dev-scenes">
        <button className={!preview ? "active" : ""} onClick={() => onPreview(null)}>
          Live
        </button>
        {PREVIEW_SCENES.map((scene) => (
          <button
            key={scene.id}
            className={preview === scene.id ? "active" : ""}
            onClick={() => onPreview(scene.id)}
          >
            {scene.label}
          </button>
        ))}
      </div>
      {sessionId ? (
        <>
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
        </>
      ) : (
        <p>Create a session to run live tools.</p>
      )}
      {error ? <p className="warn">{error}</p> : null}
      <pre className="codebox">{out || JSON.stringify(snapshot, null, 2)}</pre>
    </aside>
  );
}
