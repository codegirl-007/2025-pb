import type { PublicSession } from "../../shared/types";
import type { PreviewSceneId } from "../previewScenes";
import { useRitual } from "../useRitual";
import { ArchWallpaper, OsWindow } from "./chrome";
import {
  BootSequence,
  DecisionScene,
  DiagnoseScene,
  DialogueRibbon,
  IdentifyScene,
  InstallScene,
  RebootSequence,
  RevealScene,
} from "./scenes";

export function Desktop({
  snapshot,
  reducedMotion,
  previewScene,
}: {
  snapshot: PublicSession;
  reducedMotion: boolean;
  previewScene?: PreviewSceneId;
}) {
  const ritual = useRitual(snapshot, reducedMotion, previewScene);
  const scene = sceneFor(snapshot.stage);
  const preview = snapshot.visual.filePreview;

  return (
    <main className="os-desktop" data-scene={scene} data-wallpaper={snapshot.visual.wallpaper}>
      <ArchWallpaper />
      <div className={`os-tiles ${preview ? "split" : ""}`}>
        <OsWindow title={mainWindowTitle(scene)}>
          {scene === "identify" ? <IdentifyScene snapshot={snapshot} /> : null}
          {scene === "diagnose" ? <DiagnoseScene snapshot={snapshot} /> : null}
          {scene === "decision" ? <DecisionScene snapshot={snapshot} /> : null}
          {scene === "install" ? (
            <InstallScene
              snapshot={snapshot}
              progress={ritual.installProgress}
              label={ritual.installLabel}
              promptReady={ritual.installReady}
            />
          ) : null}
          {scene === "reveal" && !ritual.showReboot ? <RevealScene snapshot={snapshot} /> : null}
          {scene !== "identify" && scene !== "reveal" ? <DialogueRibbon snapshot={snapshot} /> : null}
        </OsWindow>
        {preview ? (
          <OsWindow title={preview.path} className="os-window-side" target="editor">
            <pre className="document-body">{preview.content}</pre>
          </OsWindow>
        ) : null}
      </div>
      {ritual.showBoot ? (
        <BootSequence messages={snapshot.visual.bootMessages} visibleCount={ritual.bootLine} />
      ) : null}
      {ritual.showReboot ? (
        <RebootSequence messages={snapshot.visual.bootMessages} visibleCount={ritual.rebootLine} />
      ) : null}
    </main>
  );
}

function sceneFor(stage: PublicSession["stage"]) {
  if (stage === "identify_agent" || stage === "intro") return "identify";
  if (stage === "diagnose") return "diagnose";
  if (stage === "human_decision") return "decision";
  if (stage === "apply_update" || stage === "confirm_update") return "install";
  if (stage === "complete") return "reveal";
  return "identify";
}

function mainWindowTitle(scene: string) {
  if (scene === "identify") return "before we begin";
  if (scene === "diagnose") return "system status";
  if (scene === "decision") return "system status";
  if (scene === "install") return "update manager";
  if (scene === "reveal") return "primeagen 40.0";
  return "terminal";
}
