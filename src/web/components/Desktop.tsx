import { useEffect, useRef } from "react";
import { diagnose, identify, intro, reveal as revealCopy } from "../../content/index";
import type { PublicSession, WindowState } from "../../shared/types";
import { TerminalView, WindowFrame } from "./chrome";

function summaryFrom(snapshot: PublicSession) {
  const end = snapshot.completedAt ? Date.parse(snapshot.completedAt) : Date.now();
  const start = Date.parse(snapshot.createdAt);
  return {
    agentUsed: snapshot.agentLabel,
    mcpCalls: snapshot.stats.mcpCalls,
    invalidCalls: snapshot.stats.invalidCalls,
    humanInterventions: snapshot.stats.humanInterventions,
    messagesExchanged: snapshot.stats.messagesExchanged,
    updateResult: snapshot.complete ? "primeagen 40 → 41" : "not applied",
    elapsedMs: Math.max(0, end - start),
  };
}

function windowBody(win: WindowState, snapshot: PublicSession, reducedMotion: boolean) {
  if (win.app === "terminal") {
    return <TerminalView lines={snapshot.visual.terminalLines} reducedMotion={reducedMotion} />;
  }
  if (win.app === "system_status") {
    return <pre>{diagnose.statusText}</pre>;
  }
  if (win.app === "files") {
    return (
      <pre>
        {["/home/prime", "  README.md", "  totally-not-the-answer.txt", "/var/log", "  birthday-migration.log"].join("\n")}
      </pre>
    );
  }
  if (win.app === "editor") {
    const preview = snapshot.visual.filePreview;
    return <pre>{preview ? `${preview.path}\n\n${preview.content}` : "No file selected."}</pre>;
  }
  if (win.app === "update_manager") {
    const update = snapshot.visual.update;
    return (
      <div>
        <div>primeagen {update.progress}%</div>
        <div className="progress" style={{ margin: "10px 0" }}>
          <span style={{ width: `${update.progress}%` }} />
        </div>
        <div>{update.stepLabel}</div>
        {update.warning ? <p className="warn">{update.warning}</p> : null}
      </div>
    );
  }
  if (win.app === "notice") {
    return <pre>{identify.screen}</pre>;
  }
  if (win.app === "reveal") {
    const summary = summaryFrom(snapshot);
    return (
      <div className="reveal">
        <pre className="reveal-banner">{revealCopy.banner}</pre>
        <pre>{revealCopy.letter}</pre>
        <pre>
          {[
            `Agent used: ${summary.agentUsed ?? "unknown"}`,
            `MCP calls made: ${summary.mcpCalls}`,
            `Invalid calls: ${summary.invalidCalls}`,
            `Human interventions: ${summary.humanInterventions}`,
            `Messages exchanged: ${summary.messagesExchanged}`,
            `Update result: ${summary.updateResult}`,
            `Total elapsed time: ${Math.round(summary.elapsedMs / 1000)}s`,
            "",
            revealCopy.footer,
          ].join("\n")}
        </pre>
      </div>
    );
  }
  return null;
}

export function Desktop({ snapshot, reducedMotion }: { snapshot: PublicSession; reducedMotion: boolean }) {
  const openWindows = snapshot.visual.windows.filter((win) => win.open);
  return (
    <main className="desktop">
      <div className="tile-area">
        {openWindows.map((win) => (
          <WindowFrame key={win.id} win={win}>
            {windowBody(win, snapshot, reducedMotion)}
          </WindowFrame>
        ))}
        {openWindows.length === 0 ? (
          <section className="window focused">
            <div className="window-title">desktop</div>
            <div className="window-body">{snapshot.visual.bootMessages.join("\n") || intro.agentConnected}</div>
          </section>
        ) : null}
      </div>
      <aside className="activity">
        <h2>Agent activity</h2>
        {snapshot.visual.activity.map((item) => (
          <div key={item.id} className={`activity-item ${item.ok ? "" : "bad"}`}>
            <div>{item.tool}</div>
            <div>{item.summary}</div>
            <div className="meta">{item.at}</div>
          </div>
        ))}
      </aside>
      <section className="dialogue-dock" data-target="dialogue-dock">
        <h2>Dialogue</h2>
        {snapshot.visual.dialogue.map((line) => (
          <p key={line.id} className={`line ${line.speaker}`}>
            <span className="who">{line.speaker}</span>
            {line.text}
          </p>
        ))}
      </section>
      <Toasts items={snapshot.visual.notifications} />
      <Cursor target={snapshot.visual.cursorTarget} reducedMotion={reducedMotion} />
    </main>
  );
}

function Toasts({ items }: { items: PublicSession["visual"]["notifications"] }) {
  return (
    <div className="toasts">
      {items.slice(0, 3).map((item) => (
        <div key={item.id} className="toast">
          <strong>{item.title}</strong>
          <div>{item.body}</div>
        </div>
      ))}
    </div>
  );
}

function Cursor({ target, reducedMotion }: { target: string | null; reducedMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!target || !ref.current) return;
    const el = document.querySelector(`[data-target="${CSS.escape(target)}"]`);
    if (!(el instanceof HTMLElement)) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + Math.min(24, rect.width / 5);
    const y = rect.top + 10;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  }, [target]);
  if (reducedMotion) return null;
  return <div ref={ref} className="sim-cursor" />;
}
