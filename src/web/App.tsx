import { useEffect, useMemo, useState } from "react";
import { landing } from "../content/index";
import type { CreateSessionResponse } from "../shared/types";
import { createSession } from "./api";
import { Desktop } from "./components/Desktop";
import { DevPanel } from "./components/DevPanel";
import { SetupScreen } from "./components/SetupScreen";
import { ArchWallpaper, OsWindow, TopBar } from "./components/chrome";
import { previewCreated, previewSnapshot, type PreviewSceneId } from "./previewScenes";
import { clearStoredSession, loadStoredSession, storeCreatedSession, type StoredSession } from "./sessionStore";
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
      mcpServers: { "birthday-mcp": { url: mcpUrl, transport: "http" } },
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
  const reducedMotionPref = useReducedMotion();
  const reducedMotion = reducedMotionPref;
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());
  const [preview, setPreview] = useState<{ id: PreviewSceneId; stamp: number } | null>(null);
  const devMode = useMemo(() => new URLSearchParams(location.search).get("dev") === "1" && import.meta.env.DEV, []);

  const sessionId = stored?.sessionId ?? null;
  const { snapshot, events } = useSessionSync(sessionId, () => {
    clearStoredSession();
    setStored(null);
    setCreated(null);
    setError("That session is gone. The server likely restarted — create a new session.");
  });

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const connectionState = snapshot?.connectionState ?? "waiting_for_agent";
  const previewView = preview ? previewSnapshot(preview.id, preview.stamp) : null;
  const view = previewView ?? snapshot;
  const showDesktop = preview
    ? preview.id !== "setup"
    : Boolean(snapshot && snapshot.stage !== "waiting");
  const setupCreated = created ?? (preview?.id === "setup" ? previewCreated() : null);

  return (
    <div className="app" data-contrast="normal">
      <TopBar snapshot={view} clock={clock} />
      {showDesktop && view ? (
        <Desktop snapshot={view} reducedMotion={reducedMotion} previewScene={preview?.id} />
      ) : (
        <main className="os-desktop">
          <ArchWallpaper />
          <OsWindow title="primeagen">
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
