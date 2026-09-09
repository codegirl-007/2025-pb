import { useEffect, useState } from "react";
import { connectionLabels } from "../../content/index";
import type { PublicSession, WindowState } from "../../shared/types";

export function ConnectionLabel({ state }: { state: string }) {
  return <span className={`status-pill ${state}`}>{connectionLabels[state] ?? state}</span>;
}

export function TopBar({ snapshot, clock }: { snapshot: PublicSession | null; clock: string }) {
  const state = snapshot?.connectionState ?? "waiting_for_agent";
  return (
    <header className="topbar">
      <div className="workspaces">
        <span className="active">1</span>
        <span>2</span>
        <span>3</span>
        <span>birthday</span>
      </div>
      <div className="top-status">
        <span>{snapshot?.sessionCode ?? "NO-SESSION"}</span>
        <span>mcp {snapshot?.connectionState === "waiting_for_agent" ? "idle" : "up"}</span>
        <span>{clock}</span>
        <ConnectionLabel state={state} />
      </div>
    </header>
  );
}

export function WindowFrame({ win, children }: { win: WindowState; children: React.ReactNode }) {
  return (
    <section className={`window ${win.focused ? "focused" : ""}`} data-target={win.id}>
      <div className="window-title">
        <div className="dots">
          <span />
          <span />
          <span />
        </div>
        {win.title}
      </div>
      <div className={`window-body ${win.app === "terminal" ? "terminal" : ""}`}>{children}</div>
    </section>
  );
}

export function TerminalView({
  lines,
  reducedMotion,
}: {
  lines: PublicSession["visual"]["terminalLines"];
  reducedMotion: boolean;
}) {
  return (
    <div>
      {lines.map((line) => (
        <div key={line.id} className={`term-line ${line.kind}`}>
          {reducedMotion ? line.text : <TypedText text={line.text} />}
        </div>
      ))}
    </div>
  );
}

function TypedText({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.ceil(text.length / 48));
      setCount(Math.min(text.length, i));
      if (i >= text.length) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [text]);
  return <>{text.slice(0, count)}</>;
}
