'use client';

// Synthesized chimes via Web Audio by default — no binary asset to ship/license — plus an
// optional user-uploaded sound. Everything here is local-only (like the theme/tour flags
// elsewhere in this app), not account settings, so it lives in localStorage per device.
const MUTE_KEY = 'komplain-sound-muted';
const CHOICE_KEY = 'komplain-sound-choice';
const CUSTOM_DATA_KEY = 'komplain-sound-custom-data';
const CUSTOM_NAME_KEY = 'komplain-sound-custom-name';
export const CUSTOM_SOUND_MAX_BYTES = 300 * 1024;

export function isSoundMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setSoundMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* localStorage unavailable */ }
}

export const SOUND_PRESETS = [
  { id: 'chime', label: 'Chime (bawaan)', tones: [[880, 0, 0.12], [1320, 0.1, 0.14]] },
  { id: 'bell', label: 'Bell', tones: [[660, 0, 0.18], [990, 0.12, 0.2], [660, 0.26, 0.16]] },
  { id: 'ping', label: 'Ping', tones: [[1200, 0, 0.09]] },
  { id: 'alert', label: 'Alert', tones: [[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.16]] },
];

export function getSoundChoice() {
  try { return localStorage.getItem(CHOICE_KEY) || 'chime'; } catch { return 'chime'; }
}
export function setSoundChoice(id) {
  try { localStorage.setItem(CHOICE_KEY, id); } catch { /* localStorage unavailable */ }
}
export function getCustomSound() {
  try { return { dataUrl: localStorage.getItem(CUSTOM_DATA_KEY) || '', name: localStorage.getItem(CUSTOM_NAME_KEY) || '' }; }
  catch { return { dataUrl: '', name: '' }; }
}
export function setCustomSound(dataUrl, name) {
  try { localStorage.setItem(CUSTOM_DATA_KEY, dataUrl); localStorage.setItem(CUSTOM_NAME_KEY, name || 'Suara kustom'); } catch { /* localStorage unavailable */ }
}
export function clearCustomSound() {
  try { localStorage.removeItem(CUSTOM_DATA_KEY); localStorage.removeItem(CUSTOM_NAME_KEY); } catch { /* localStorage unavailable */ }
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
function playTones(tones) {
  const ctx = audioContext();
  if (!ctx || ctx.state === 'suspended') return;
  const now = ctx.currentTime;
  tones.forEach(([frequency, offset, duration]) => {
    const start = now + offset;
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
function playCustom() {
  const { dataUrl } = getCustomSound();
  if (!dataUrl) { playTones(SOUND_PRESETS[0].tones); return; }
  try { const audio = new Audio(dataUrl); audio.volume = 0.7; audio.play().catch(() => {}); } catch { /* playback unavailable */ }
}

// Explicit "test" trigger from the sound-picker UI — plays regardless of the mute flag, so users
// can preview an option before committing to it as their default.
export function previewSound(choice) {
  if (choice === 'custom') { playCustom(); return; }
  playTones((SOUND_PRESETS.find((preset) => preset.id === choice) || SOUND_PRESETS[0]).tones);
}

export function playNotificationChime() {
  if (isSoundMuted()) return;
  previewSound(getSoundChoice());
}
