import { useEffect, useMemo, useState } from "react";
import { landing } from "../content/index";
import type { CreateSessionResponse } from "../shared/types";
import { createSession, destroySession, resetSession } from "./api";
import { Desktop } from "./components/Desktop";
import { DevPanel } from "./components/DevPanel";
import { SetupScreen } from "./components/SetupScreen";
import { ArchWallpaper, OsWindow, TopBar } from "./components/chrome";
import { previewCreated, previewSnapshot, type PreviewSceneId } from "./previewScenes";
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

function toCreated(stored: StoredSession): CreateSessionResponse {
  const mcpUrl = stored.mcpUrl ?? `${window.location.origin}/mcp`;
  return {
    sessionId: stored.sessionId,
    sessionCode: stored.sessionCode,
    mcpUrl,
    mcpConfig: stored.mcpConfig ?? {
      mcpServers: { "birthday-mcp": { url: mcpUrl } },
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
  const [preview, setPreview] = useState<{ id: PreviewSceneId; stamp: number } | null>(null);
  const devMode = useMemo(() => new URLSearchParams(location.search).get("dev") === "1" && import.meta.env.DEV, []);

  const sessionId = stored?.sessionId ?? null;
  const { snapshot, events, connected } = useSessionSync(sessionId, () => {
    clearStoredSession();
    setStored(null);
    setCreated(null);
    setError("That session is gone. The server likely restarted — create a new session.");
  });

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lastNotificationId = snapshot?.visual.notifications[0]?.id;
  useEffect(() => {
    if (lastNotificationId) playTone(sound, "notify");
  }, [lastNotificationId, sound]);

  const connectionState = snapshot?.connectionState ?? "waiting_for_agent";
  const previewView = preview ? previewSnapshot(preview.id, preview.stamp) : null;
  const view = previewView ?? snapshot;
  const showDesktop = preview
    ? preview.id !== "setup"
    : Boolean(snapshot && snapshot.stage !== "waiting");
  const setupCreated = created ?? (preview?.id === "setup" ? previewCreated() : null);

  return (
    <div className="app" data-contrast={highContrast ? "high" : "normal"}>
      <TopBar snapshot={view} clock={clock} />
      {showDesktop && view ? (
        <Desktop snapshot={view} reducedMotion={reducedMotion} previewScene={preview?.id} />
      ) : (
        <main className="os-desktop">
          <ArchWallpaper />
          <OsWindow title="terminal">
            <SetupScreen
              created={setupCreated}
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
                    setPreview(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not create session.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </OsWindow>
        </main>
      )}
      <details className="controls">
        <summary>
          session options{sessionId ? ` · ws ${connected ? "live" : "reconnecting"}` : ""}
        </summary>
        <div className="row">
          <button onClick={() => location.reload()}>Reconnect</button>
          <button
            onClick={() => {
              if (!sessionId) return;
              void resetSession(sessionId).then(() => {
                /* snapshot arrives over websocket */
              });
            }}
          >
            Reset Game
          </button>
          <button onClick={() => setSound((v) => !v)}>{sound ? "Sound on" : "Sound off"}</button>
          <button onClick={() => setForceReduced((v) => !v)}>{reducedMotion ? "Motion off" : "Motion on"}</button>
          <button onClick={() => setHighContrast((v) => !v)}>{highContrast ? "Contrast high" : "Contrast"}</button>
          <button
            onClick={() => {
              const finish = () => {
                clearStoredSession();
                setStored(null);
                setCreated(null);
              };
              if (!sessionId) {
                finish();
                return;
              }
              void destroySession(sessionId).finally(finish);
            }}
          >
            Disconnect
          </button>
        </div>
      </details>
      {devMode ? (
        <DevPanel
          sessionId={sessionId}
          snapshot={view}
          events={events}
          preview={preview?.id ?? null}
          onPreview={(id) => setPreview(id ? { id, stamp: Date.now() } : null)}
        />
      ) : null}
    </div>
  );
}
