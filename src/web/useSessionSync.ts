import { useEffect, useRef, useState } from "react";
import type { PublicSession, SessionEvent, WsServerMessage } from "../shared/types";
import { HttpError, fetchSnapshot } from "./api";

export function useSessionSync(sessionId: string | null, onMissing?: () => void) {
  const [snapshot, setSnapshot] = useState<PublicSession | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const versionRef = useRef(0);
  const onMissingRef = useRef(onMissing);
  onMissingRef.current = onMissing;

  useEffect(() => {
    if (!sessionId) {
      setSnapshot(null);
      setEvents([]);
      return;
    }
    versionRef.current = 0;

    let closed = false;
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: number | undefined;

    const missing = () => {
      closed = true;
      setConnected(false);
      setSnapshot(null);
      onMissingRef.current?.();
    };

    const applySnapshot = (next: PublicSession) => {
      if (next.stateVersion < versionRef.current) return;
      versionRef.current = next.stateVersion;
      setSnapshot(next);
    };

    const connect = async () => {
      try {
        const latest = await fetchSnapshot(sessionId);
        if (closed) return;
        applySnapshot(latest);
      } catch (err) {
        if (closed) return;
        if (err instanceof HttpError && err.status === 404) {
          missing();
          return;
        }
      }

      if (closed) return;
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${protocol}://${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`);
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onclose = (event) => {
        setConnected(false);
        if (closed) return;
        if (event.code === 4404) {
          missing();
          return;
        }
        retry += 1;
        timer = window.setTimeout(connect, Math.min(8000, 400 * 2 ** retry));
      };
      ws.onmessage = (ev) => {
        const message = JSON.parse(String(ev.data)) as WsServerMessage;
        if (message.type === "snapshot" && message.snapshot) {
          applySnapshot(message.snapshot);
        }
        if (message.type === "event" && message.event) {
          if (message.event.stateVersion < versionRef.current) return;
          setEvents((prev) => [...prev.slice(-199), message.event!]);
          if (message.snapshot) applySnapshot(message.snapshot);
        }
      };
    };

    void connect();
    return () => {
      closed = true;
      setConnected(false);
      if (timer) window.clearTimeout(timer);
      ws?.close();
    };
  }, [sessionId]);

  return {
    snapshot: sessionId ? snapshot : null,
    events: sessionId ? events : [],
    connected: sessionId ? connected : false,
  };
}
