import { hapticEnabled, sfxEnabled } from "@/lib/prefs";

const HAPTIC_PATTERN: Record<"light" | "heavy" | "success" | "plant", number | number[]> =
  {
    light: 12,
    heavy: [18, 28, 42],
    success: [16, 42, 22, 55, 40],
    plant: [10, 16, 22],
  };

let audioCtx: AudioContext | null = null;
let master: DynamicsCompressorNode | null = null;
let busGain: GainNode | null = null;
let noiseCache: AudioBuffer | null = null;
let bedSrc: AudioBufferSourceNode | null = null;
let bedGain: GainNode | null = null;

function AudioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

function getContext(): AudioContext | null {
  const Ctor = AudioCtor();
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

function bus(): AudioNode | null {
  const ctx = getContext();
  if (!ctx) return null;
  if (!master || !busGain) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.14;
    const gain = ctx.createGain();
    gain.gain.value = 0.92;
    gain.connect(comp);
    comp.connect(ctx.destination);
    busGain = gain;
    master = comp;
  }
  return busGain;
}

function noise(ctx: AudioContext, seconds: number): AudioBuffer {
  if (!noiseCache || noiseCache.sampleRate !== ctx.sampleRate) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 1.6));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      prev = prev * 0.96 + white * 0.04;
      data[i] = white * 0.72 + prev * 0.28;
    }
    noiseCache = buffer;
  }
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const slice = ctx.createBuffer(1, length, ctx.sampleRate);
  const src = noiseCache.getChannelData(0);
  const dst = slice.getChannelData(0);
  const start = Math.floor(Math.random() * (src.length - length));
  dst.set(src.subarray(start, start + length));
  return slice;
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  endFreq?: number,
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + dur);
}

function burst(
  ctx: AudioContext,
  dest: AudioNode,
  seconds: number,
  start: number,
  peak: number,
  filter: { type: BiquadFilterType; freq: number; q: number; end?: number },
) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, seconds);
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.frequency.setValueAtTime(filter.freq, start);
  if (filter.end) {
    f.frequency.exponentialRampToValueAtTime(filter.end, start + seconds);
  }
  f.Q.value = filter.q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  src.connect(f);
  f.connect(gain);
  gain.connect(dest);
  src.start(start);
  src.stop(start + seconds + 0.02);
}

/** Resume the shared AudioContext after a user gesture (autoplay policy). */
export function unlockAudio(): void {
  void getContext();
  void bus();
}

/** Shot-clock beat — last 3s of compose. `final` is the 1s sting. */
export function playTick(kind: "mid" | "final" = "mid"): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  if (kind === "final") {
    tone(ctx, dest, "sine", 740, now, 0.09, 0.17, 380);
    tone(ctx, dest, "triangle", 1480, now, 0.05, 0.1);
    return;
  }
  tone(ctx, dest, "sine", 1180, now, 0.045, 0.12, 680);
  tone(ctx, dest, "triangle", 1960, now, 0.022, 0.07);
}

/** Keeper window just opened — react now. */
export function playReact(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  tone(ctx, dest, "square", 620, now, 0.07, 0.16, 1480);
  tone(ctx, dest, "sine", 1760, now + 0.02, 0.09, 0.14, 2640);
  burst(ctx, dest, 0.06, now, 0.18, {
    type: "highpass",
    freq: 1800,
    q: 0.8,
  });
}

/** Freeze lock — the metronome hit. */
export function playLock(accuracy = 70): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  const elite = accuracy >= 95;
  tone(ctx, dest, "sine", elite ? 1320 : 880, now, 0.11, elite ? 0.2 : 0.14, elite ? 1980 : 620);
  burst(ctx, dest, 0.05, now, elite ? 0.22 : 0.14, {
    type: "highpass",
    freq: 2200,
    q: 0.7,
  });
}

/** Dual-frequency referee pea whistle. */
export function playWhistle(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  const dur = 0.62;
  const master = ctx.createGain();
  master.connect(dest);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  master.gain.setValueAtTime(0.18, now + dur - 0.08);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 7.2;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 22;
  lfo.connect(lfoDepth);

  for (const freq of [2180, 2610, 1960]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    lfoDepth.connect(osc.frequency);
    osc.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }
  lfo.start(now);
  lfo.stop(now + dur + 0.02);
}

