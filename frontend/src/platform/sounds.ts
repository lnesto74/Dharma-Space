// Lightweight, asset-free sound cues for the Buddy Challenge timer, built with
// the Web Audio API. The shared AudioContext is unlocked by the first user
// gesture (pressing "Start"), which lets the finish cue play automatically.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(audio: AudioContext, freq: number, start: number, duration: number, peak = 0.18) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  // Quick attack/decay envelope to avoid clicks.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Rising two-tone "go" cue when a timed duel starts. */
export function playStartSound() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  beep(audio, 660, t, 0.14);
  beep(audio, 990, t + 0.14, 0.22);
}

/** Triple high beep "time's up" alarm when the countdown ends. */
export function playFinishSound() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  beep(audio, 880, t, 0.16, 0.22);
  beep(audio, 880, t + 0.22, 0.16, 0.22);
  beep(audio, 1175, t + 0.44, 0.32, 0.24);
}

// A single metallic "clang" built from inharmonic partials with a sharp decay.
function metalHit(audio: AudioContext, start: number, baseFreq: number, duration: number, peak = 0.22) {
  const partials = [1, 1.48, 2.34, 3.16, 4.07];
  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(peak, start + 0.004);
  master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  master.connect(audio.destination);
  partials.forEach((p, i) => {
    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq * p, start);
    // slight downward pitch slide gives the ringing-metal feel
    osc.frequency.exponentialRampToValueAtTime(baseFreq * p * 0.92, start + duration);
    const g = audio.createGain();
    g.gain.setValueAtTime(1 / (i + 1.5), start);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  });
}

/** Crossing-swords clang for an arriving challenge notification. */
export function playSwordsSound() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  metalHit(audio, t, 2100, 0.22, 0.22);
  metalHit(audio, t + 0.09, 2600, 0.34, 0.2);
}

/** Standard two-tone "ding" for an arriving chat message. */
export function playMessageSound() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  beep(audio, 784, t, 0.12, 0.16);
  beep(audio, 1046, t + 0.12, 0.26, 0.16);
}
