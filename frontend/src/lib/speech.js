// Síntese de voz do próprio navegador (Web Speech API) — funciona sem servidor.
const supported = typeof window !== "undefined" && "speechSynthesis" in window;
let voices = [];

function loadVoices() {
  voices = supported ? window.speechSynthesis.getVoices() : [];
}
if (supported) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

function pickVoice() {
  return (
    voices.find((v) => /pt[-_]MZ/i.test(v.lang)) ||
    voices.find((v) => /pt[-_]PT/i.test(v.lang)) ||
    voices.find((v) => /^pt/i.test(v.lang)) ||
    null
  );
}

export const speechSupported = supported;

export function speak(text, { rate = 1, interrupt = true } = {}) {
  if (!supported || !text?.trim()) return;
  if (interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = "pt-PT";
  }
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (supported) window.speechSynthesis.cancel();
}
