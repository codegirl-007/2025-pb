import { useEffect, useMemo, useState } from "react";
import { landing } from "../content/index";
import type { CreateSessionResponse } from "../shared/types";
import { createSession, resetSession } from "./api";
import { Desktop } from "./components/Desktop";
import { DevPanel } from "./components/DevPanel";
import { SetupScreen } from "./components/SetupScreen";
import { TopBar } from "./components/chrome";
import { clearStoredSession, loadStoredSession, storeCreatedSession, type StoredSession } from "./sessionStore";
import { playTone } from "./sound";
import { useSessionSync } from "./useSessionSync";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function toCreated(stored: StoredSession): CreateSessionResponse | null {
  if (!stored.mcpUrl) return null;
  return {
    sessionId: stored.sessionId,
    sessionCode: stored.sessionCode,
    mcpUrl: stored.mcpUrl,
    mcpConfig: stored.mcpConfig ?? {
      mcpServers: { "birthday-mcp": { url: stored.mcpUrl, transport: "http" } },
    },
    prompt: stored.prompt ?? landing.prompt,
    inspectorHint: stored.inspectorHint ?? "",
  };
}

export function App() {
  const [stored, setStored] = useState<StoredSession | null>(() => loadStoredSession());
  const [created, setCreated] = useState<CreateSessionResponse | null>(() => {
    const existing = loadStoredSession();
    return existing ? toCreated(existing) : null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const reducedMotionPref = useReducedMotion();
  const [forceReduced, setForceReduced] = useState(false);
  const reducedMotion = reducedMotionPref || forceReduced;
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());
  const devMode = useMemo(() => new URLSearchParams(location.search).get("dev") === "1" && import.meta.env.DEV, []);

  const sessionId = stored?.sessionId ?? null;
  const { snapshot, events, connected } = useSessionSync(sessionId);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lastNotificationId = snapshot?.visual.notifications[0]?.id;
  useEffect(() => {
    if (lastNotificationId) playTone(sound, "notify");
  }, [lastNotificationId, sound]);

  const connectionState = snapshot?.connectionState ?? "waiting_for_agent";
  const showDesktop = snapshot && snapshot.stage !== "waiting";

  return (
    <div className="app" data-contrast={highContrast ? "high" : "normal"}>
      <TopBar snapshot={snapshot} clock={clock} />
      {showDesktop ? (
        <Desktop snapshot={snapshot} reducedMotion={reducedMotion} />
      ) : (
        <SetupScreen
          created={created}
          connectionState={connectionState}
          busy={busy}
          error={error}
          onCreate={() => {
            void (async () => {
              try {
                setBusy(true);
                setError(null);
                const next = await createSession();
                storeCreatedSession(next);
                setCreated(next);
                setStored({
                  sessionId: next.sessionId,
                  sessionCode: next.sessionCode,
                  mcpUrl: next.mcpUrl,
                  prompt: next.prompt,
                  inspectorHint: next.inspectorHint,
                });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create session.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
      <div className="controls">
        <span>ws {connected ? "live" : "reconnecting"}</span>
        <button onClick={() => location.reload()}>Reconnect</button>
        <button
          onClick={() => {
            if (!sessionId) return;
            void resetSession(sessionId).then(() => {
              /* snapshot arrives over websocket */
            });
          }}
        >
          Reset
        </button>
        <button onClick={() => setSound((v) => !v)}>{sound ? "Sound on" : "Sound off"}</button>
        <button onClick={() => setForceReduced((v) => !v)}>{reducedMotion ? "Motion off" : "Motion on"}</button>
        <button onClick={() => setHighContrast((v) => !v)}>{highContrast ? "Contrast high" : "Contrast"}</button>
        <button
          onClick={() => {
            clearStoredSession();
            setStored(null);
            setCreated(null);
          }}
        >
          New browser session
        </button>
      </div>
      {devMode && sessionId ? <DevPanel sessionId={sessionId} snapshot={snapshot} events={events} /> : null}
    </div>
  );
}
