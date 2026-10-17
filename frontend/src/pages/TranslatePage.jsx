import { useCallback, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, FormControlLabel, IconButton,
  LinearProgress, Slider, Snackbar, Stack, Switch, Tooltip, Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import SpaceBarRoundedIcon from "@mui/icons-material/SpaceBarRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CameraView from "../components/CameraView";
import ModelPicker, { SignChips } from "../components/ModelPicker";
import WelcomeGuide from "../components/WelcomeGuide";
import { REST_LABEL, displayLabel } from "../lib/api";
import { speak, speechSupported } from "../lib/speech";
import { buildSentence } from "../lib/transcript";
import { useRecognizer } from "../lib/useRecognizer";

const TIPS = {
  gestos: "Mantenha o gesto parado por meio segundo, com a palma virada para a câmara.",
  letras: "Mantenha cada letra parada por meio segundo. Para repetir uma letra (ex.: “LL”), relaxe a mão entre as duas.",
  numeros: "Mantenha cada número parado por meio segundo. Para repetir, relaxe a mão entre os dois.",
  lsm: "Faça cada sinal de forma clara e baixe as mãos entre sinais repetidos.",
};

export default function TranslatePage({ models, modelId, setModelId, showGuide, setShowGuide, onGoTrain }) {
  const [running, setRunning] = useState(false);
  const [words, setWords] = useState([]);
  const [threshold, setThreshold] = useState(0.6);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [snack, setSnack] = useState("");

  const model = models.find((m) => m.id === modelId);
  const ready = !!model?.available;

  const onCommit = useCallback(
    (label) => {
      setWords((w) => [...w, label]);
      if (autoSpeak) speak(label, { interrupt: false });
    },
    [autoSpeak]
  );

  const { onFrame, current } = useRecognizer({
    modelId,
    running: running && ready,
    threshold,
    onCommit,
    onError: setSnack,
  });

  const sentence = useMemo(() => buildSentence(words), [words]);

  const chooseModel = (id) => {
    setModelId(id);
    const m = models.find((x) => x.id === id);
    if (!m?.available) setRunning(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sentence);
      setSnack("Texto copiado");
    } catch {
      setSnack("Não foi possível copiar");
    }
  };

  const showCurrent = running && current && current.label !== REST_LABEL;

  const overlay = running && (
    <Box sx={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
      <Card elevation={0} sx={{ bgcolor: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)" }}>
        <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "error.main", animation: "pulse 1.4s infinite", flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              {showCurrent ? "A reconhecer:" : "A observar…"}
            </Typography>
            {showCurrent && (
              <>
                <Typography variant="subtitle1" fontWeight={600} noWrap>{displayLabel(current.label)}</Typography>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={current.confidence * 100}
                    color={current.confidence >= threshold ? "success" : "warning"}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">{Math.round(current.confidence * 100)}%</Typography>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <>
      {showGuide && (
        <WelcomeGuide
          onClose={() => setShowGuide(false)}
          onTry={() => { chooseModel("gestos"); setShowGuide(false); }}
          onTrain={() => { setShowGuide(false); onGoTrain(); }}
        />
      )}

      <Typography variant="overline" color="text.secondary">1 · O que quer reconhecer?</Typography>
      <Box sx={{ mt: 0.5, mb: 3 }}>
        <ModelPicker models={models} value={modelId} onChange={chooseModel} />
      </Box>

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "7fr 5fr" }, alignItems: "start" }}>
        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary" sx={{ mb: -1 }}>2 · Faça os sinais para a câmara</Typography>

          {model && !ready && model.id === "lsm" && (
            <Alert severity="info" action={<Button color="inherit" size="small" onClick={onGoTrain}>Treinar agora</Button>}>
              {model.summary}. Enquanto isso, experimente um dos modelos <b>prontos a usar</b>.
            </Alert>
          )}
          {model && !ready && model.id !== "lsm" && (
            <Alert severity="warning">
              Este modelo não foi descarregado. Volte a executar <code>docker compose up --build</code> com Internet.
            </Alert>
          )}

          <CameraView onFrame={onFrame} overlay={overlay} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <Button
              variant="contained"
              size="large"
              disabled={!ready}
              color={running ? "error" : "primary"}
              startIcon={running ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
              onClick={() => setRunning((r) => !r)}
              sx={{ minWidth: 220, py: 1.4 }}
            >
              {running ? "Pausar tradução" : "Iniciar tradução"}
            </Button>
            <Typography variant="body2" color="text.secondary">{TIPS[modelId]}</Typography>
          </Stack>

          {model && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Sinais que pode fazer com “{model.name}”
                </Typography>
                {model.signs.length ? (
                  <SignChips model={model} />
                ) : (
                  <Typography variant="body2" color="text.secondary">Ainda nenhum — grave sinais na aba Treinar.</Typography>
                )}
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5 }}>
                  <InfoOutlinedIcon fontSize="small" color="action" sx={{ mt: "1px" }} />
                  <Typography variant="caption" color="text.secondary">{model.origin}</Typography>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary" sx={{ mb: -1 }}>3 · Leia ou ouça a tradução</Typography>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Transcrição em português</Typography>
                <Chip size="small" label={`${words.length} sina${words.length === 1 ? "l" : "is"}`} />
              </Stack>
              <Box
                aria-live="polite"
                sx={{ minHeight: 180, maxHeight: 320, overflowY: "auto", p: 2, borderRadius: 2, bgcolor: "action.hover" }}
              >
                {sentence ? (
                  <Typography variant="h4" component="p" sx={{ fontWeight: 500, lineHeight: 1.35, wordBreak: "break-word" }}>
                    {sentence}
                  </Typography>
                ) : (
                  <Typography color="text.secondary">Os sinais reconhecidos aparecem aqui…</Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<VolumeUpRoundedIcon />}
                  disabled={!sentence || !speechSupported}
                  onClick={() => speak(sentence)}
                >
                  Ouvir
                </Button>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Espaço (separar palavras soletradas)">
                  <span>
                    <IconButton disabled={!words.length} onClick={() => setWords((w) => [...w, " "])}>
                      <SpaceBarRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Desfazer último sinal">
                  <span>
                    <IconButton disabled={!words.length} onClick={() => setWords((w) => w.slice(0, -1))}>
                      <UndoRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Copiar texto">
                  <span>
                    <IconButton disabled={!sentence} onClick={copy}><ContentCopyRoundedIcon /></IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Limpar tudo">
                  <span>
                    <IconButton disabled={!words.length} onClick={() => setWords([])}><DeleteSweepOutlinedIcon /></IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2">Preferências</Typography>
              <FormControlLabel
                sx={{ display: "flex", mt: 0.5 }}
                control={<Switch checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} disabled={!speechSupported} />}
                label="Ler cada sinal em voz alta"
              />
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" gutterBottom>
                Confiança mínima: <b>{Math.round(threshold * 100)}%</b>
              </Typography>
              <Slider
                value={threshold}
                min={0.35}
                max={0.9}
                step={0.05}
                onChange={(_, v) => setThreshold(v)}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
              />
              <Typography variant="caption" color="text.secondary">
                Mais alto = menos erros, mas pode ignorar sinais. Mais baixo = mais sensível.
              </Typography>
              {!speechSupported && (
                <Alert severity="warning" sx={{ mt: 2 }}>Este navegador não suporta síntese de voz.</Alert>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack("")} message={snack} />
    </>
  );
}
