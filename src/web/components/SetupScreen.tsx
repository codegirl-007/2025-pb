import { landing } from "../../content/index";
import type { CreateSessionResponse } from "../../shared/types";

export function SetupScreen({
  created,
  onCreate,
  busy,
  error,
}: {
  created: CreateSessionResponse | null;
  connectionState: string;
  onCreate: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="setup">
        <h1>{landing.headline}</h1>
        <p className="setup-lead">{landing.subhead}</p>
        {!created ? (
          <button className="primary" onClick={onCreate} disabled={busy}>
            {busy ? "Creating…" : landing.createSession}
          </button>
        ) : (
          <CreatedDetails created={created} />
        )}
        {error ? <p className="warn">{error}</p> : null}
    </div>
  );
}

function CreatedDetails({ created }: { created: CreateSessionResponse }) {
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };
  const config = JSON.stringify(created.mcpConfig, null, 2);
  return (
    <ol className="setup-steps">
      <li>
        <p>Session is live. Keep this tab open. Would help to have your terminal and browser side by side.</p>
              </li>
      <li>
        <p>Set up the MCP server. Alternatively, you can ask your agent to do it. May new to restart the agent after setup.</p>
        <pre className="codebox">{config}</pre>
        <div className="row">
          <button className="primary" onClick={() => void copy(config)}>
            Copy MCP config
          </button>
          <button onClick={() => void copy(created.mcpUrl)}>Copy URL only</button>
        </div>
      </li>
      <li>
        <p>{landing.finalInstruction}</p>
        <div className="row">
          <button onClick={() => void copy(created.prompt)}>Copy prompt</button>
        </div>
      </li>
    </ol>
  );
}
