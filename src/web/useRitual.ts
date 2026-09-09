import { useEffect, useState } from "react";
import { apply } from "../content/index";
import type { PublicSession } from "../shared/types";
import type { PreviewSceneId } from "./previewScenes";

const BOOT_MS = 2800;
const REBOOT_MS = 1800;
const STEP_MS = 480;
const INSTALL_MS = apply.steps.length * STEP_MS;

type Clock = {
  joinedStage: PublicSession["stage"];
  bootAt?: number;
  rebootAt?: number;
  installAt?: number;
};

const clocks = new Map<string, Clock>();

function ritualId(snapshot: PublicSession) {
  return `${snapshot.sessionId}:${snapshot.agentConnectedAt ?? "pre"}`;
}

function clockFor(snapshot: PublicSession, reducedMotion: boolean, preview?: PreviewSceneId): Clock {
  const id = ritualId(snapshot);
  let clock = clocks.get(id);
  if (!clock) {
    clock = { joinedStage: snapshot.stage };
    clocks.set(id, clock);
  }

  if (preview === "identify") clock.bootAt ??= 0;
  if (preview === "frozen") clock.installAt ??= 0;
  if (preview === "reveal") clock.rebootAt ??= 0;

  if (clock.bootAt === undefined) {
    clock.bootAt = !reducedMotion && snapshot.stage === "identify_agent" ? Date.now() : 0;
  }
  if (clock.installAt === undefined && (snapshot.stage === "apply_update" || snapshot.stage === "confirm_update")) {
    clock.installAt = reducedMotion ? 0 : Date.now();
  }
  if (clock.rebootAt === undefined && snapshot.stage === "complete") {
    const playReboot = !reducedMotion && (clock.joinedStage !== "complete" || preview === "reboot");
    clock.rebootAt = playReboot ? Date.now() : 0;
  }
  return clock;
}

export function useRitual(snapshot: PublicSession, reducedMotion: boolean, preview?: PreviewSceneId) {
  const [now, setNow] = useState(() => Date.now());
  const clock = clockFor(snapshot, reducedMotion, preview);

  const bootElapsed = (clock.bootAt ?? 0) > 0 ? now - clock.bootAt! : Infinity;
  const rebootElapsed = (clock.rebootAt ?? 0) > 0 ? now - clock.rebootAt! : Infinity;
  const installElapsed = (clock.installAt ?? 0) > 0 ? now - clock.installAt! : Infinity;

  const showBoot = snapshot.stage === "identify_agent" && bootElapsed < BOOT_MS;
  const showReboot = snapshot.stage === "complete" && rebootElapsed < REBOOT_MS;
  const installing =
    snapshot.stage === "apply_update" || snapshot.stage === "confirm_update" || snapshot.stage === "complete";

  useEffect(() => {
    if (reducedMotion) return;
    if (!showBoot && !showReboot && !(installing && installElapsed < INSTALL_MS)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, [reducedMotion, showBoot, showReboot, installing, installElapsed]);

  let installProgress = snapshot.visual.update.progress;
  let installLabel = snapshot.visual.update.stepLabel;
  if (!reducedMotion && installing && installElapsed < INSTALL_MS) {
    const index = Math.min(apply.steps.length - 1, Math.max(0, Math.floor(installElapsed / STEP_MS)));
    const step = apply.steps[index]!;
    installProgress = step.progress;
    installLabel = step.label;
  }
  if (snapshot.stage === "complete" && !showReboot) {
    installProgress = 100;
    installLabel = snapshot.visual.update.stepLabel || "Installation successful";
  }

  const bootLine = Math.min(
    snapshot.visual.bootMessages.length,
    Math.max(1, Math.ceil((Math.min(bootElapsed, BOOT_MS) / BOOT_MS) * snapshot.visual.bootMessages.length)),
  );
  const rebootLine = Math.min(
    snapshot.visual.bootMessages.length,
    Math.max(1, Math.ceil((Math.min(rebootElapsed, REBOOT_MS) / REBOOT_MS) * snapshot.visual.bootMessages.length)),
  );

  return {
    showBoot,
    showReboot,
    installProgress,
    installLabel,
    installReady: reducedMotion || installElapsed >= INSTALL_MS,
    bootLine,
    rebootLine,
  };
}
