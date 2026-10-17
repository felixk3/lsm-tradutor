async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") msg = data.detail;
    } catch {
      /* resposta sem JSON */
    }
    throw new Error(msg);
  }
  const type = res.headers.get("content-type") || "";
  return type.includes("application/json") ? res.json() : res;
}

const enc = encodeURIComponent;

export const api = {
  vocabulary: () => request("/vocabulary"),
  addSign: (label, category) =>
    request("/vocabulary", { method: "POST", body: JSON.stringify({ label, category }) }),
  removeSign: (label) => request(`/vocabulary/${enc(label)}`, { method: "DELETE" }),
  addSample: (label, frames) =>
    request("/samples", { method: "POST", body: JSON.stringify({ label, frames }) }),
  undoSample: (label) => request(`/samples/${enc(label)}/last`, { method: "DELETE" }),
  clearSamples: (label) => request(`/samples/${enc(label)}`, { method: "DELETE" }),
  model: () => request("/model"),
  train: () => request("/train", { method: "POST" }),
  models: () => request("/models"),
  predict: (frames, model = "lsm", aspect = 1) =>
    request("/predict", { method: "POST", body: JSON.stringify({ frames, model, aspect }) }),
  importDataset: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/dataset/import", { method: "POST", body: fd });
  },
  exportUrl: "/api/dataset/export",
};

export const REST_LABEL = "_repouso";
export const displayLabel = (l) => (l === REST_LABEL ? "Repouso (sem sinal)" : l);
