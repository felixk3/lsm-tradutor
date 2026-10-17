import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, IconButton, InputAdornment, LinearProgress,
  List, ListItemButton, ListItemText, ListSubheader, Snackbar, Stack, Step, StepLabel, Stepper, Switch,
  TextField, Tooltip, Typography,
} from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import CameraView from "../components/CameraView";
import ModelCard from "../components/ModelCard";
import AddSignDialog from "../components/AddSignDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { api, displayLabel, REST_LABEL } from "../lib/api";
import { SIGN_WINDOW_MS, TARGET_SAMPLES } from "../lib/constants";
import { useRecognizer } from "../lib/useRecognizer";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BATCH = 5;

function countColor(n) {
  if (n >= TARGET_SAMPLES) return "success";
  if (n >= 3) return "warning";
  return "default";
}

export default function TrainPage({ vocab, modelStatus, refresh }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState({ kind: "idle" }); // idle | countdown(n) | recording
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const [liveTest, setLiveTest] = useState(false);
  const [recent, setRecent] = useState([]);
  const recRef = useRef({ active: false, frames: [], startAt: 0, resolve: null });
  const cancelRef = useRef(false);

  const sel = vocab.find((v) => v.label === selected) || null;

  useEffect(() => {
    if (!selected && vocab.length) {
      const first = vocab.find((v) => v.label !== REST_LABEL && v.samples < TARGET_SAMPLES) || vocab[0];
      setSelected(first.label);
    }
  }, [vocab, selected]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map();
    for (const v of vocab) {
      if (q && !displayLabel(v.label).toLowerCase().includes(q)) continue;
      if (!groups.has(v.category)) groups.set(v.category, []);
      groups.get(v.category).push(v);
    }
    return [...groups.entries()];
  }, [vocab, query]);

  const categories = useMemo(() => [...new Set(vocab.map((v) => v.category))], [vocab]);

  // ----------------------------------------------------------- gravação
  const onFrame = useCallback((frame) => {
    const r = recRef.current;
    if (!r.active) return;
    if (!r.startAt) r.startAt = frame.t;
    r.frames.push(frame);
    if (frame.t - r.startAt >= SIGN_WINDOW_MS) {
      r.active = false;
      r.resolve?.(r.frames);
    }
  }, []);

  // teste ao vivo: usa o modelo LSM acabado de treinar, aqui mesmo
  const lsmReady = !!modelStatus?.ready;
  const live = useRecognizer({
    modelId: "lsm",
    running: liveTest && lsmReady && !busy,
    threshold: 0.6,
    onCommit: (label) => setRecent((r) => [label, ...r].slice(0, 8)),
    onError: setSnack,
  });
  const liveOnFrame = live.onFrame;
  const handleFrame = useCallback((f) => {
    onFrame(f);
    liveOnFrame(f);
  }, [onFrame, liveOnFrame]);

  const onTrained = () => {
    setRecent([]);
    setLiveTest(true);
    setSnack("Modelo treinado! Faça um dos sinais para a câmara e veja o resultado.");
  };

  // progresso do fluxo Gravar → Treinar → Testar
  const recordedSigns = vocab.filter((v) => v.label !== REST_LABEL && v.samples >= 3).length;
  const activeStep = recordedSigns < 2 ? 0 : !lsmReady ? 1 : 2;

  const recordOnce = async (first) => {
    const steps = first ? 3 : 2;
    for (let c = steps; c >= 1; c--) {
      if (cancelRef.current) return null;
      setPhase({ kind: "countdown", n: c });
      await sleep(650);
    }
    setPhase({ kind: "recording" });
    const frames = await new Promise((resolve) => {
      recRef.current = { active: true, frames: [], startAt: 0, resolve };
      setTimeout(() => {
        if (recRef.current.active) {
          recRef.current.active = false;
          resolve(recRef.current.frames);
        }
      }, SIGN_WINDOW_MS + 3000);
    });
    setPhase({ kind: "idle" });
    return frames;
  };

  const record = async (n) => {
    if (!sel || busy) return;
    setBusy(true);
    cancelRef.current = false;
    let ok = 0;
    try {
      for (let i = 0; i < n && !cancelRef.current; i++) {
        setBatch(n > 1 ? { i: i + 1, n } : null);
        const frames = await recordOnce(i === 0);
        if (!frames) break;
        try {
          await api.addSample(sel.label, frames);
          ok++;
        } catch (e) {
          setSnack(e.message);
        }
        await refresh();
        if (i < n - 1) await sleep(300);
      }
      if (ok) setSnack(`${ok} amostra${ok > 1 ? "s" : ""} gravada${ok > 1 ? "s" : ""} para “${displayLabel(sel.label)}”`);
    } finally {
      setBusy(false);
      setBatch(null);
      setPhase({ kind: "idle" });
    }
  };

  // atalho: barra de espaço grava uma amostra
  const recordRef = useRef(record);
  recordRef.current = record;
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space" || e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      recordRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ----------------------------------------------------------- ações
  const undo = async () => {
    await api.undoSample(sel.label);
    await refresh();
  };

  const addSign = async (label, category) => {
    try {
      await api.addSign(label, category);
      await refresh();
      setSelected(label);
      return true;
    } catch (e) {
      setSnack(e.message);
      return false;
    }
  };

  const runConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    try {
      if (c.kind === "clear") await api.clearSamples(c.label);
      if (c.kind === "remove") {
        await api.removeSign(c.label);
        setSelected(null);
      }
      await refresh();
    } catch (e) {
      setSnack(e.message);
    }
  };

  // ----------------------------------------------------------- overlay
  const overlay = (
    <>
      {phase.kind === "countdown" && (
        <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,.35)" }}>
          <Typography sx={{ fontSize: 120, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{phase.n}</Typography>
          <Typography sx={{ color: "#fff", mt: 1 }}>Prepare o sinal “{displayLabel(sel?.label)}”</Typography>
        </Stack>
      )}
      {phase.kind === "recording" && (
        <Box sx={{ position: "absolute", inset: 0, border: "6px solid", borderColor: "error.main", borderRadius: 3, pointerEvents: "none" }}>
          <Chip
            icon={<FiberManualRecordRoundedIcon />}
            label="A gravar…"
            color="error"
            sx={{ position: "absolute", top: 12, right: 12, "& .MuiChip-icon": { animation: "pulse 1s infinite" } }}
          />
        </Box>
      )}
      {liveTest && !busy && live.current && live.current.label !== REST_LABEL && (
        <Card elevation={0} sx={{ position: "absolute", left: 12, bottom: 12, bgcolor: "rgba(255,255,255,.92)" }}>
          <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
            <Typography variant="caption" color="text.secondary">O modelo vê</Typography>
            <Typography variant="h5" fontWeight={600} lineHeight={1.1}>
              {displayLabel(live.current.label)}{" "}
              <Typography component="span" variant="body2" color="text.secondary">
                {Math.round(live.current.confidence * 100)}%
              </Typography>
            </Typography>
          </CardContent>
        </Card>
      )}
      {batch && (
        <Chip label={`Amostra ${batch.i} de ${batch.n}`} sx={{ position: "absolute", bottom: 12, right: 12, bgcolor: "rgba(255,255,255,.9)" }} />
      )}
    </>
  );

  return (
    <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "7fr 5fr" }, alignItems: "start" }}>
      <Card sx={{ gridColumn: "1 / -1" }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <Box sx={{ minWidth: { md: 300 } }}>
              <Typography variant="h6" fontWeight={600} lineHeight={1.2}>Ensinar a LSM à app</Typography>
              <Typography variant="body2" color="text.secondary">
                Faça-o com um intérprete ou uma pessoa surda fluente em LSM.
              </Typography>
            </Box>
            <Stepper activeStep={activeStep} alternativeLabel sx={{ flex: 1 }}>
              <Step completed={activeStep > 0}>
                <StepLabel optional={<Typography variant="caption">≥ 3 amostras em 2+ sinais</Typography>}>Gravar sinais</StepLabel>
              </Step>
              <Step completed={activeStep > 1}>
                <StepLabel optional={<Typography variant="caption">botão “Treinar modelo”</Typography>}>Treinar</StepLabel>
              </Step>
              <Step completed={false}>
                <StepLabel optional={<Typography variant="caption">aqui ao vivo ou em Traduzir</Typography>}>Testar</StepLabel>
              </Step>
            </Stepper>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        <CameraView onFrame={handleFrame} overlay={overlay} />

        <Card>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <FormControlLabel
                control={<Switch checked={liveTest && lsmReady} disabled={!lsmReady} onChange={(e) => setLiveTest(e.target.checked)} />}
                label={<b>Testar ao vivo</b>}
                sx={{ mr: 0 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {lsmReady
                  ? liveTest
                    ? "Faça um sinal: o resultado aparece na câmara. Se errar, grave mais amostras e treine de novo."
                    : "Ligue para ver o modelo a reconhecer os sinais, sem sair desta página."
                  : "Disponível depois de treinar o modelo."}
              </Typography>
            </Stack>
            {liveTest && lsmReady && (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>Reconhecidos:</Typography>
                {recent.length ? recent.map((r, i) => <Chip key={i} size="small" color={i === 0 ? "success" : "default"} label={displayLabel(r)} />)
                  : <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>—</Typography>}
              </Stack>
            )}
          </CardContent>
        </Card>

        {sel && (
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="text.secondary">{sel.category}</Typography>
                  <Typography variant="h4" fontWeight={600} noWrap>{displayLabel(sel.label)}</Typography>
                </Box>
                <Stack direction="row">
                  <Tooltip title="Apagar a última amostra">
                    <span><IconButton disabled={busy || !sel.samples} onClick={undo}><UndoRoundedIcon /></IconButton></span>
                  </Tooltip>
                  <Tooltip title="Apagar todas as amostras deste sinal">
                    <span>
                      <IconButton disabled={busy || !sel.samples} onClick={() => setConfirm({ kind: "clear", label: sel.label })}>
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ my: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (sel.samples / TARGET_SAMPLES) * 100)}
                  color={countColor(sel.samples) === "default" ? "primary" : countColor(sel.samples)}
                  sx={{ flex: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90, textAlign: "right" }}>
                  {sel.samples} / {TARGET_SAMPLES} amostras
                </Typography>
              </Stack>

              {sel.label === REST_LABEL && (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                  Grave as mãos visíveis mas <b>sem fazer nenhum sinal</b> (paradas, a descer, a mudar de posição).
                  Isto ensina o modelo a não escrever nada entre sinais.
                </Alert>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                {busy ? (
                  <Button variant="outlined" color="error" size="large" startIcon={<StopRoundedIcon />} onClick={() => { cancelRef.current = true; }} sx={{ flex: 1 }}>
                    Parar
                  </Button>
                ) : (
                  <>
                    <Button variant="contained" size="large" startIcon={<FiberManualRecordRoundedIcon />} onClick={() => record(1)} sx={{ flex: 1 }}>
                      Gravar amostra
                    </Button>
                    <Button variant="outlined" size="large" startIcon={<RepeatRoundedIcon />} onClick={() => record(BATCH)} sx={{ flex: 1 }}>
                      Gravar {BATCH} seguidas
                    </Button>
                  </>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                Dica: prima <b>Espaço</b> para gravar. Cada gravação dura {SIGN_WINDOW_MS / 1000}s. Varie ligeiramente a posição
                e, se possível, grave com várias pessoas e iluminações.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      <Stack spacing={2}>
        <ModelCard vocab={vocab} modelStatus={modelStatus} onChanged={refresh} onTrained={onTrained} notify={setSnack} />

        <Card>
          <CardContent sx={{ pb: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Procurar sinal"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
              />
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setAddOpen(true)} sx={{ flexShrink: 0 }}>
                Novo
              </Button>
            </Stack>
          </CardContent>
          <List dense sx={{ maxHeight: 460, overflowY: "auto", pt: 0 }} subheader={<li />}>
            {grouped.map(([cat, items]) => (
              <li key={cat}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ lineHeight: "32px" }}>{cat}</ListSubheader>
                  {items.map((v) => (
                    <ListItemButton
                      key={v.label}
                      selected={v.label === selected}
                      disabled={busy}
                      onClick={() => setSelected(v.label)}
                      sx={{ pr: 1 }}
                    >
                      <ListItemText primary={displayLabel(v.label)} />
                      {v.trained && (
                        <Tooltip title="Reconhecido pelo modelo atual">
                          <CheckCircleRoundedIcon color="success" fontSize="small" sx={{ mr: 1 }} />
                        </Tooltip>
                      )}
                      <Chip size="small" label={v.samples} color={countColor(v.samples)} variant={v.samples ? "filled" : "outlined"} />
                      {v.label !== REST_LABEL && (
                        <Tooltip title="Remover sinal">
                          <IconButton
                            size="small"
                            edge="end"
                            sx={{ ml: 0.5, opacity: 0.5, "&:hover": { opacity: 1 } }}
                            onClick={(e) => { e.stopPropagation(); setConfirm({ kind: "remove", label: v.label }); }}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            ))}
            {!grouped.length && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3 }}>Nenhum sinal encontrado.</Typography>
            )}
          </List>
        </Card>
      </Stack>

      <AddSignDialog open={addOpen} categories={categories} onClose={() => setAddOpen(false)} onSave={addSign} />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "remove" ? "Remover sinal?" : "Apagar amostras?"}
        text={
          confirm?.kind === "remove"
            ? `O sinal “${displayLabel(confirm?.label)}” e todas as suas amostras serão apagados.`
            : `Todas as amostras de “${displayLabel(confirm?.label)}” serão apagadas.`
        }
        confirmLabel={confirm?.kind === "remove" ? "Remover" : "Apagar"}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack("")} message={snack} />
    </Box>
  );
}