/** Boot-on-ball: membrane, turf grit, leather click. */
export function playKick(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  tone(ctx, dest, "sine", 88, now, 0.34, 0.78, 28);
  tone(ctx, dest, "triangle", 156, now, 0.11, 0.32, 48);
  tone(ctx, dest, "square", 198, now, 0.028, 0.09, 82);
  burst(ctx, dest, 0.13, now, 0.52, {
    type: "bandpass",
    freq: 680,
    q: 0.85,
    end: 240,
  });
  burst(ctx, dest, 0.045, now, 0.36, {
    type: "highpass",
    freq: 3400,
    q: 0.55,
  });
  burst(ctx, dest, 0.08, now + 0.01, 0.16, {
    type: "lowpass",
    freq: 180,
    q: 0.7,
    end: 70,
  });
}

/** Plant foot into the turf. */
export function playPlant(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  tone(ctx, dest, "sine", 72, now, 0.16, 0.28, 38);
  burst(ctx, dest, 0.09, now, 0.22, {
    type: "lowpass",
    freq: 420,
    q: 0.6,
    end: 140,
  });
}

/** Air as the plant foot loads. */
export function playWhoosh(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  burst(ctx, dest, 0.2, now, 0.28, {
    type: "bandpass",
    freq: 380,
    q: 0.5,
    end: 2600,
  });
}

/** Leather glove parry. */
export function playGlove(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  tone(ctx, dest, "triangle", 240, now, 0.14, 0.34, 70);
  burst(ctx, dest, 0.07, now, 0.5, {
    type: "highpass",
    freq: 1600,
    q: 0.8,
  });
  burst(ctx, dest, 0.05, now + 0.012, 0.18, {
    type: "bandpass",
    freq: 420,
    q: 1.1,
  });
}

/** Ball past the frame / heavy miss. */
export function playWide(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  burst(ctx, dest, 0.28, now, 0.2, {
    type: "lowpass",
    freq: 900,
    q: 0.4,
    end: 220,
  });
  tone(ctx, dest, "sine", 180, now, 0.22, 0.12, 70);
}

/** Net rattle. */
export function playNet(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  burst(ctx, dest, 0.38, now, 0.34, {
    type: "bandpass",
    freq: 2100,
    q: 1.6,
    end: 620,
  });
  burst(ctx, dest, 0.16, now + 0.04, 0.16, {
    type: "bandpass",
    freq: 3200,
    q: 2.2,
    end: 900,
  });
  tone(ctx, dest, "triangle", 140, now, 0.2, 0.1, 55);
}

/** Crowd swell — noise bed, not a MIDI fanfare. */
export function playCheer(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest) return;
  const now = ctx.currentTime;
  burst(ctx, dest, 1.65, now, 0.3, {
    type: "bandpass",
    freq: 860,
    q: 0.5,
    end: 2400,
  });
  burst(ctx, dest, 1.1, now + 0.06, 0.16, {
    type: "lowpass",
    freq: 260,
    q: 0.35,
  });
  burst(ctx, dest, 0.55, now + 0.12, 0.1, {
    type: "highpass",
    freq: 1800,
    q: 0.4,
  });
  tone(ctx, dest, "sine", 196, now, 0.9, 0.05, 228);
  tone(ctx, dest, "sine", 392, now + 0.04, 0.75, 0.04, 418);
}

function bedBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2.4;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    prev = prev * 0.972 + white * 0.028;
    data[i] = prev * 0.85;
  }
  const fade = Math.floor(ctx.sampleRate * 0.09);
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade;
    data[i]! *= t;
    data[length - 1 - i]! *= t;
  }
  return buffer;
}

/** Night-bowl rumble for the stadium. */
export function startAmbience(): void {
  if (!sfxEnabled()) return;
  const ctx = getContext();
  const dest = bus();
  if (!ctx || !dest || bedSrc) return;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 380;
  filter.Q.value = 0.42;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  const src = ctx.createBufferSource();
  src.buffer = bedBuffer(ctx);
  src.loop = true;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start();
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.7);
  bedSrc = src;
  bedGain = gain;
}

export function stopAmbience(): void {
  const ctx = audioCtx;
  const src = bedSrc;
  const gain = bedGain;
  bedSrc = null;
  bedGain = null;
  if (gain && ctx) {
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    } catch {
      // ignore
    }
  }
  window.setTimeout(() => {
    try {
      src?.stop();
    } catch {
      // already stopped
    }
  }, 380);
}

export function triggerHaptic(type: "light" | "heavy" | "success" | "plant"): void {
  if (!hapticEnabled()) return;
  if (typeof navigator === "undefined") return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (typeof vibrate !== "function") return;
  try {
    vibrate(HAPTIC_PATTERN[type]);
  } catch {
    // Some embeds expose vibrate but reject the call.
  }
}
