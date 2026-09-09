let ctx: AudioContext | null = null;

function context() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playTone(enabled: boolean, kind: "notify" | "type" | "ok") {
  if (!enabled) return;
  const audio = context();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = kind === "notify" ? 440 : kind === "ok" ? 620 : 190;
  gain.gain.value = 0.03;
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.08);
  osc.stop(audio.currentTime + 0.09);
}
