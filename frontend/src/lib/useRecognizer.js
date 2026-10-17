import { useCallback, useEffect, useRef, useState } from "react";
import { api, REST_LABEL } from "./api";
import { FrameBuffer } from "./handTracker";
import { SIGN_WINDOW_MS } from "./constants";

const POLL_MS = 200;

// Sinais da LSM têm movimento (janela longa); letras, números e gestos são estáticos.
const SETTINGS = {
  lsm: { windowMs: SIGN_WINDOW_MS, minHandFrames: 6, streak: 2 },
  gestos: { windowMs: 600, minHandFrames: 4, streak: 2 },
  letras: { windowMs: 600, minHandFrames: 4, streak: 3 },
  numeros: { windowMs: 600, minHandFrames: 4, streak: 3 },
};

/**
 * Reconhecimento contínuo: guarda os frames da câmara, pergunta ao servidor que sinal é
 * e chama `onCommit(label)` quando o mesmo sinal é visto com confiança várias vezes seguidas.
 */
export function useRecognizer({ modelId, running, threshold, onCommit, onError }) {
  const [current, setCurrent] = useState(null);
  const bufferRef = useRef(new FrameBuffer(SIGN_WINDOW_MS + 1000));
  const lastHandsAt = useRef(0);
  const st = useRef(null);
  const refs = useRef({});
  refs.current = { running, threshold, onCommit, onError, modelId };

  const freshState = () => ({ inflight: false, lastCommit: null, low: 0, streak: { label: null, n: 0 }, cooldownUntil: 0 });
  if (!st.current) st.current = freshState();
  const reset = () => {
    bufferRef.current.clear();
    st.current = freshState();
    setCurrent(null);
  };

  const onFrame = useCallback((frame) => {
    if (!refs.current.running) return;
    bufferRef.current.push(frame);
    if (frame.hands.length) lastHandsAt.current = frame.t;
  }, []);

  useEffect(() => {
    reset();
    if (!running || !modelId) return undefined;
    const cfg = SETTINGS[modelId] || SETTINGS.lsm;
    const s = st.current;

    const id = setInterval(async () => {
      const now = performance.now();
      if (now - lastHandsAt.current > 1000) {
        // mãos fora da imagem → pode repetir-se o mesmo sinal
        s.lastCommit = null;
        s.streak = { label: null, n: 0 };
        bufferRef.current.clear();
        setCurrent(null);
        return;
      }
      if (s.inflight || now < s.cooldownUntil) return;
      const frames = bufferRef.current.last(cfg.windowMs);
      if (frames.filter((f) => f.hands.length).length < cfg.minHandFrames) return;

      s.inflight = true;
      try {
        const aspect = frames[frames.length - 1].aspect || 1;
        const r = await api.predict(frames, modelId, aspect);
        if (!refs.current.running || refs.current.modelId !== modelId) return;
        setCurrent(r.label ? r : null);

        const weak = !r.label || r.label === REST_LABEL || r.confidence < refs.current.threshold;
        if (weak) {
          s.streak = { label: null, n: 0 };
          s.low += 1;
          // pausa/transição entre sinais → permite repetir a mesma palavra ou letra
          if (r.label === REST_LABEL || s.low >= 3) s.lastCommit = null;
          return;
        }
        s.low = 0;
        s.streak = s.streak.label === r.label ? { label: r.label, n: s.streak.n + 1 } : { label: r.label, n: 1 };
        if (s.streak.n >= cfg.streak && r.label !== s.lastCommit) {
          refs.current.onCommit?.(r.label, r);
          s.lastCommit = r.label;
          s.streak = { label: null, n: 0 };
          s.cooldownUntil = performance.now() + 500;
          bufferRef.current.clear();
        }
      } catch (e) {
        refs.current.onError?.(e.message);
      } finally {
        s.inflight = false;
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, modelId]);

  return { onFrame, current };
}
