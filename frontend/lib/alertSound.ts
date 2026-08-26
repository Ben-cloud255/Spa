'use client';

// Generates short attention tones with the Web Audio API so the project
// doesn't depend on shipping/licensing an audio file. Swap this out for an
// <audio> element pointing at a real sound file if the client prefers.

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

function beep(frequency: number, startTime: number, duration: number, audioCtx: AudioContext) {
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

/**
 * Browsers block audio until the person has interacted with the page at
 * least once (a security rule, not something we can turn off). Call this
 * from a real click/tap early in the session — see DashboardShell — so the
 * very first alert isn't the first time we're asking the browser to unlock
 * audio; by then it's too late to also ask permission.
 */
export function unlockAudioContext() {
  const audioCtx = getContext();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // If this fails, the next real alert will still try to play — this is
      // just a best-effort head start.
    });
  }
}

/** Two soft rising chimes — used when a session is about to end. */
export function playWarningChime() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  beep(660, now, 0.18, audioCtx);
  beep(880, now + 0.22, 0.22, audioCtx);
}

/** Three firmer tones — used when time is up / something needs attention. */
export function playUrgentAlert() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  beep(523, now, 0.16, audioCtx);
  beep(523, now + 0.22, 0.16, audioCtx);
  beep(523, now + 0.44, 0.28, audioCtx);
}
