import { DrawingUtils, FilesetResolver, GestureRecognizer, HandLandmarker } from "@mediapipe/tasks-vision";

const CONNECTIONS = GestureRecognizer.HAND_CONNECTIONS || HandLandmarker.HAND_CONNECTIONS;

// O GestureRecognizer do MediaPipe devolve, numa só passagem, os 21 pontos de cada mão
// (usados pelo modelo LSM e pelo alfabeto) e o gesto reconhecido (modelo "Gestos comuns").
let recognizerPromise = null;

async function create(delegate) {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return GestureRecognizer.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/mediapipe/gesture_recognizer.task", delegate },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** Devolve um único reconhecedor partilhado (tenta GPU, cai para CPU). */
export function getHandTracker() {
  if (!recognizerPromise) {
    recognizerPromise = create("GPU").catch(() => create("CPU"));
    recognizerPromise.catch(() => {
      recognizerPromise = null;
    });
  }
  return recognizerPromise;
}

const round = (v) => Math.round(v * 10000) / 10000;

/** Converte o resultado do MediaPipe no formato enviado ao backend. */
export function toFrame(result, t, aspect) {
  const handed = result.handedness || result.handednesses || [];
  const hands = (result.landmarks || []).map((lm, i) => {
    const g = result.gestures?.[i]?.[0];
    return {
      handedness: handed[i]?.[0]?.categoryName || "Right",
      landmarks: lm.map((p) => [round(p.x), round(p.y), round(p.z)]),
      gesture: g?.categoryName || null,
      gesture_score: g ? round(g.score) : null,
    };
  });
  return { t, aspect, hands };
}

export function drawHands(ctx, result, colors) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (!result?.landmarks?.length) return;
  const du = new DrawingUtils(ctx);
  for (const lm of result.landmarks) {
    du.drawConnectors(lm, CONNECTIONS, { color: colors.line, lineWidth: 3 });
    du.drawLandmarks(lm, { color: colors.point, fillColor: colors.point, radius: 3, lineWidth: 1 });
  }
}

/** Mantém os frames dos últimos `windowMs` milissegundos. */
export class FrameBuffer {
  constructor(windowMs = 2000) {
    this.windowMs = windowMs;
    this.frames = [];
  }
  push(frame) {
    this.frames.push(frame);
    const cutoff = frame.t - this.windowMs;
    while (this.frames.length && this.frames[0].t < cutoff) this.frames.shift();
  }
  last(ms) {
    if (!this.frames.length) return [];
    const cutoff = this.frames[this.frames.length - 1].t - ms;
    return this.frames.filter((f) => f.t >= cutoff);
  }
  clear() {
    this.frames = [];
  }
}
