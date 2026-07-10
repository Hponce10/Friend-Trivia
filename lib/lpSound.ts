// Life-points counter sound, synthesized with the Web Audio API as an
// homage to the classic dueling-anime LP ticker: a rapid gated square-wave
// whir that sweeps up (gain) or down (loss), capped with a chime or thud.
// Synthesizing avoids shipping any copyrighted audio clip.

let ctx: AudioContext | null = null;

/** Must be called from a user gesture at least once per page (autoplay
    policy) — the leaderboard exposes an "Enable sound" button for this. */
export function ensureSoundEnabled(): boolean {
  try {
    if (!ctx) {
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export function soundEnabled(): boolean {
  return ctx?.state === 'running';
}

/** Short bright ding for the first buzz of a round. */
export function playBuzzDing(): void {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(1320, now + 0.09);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.55);
}

export function playLpRoll(durationMs: number, direction: 'up' | 'down'): void {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const dur = Math.min(Math.max(durationMs, 300), 2500) / 1000;

  // The whir: a square wave sweeping in pitch…
  const osc = ctx.createOscillator();
  osc.type = 'square';
  if (direction === 'up') {
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + dur);
  } else {
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + dur);
  }

  // …gated ~30x/sec into rapid ticks.
  const gate = ctx.createOscillator();
  gate.type = 'square';
  gate.frequency.value = 30;
  const gateGain = ctx.createGain();
  gateGain.gain.value = 0.5;
  const gateOffset = ctx.createConstantSource();
  gateOffset.offset.value = 0.5;

  const tickGain = ctx.createGain();
  tickGain.gain.value = 0;
  gate.connect(gateGain).connect(tickGain.gain);
  gateOffset.connect(tickGain.gain);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.12, now);
  master.gain.setValueAtTime(0.12, now + dur - 0.02);
  master.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(tickGain).connect(master).connect(ctx.destination);
  osc.start(now);
  gate.start(now);
  gateOffset.start(now);
  osc.stop(now + dur);
  gate.stop(now + dur);
  gateOffset.stop(now + dur);

  // Cap it: bright chime for gains, low thud for losses.
  const cap = ctx.createOscillator();
  const capGain = ctx.createGain();
  const capAt = now + dur;
  if (direction === 'up') {
    cap.type = 'sine';
    cap.frequency.setValueAtTime(1320, capAt);
    capGain.gain.setValueAtTime(0.2, capAt);
    capGain.gain.exponentialRampToValueAtTime(0.001, capAt + 0.45);
  } else {
    cap.type = 'sine';
    cap.frequency.setValueAtTime(160, capAt);
    cap.frequency.exponentialRampToValueAtTime(70, capAt + 0.3);
    capGain.gain.setValueAtTime(0.3, capAt);
    capGain.gain.exponentialRampToValueAtTime(0.001, capAt + 0.4);
  }
  cap.connect(capGain).connect(ctx.destination);
  cap.start(capAt);
  cap.stop(capAt + 0.5);
}
