import { landing } from "../../content/index";
import type { CreateSessionResponse } from "../../shared/types";
import { ConnectionLabel } from "./chrome";

export function SetupScreen({
  created,
  connectionState,
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
    <main className="setup">
      <div className="setup-card">
        <h1>{landing.headline}</h1>
        <p>{landing.subhead}</p>
        <p>
          <ConnectionLabel state={connectionState} />
        </p>
        {!created ? (
          <button className="primary" onClick={onCreate} disabled={busy}>
            {busy ? "Creating…" : landing.createSession}
          </button>
        ) : (
          <CreatedDetails created={created} />
        )}
        {error ? <p className="warn">{error}</p> : null}
      </div>
    </main>
  );
}

function CreatedDetails({ created }: { created: CreateSessionResponse }) {
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };
  const config = JSON.stringify(created.mcpConfig, null, 2);
  return (
    <div>
      <p>
        Session code: <strong>{created.sessionCode}</strong>
      </p>
      <p>Session-specific MCP URL</p>
      <pre className="codebox">{created.mcpUrl}</pre>
      <div className="row">
        <button onClick={() => void copy(created.mcpUrl)}>Copy MCP URL</button>
        <button onClick={() => void copy(config)}>Copy MCP config</button>
        <button onClick={() => void copy(created.prompt)}>Copy prompt</button>
      </div>
      <p>Generic JSON configuration example</p>
      <pre className="codebox">{config}</pre>
      <p>{landing.finalInstruction}</p>
      <p>{created.inspectorHint}</p>
    </div>
  );
}
