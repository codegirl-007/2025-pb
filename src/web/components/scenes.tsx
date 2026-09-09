import { apply, diagnose, identify, intro, reveal as revealCopy, ship } from "../../content/index";
import type { PublicSession } from "../../shared/types";

function pendingQuestion(snapshot: PublicSession) {
  switch (snapshot.pendingPromptId) {
    case identify.promptId:
      return identify.question;
    case ship.promptId:
      return ship.question;
    case apply.continuePromptId:
      return apply.continueQuestion;
    default:
      return null;
  }
}

function latestBy(snapshot: PublicSession, speaker: PublicSession["visual"]["dialogue"][number]["speaker"]) {
  return [...snapshot.visual.dialogue].reverse().find((line) => line.speaker === speaker);
}

export function BootSequence({ messages, visibleCount }: { messages: string[]; visibleCount: number }) {
  return (
    <div className="sequence sequence-boot" aria-live="polite">
      <p className="sequence-kicker">omarchy-sim</p>
      <ul>
        {messages.slice(0, visibleCount).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function RebootSequence({ messages, visibleCount }: { messages: string[]; visibleCount: number }) {
  return (
    <div className="sequence sequence-reboot" aria-live="polite">
      <p className="sequence-kicker">rebooting</p>
      <ul>
        {messages.slice(0, visibleCount).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function IdentifyScene({ snapshot }: { snapshot: PublicSession }) {
  const question = pendingQuestion(snapshot);
  return (
    <section className="scene scene-identify" data-target="notice-agent">
      <p className="scene-kicker">incoming note</p>
      <article className="letter-card">
        <p className="letter-body">{intro.stephanie}</p>
        <p className="letter-sign">{intro.attribution}</p>
      </article>
      {question ? <QuestionBoard question={question} /> : <p className="scene-wait">Waiting for the agent to begin.</p>}
    </section>
  );
}

export function DiagnoseScene({ snapshot }: { snapshot: PublicSession }) {
  const latestCmd = [...snapshot.visual.terminalLines].reverse().find((line) => line.kind === "input");
  return (
    <section className="scene scene-diagnose">
      <div className="monument-block" data-target="system-status">
        <p className="scene-kicker">{diagnose.status.package}</p>
        <p className="monument blocked" aria-label="primeagen version 39, migration blocked">
          {diagnose.status.installedVersion}
        </p>
        <p className="monument-status warn">{diagnose.status.status}</p>
        <p className="monument-meta">target {diagnose.status.targetVersion}</p>
      </div>
      {latestCmd ? (
        <p className="console-strip" data-target="terminal">
          {latestCmd.text}
        </p>
      ) : null}
    </section>
  );
}

export function DecisionScene({ snapshot }: { snapshot: PublicSession }) {
  const question = pendingQuestion(snapshot);
  const chosen = snapshot.shipDecision;
  const stephanieLines = new Set(
    snapshot.visual.dialogue.filter((line) => line.speaker === "stephanie").map((line) => line.text),
  );
  const options = [
    { id: "rollback" as const, label: "Roll back", vetoText: ship.rollback },
    { id: "postpone" as const, label: "Postpone", vetoText: ship.postpone },
    { id: "ship" as const, label: "Ship it", vetoText: null },
  ];
  return (
    <section className="scene scene-decision">
      <div className="monument-block">
        <p className="scene-kicker">{diagnose.status.package}</p>
        <p className="monument stalled">{diagnose.status.installedVersion}</p>
        <p className="monument-status">major version waiting</p>
      </div>
      <div className="choice-stack" data-target="system-status">
        {options.map((option) => {
          const vetoed = option.vetoText ? stephanieLines.has(option.vetoText) : false;
          const shipped = chosen === "ship" && option.id === "ship";
          return (
            <p key={option.id} className={`choice-row ${shipped ? "chosen" : ""} ${vetoed ? "vetoed" : ""}`}>
              {option.label}
            </p>
          );
        })}
      </div>
      {question ? <QuestionBoard question={question} /> : null}
    </section>
  );
}

export function InstallScene({
  snapshot,
  progress,
  label,
  promptReady,
}: {
  snapshot: PublicSession;
  progress: number;
  label: string;
  promptReady: boolean;
}) {
  const frozen = snapshot.stage === "confirm_update" && progress >= 99;
  const question =
    frozen && promptReady
      ? apply.continueQuestion
      : snapshot.stage === "confirm_update"
        ? null
        : pendingQuestion(snapshot);
  return (
    <section className="scene scene-install" data-target="update-manager">
      <p className="scene-kicker">update manager</p>
      <p className="install-title">
        <span>{apply.required.fromVersion}</span>
        <span className="install-arrow">→</span>
        <span className={progress >= 100 ? "lit" : ""}>{apply.required.toVersion}</span>
      </p>
      <div className={`progress install-progress ${frozen ? "frozen" : ""}`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="install-pct">{progress}%</p>
      <p className="install-label">{label}</p>
      {snapshot.visual.update.warning && frozen ? <p className="warn install-warn">{snapshot.visual.update.warning}</p> : null}
      <ol className="install-steps">
        {apply.steps.map((step) => (
          <li key={step.label} className={progress >= step.progress ? "done" : ""}>
            {step.label}
          </li>
        ))}
      </ol>
      {question ? <QuestionBoard question={question} /> : null}
    </section>
  );
}

export function RevealScene({ snapshot }: { snapshot: PublicSession }) {
  const end = snapshot.completedAt ? Date.parse(snapshot.completedAt) : Date.now();
  const elapsed = Math.max(0, end - Date.parse(snapshot.createdAt));
  return (
    <section className="scene scene-reveal" data-target="reveal">
      <p className="scene-kicker">primeagen {apply.required.toVersion}.0</p>
      <p className="monument reveal-num" aria-label={`primeagen version ${apply.required.toVersion}`}>
        {apply.required.toVersion}
      </p>
      <p className="reveal-banner">{revealCopy.banner.split("\n").slice(1).join(" · ")}</p>
      <article className="letter-card letter-final">
        <p className="letter-body">{revealCopy.letter}</p>
      </article>
      <p className="reveal-stats">
        {snapshot.agentLabel ?? "unknown agent"} · {snapshot.stats.mcpCalls} mcp calls · {Math.round(elapsed / 1000)}s
      </p>
      <p className="reveal-footer">{revealCopy.footer}</p>
    </section>
  );
}

export function QuestionBoard({ question }: { question: string }) {
  const headline = question.split("\n")[0] ?? question;
  return (
    <div className="question-board" data-target="dialogue-dock" aria-live="polite">
      <p className="scene-kicker">ask Prime</p>
      <p className="question-text">{headline}</p>
    </div>
  );
}

export function DialogueRibbon({ snapshot }: { snapshot: PublicSession }) {
  const prime = latestBy(snapshot, "prime");
  if (!prime) return null;
  return (
    <div className="dialogue-ribbon">
      <p className="line prime">
        <span className="who">prime</span>
        {prime.text}
      </p>
    </div>
  );
}
