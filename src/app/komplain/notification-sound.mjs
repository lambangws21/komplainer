'use client';

// Synthesized two-tone chime via Web Audio — no binary asset to ship/license, and it's a single
// short beep so generating it on the fly is cheap. Muted state is a local-only nicety (like the
// theme/tour flags elsewhere in this app), so it lives in localStorage, not account settings.
const MUTE_KEY = 'komplain-sound-muted';

export function isSoundMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setSoundMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* localStorage unavailable */ }
}

let sharedContext = null;
function audioContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

// Browsers block audio until a user gesture has occurred somewhere on the page; since this fires
// from a background poll, a context stuck "suspended" just means skip the sound rather than throw.
export function playNotificationChime() {
  if (isSoundMuted()) return;
  const ctx = audioContext();
  if (!ctx || ctx.state === 'suspended') return;
  const now = ctx.currentTime;
  [[880, now, 0.12], [1320, now + 0.1, 0.14]].forEach(([frequency, start, duration]) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}
