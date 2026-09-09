import { connectionLabels } from "../../content/index";
import type { PublicSession } from "../../shared/types";

export function ConnectionLabel({ state }: { state: string }) {
  return <span className={`status-pill ${state}`}>{connectionLabels[state] ?? state}</span>;
}

export function focusedWindowTitle(snapshot: PublicSession | null) {
  if (!snapshot || snapshot.stage === "waiting") return "primeagen 39";
  const focused = snapshot.visual.windows.find((win) => win.open && win.focused);
  if (focused?.title) return focused.title;
  if (snapshot.stage === "complete") return "primeagen 40";
  return "primeagen 39";
}

export function TopBar({ snapshot, clock }: { snapshot: PublicSession | null; clock: string }) {
  const state = snapshot?.connectionState ?? "waiting_for_agent";
  return (
    <header className="waybar">
      <div className="waybar-left">
        <span className="ws active">1</span>
        <span className="ws">2</span>
        <span className="ws">3</span>
      </div>
      <div className="waybar-center">{focusedWindowTitle(snapshot)}</div>
      <div className="waybar-right">
        <span className="waybar-clock">{clock}</span>
      </div>
    </header>
  );
}

export function ArchWallpaper() {
  return (
    <svg className="arch-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4 L58 54 H44 L32 28 L20 54 H6 Z" />
    </svg>
  );
}

export function OsWindow({
  title,
  host = "",
  children,
  className = "",
  target,
}: {
  title: string;
  host?: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
}) {
  return (
    <section className={`os-window ${className}`} data-target={target}>
      <header className="os-titlebar">
        <span className="os-title">{title}</span>
        <span className="os-host">{host}</span>
      </header>
      <div className="os-body">{children}</div>
    </section>
  );
}
