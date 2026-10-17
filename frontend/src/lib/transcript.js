// Junta os sinais reconhecidos numa frase legível.
// Letras soletradas seguidas (M, A, R, I, A) viram uma palavra (MARIA); idem para dígitos.
const isLetter = (w) => /^[A-ZÇ]$/.test(w);
const isDigit = (w) => /^\d+$/.test(w) && w.length <= 2;

export function buildSentence(words) {
  const out = [];
  let prevKind = null;
  for (const w of words) {
    const kind = isLetter(w) ? "letter" : isDigit(w) ? "digit" : "word";
    if (kind !== "word" && kind === prevKind && out.length) {
      out[out.length - 1] += w;
    } else {
      out.push(w);
    }
    prevKind = kind;
  }
  let s = out.join(" ").replace(/\s+/g, " ").replace(/\s+([?!.,])/g, "$1").trim();
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}
