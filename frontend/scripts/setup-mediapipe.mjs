// Copia os ficheiros WASM do MediaPipe e descarrega o modelo de mãos/gestos para public/,
// para a app funcionar sem depender de CDNs em tempo de execução.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = "public/mediapipe";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

mkdirSync(OUT, { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", `${OUT}/wasm`, { recursive: true });
console.log("✔ WASM do MediaPipe copiado");

if (!existsSync(`${OUT}/gesture_recognizer.task`)) {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Falha a descarregar o modelo: ${res.status}`);
  writeFileSync(`${OUT}/gesture_recognizer.task`, Buffer.from(await res.arrayBuffer()));
  console.log("✔ Modelo gesture_recognizer.task descarregado");
}
