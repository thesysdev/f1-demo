import { withBase } from "../lib/base-path";

/*
 * Radio sounds.
 * - tick: a tiny band-passed click per keystroke, synthesised with Web Audio.
 * - transmit: the F1 team-radio clip in public/sounds/f1-radio-send.mp3 (supplied by Shubham),
 *   played whenever a question is sent, at a consistent level.
 * Audio starts on the first call, which always comes from a key press or click, so browsers
 * allow it.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

// A burst of static through a band-pass, shaped by a fast attack and exponential fall.
function staticBurst(a: AudioContext, at: number, length: number, freq: number, q: number, peak: number) {
  const src = a.createBufferSource();
  src.buffer = noise;
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = q;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(band).connect(gain).connect(a.destination);
  src.start(at, Math.random() * 0.5, length + 0.02);
}

export function playTick() {
  const a = audio();
  if (!a) return;
  // Small random pitch so fast typing doesn't sound like a machine gun.
  staticBurst(a, a.currentTime, 0.022, 2600 + Math.random() * 900, 6, 0.09);
}

// The clip is mastered quietly (it peaks around 8% of full scale), and an <audio> element can't
// go above volume 1. So it's decoded once and played through a gain that lifts its own peak to
// TRANSMIT_PEAK, whatever level the file was exported at.
const TRANSMIT_PEAK = 0.9;
let transmit: Promise<{ buffer: AudioBuffer; gain: number }> | null = null;

function loadTransmit(a: AudioContext) {
  transmit ??= fetch(withBase("/sounds/f1-radio-send.mp3"))
    .then((res) => res.arrayBuffer())
    .then((data) => a.decodeAudioData(data))
    .then((buffer) => {
      let peak = 0;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++)
        for (const sample of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(sample));
      return { buffer, gain: peak > 0 ? TRANSMIT_PEAK / peak : 1 };
    });
  // A failed load can be retried on the next send.
  transmit.catch(() => (transmit = null));
  return transmit;
}

export function playTransmit() {
  const a = audio();
  if (!a) return;
  loadTransmit(a)
    .then(({ buffer, gain }) => {
      const src = a.createBufferSource();
      src.buffer = buffer;
      const level = a.createGain();
      level.gain.value = gain;
      src.connect(level).connect(a.destination);
      src.start();
    })
    .catch((error: unknown) => console.warn("Could not play the radio sound.", error));
}
