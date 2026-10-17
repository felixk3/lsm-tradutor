import { useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, LinearProgress, Stack, Tooltip, Typography,
} from "@mui/material";
import ModelTrainingRoundedIcon from "@mui/icons-material/ModelTrainingRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import { api, REST_LABEL } from "../lib/api";

function Stat({ label, value }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="h5" fontWeight={600} noWrap>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export default function ModelCard({ vocab, modelStatus, onChanged, onTrained, notify }) {
  const [training, setTraining] = useState(false);
  const fileRef = useRef(null);

  const signs = vocab.filter((v) => v.label !== REST_LABEL);
  const trained = signs.filter((v) => v.trained).length;
  const coverage = signs.length ? Math.round((trained / signs.length) * 100) : 0;
  const totalSamples = vocab.reduce((a, v) => a + v.samples, 0);
  const acc = modelStatus?.accuracy;
  const pending = signs.filter((v) => v.samples >= 3 && !v.trained).length;

  const train = async () => {
    setTraining(true);
    try {
      const r = await api.train();
      const accTxt = r.accuracy != null ? ` · precisão estimada ${Math.round(r.accuracy * 100)}%` : "";
      notify(`Modelo treinado com ${r.classes.length} sinais${accTxt}`);
      if (r.skipped?.length) notify(`Ignorados (menos de ${modelStatus?.min_samples ?? 3} amostras): ${r.skipped.join(", ")}`);
      await onChanged();
      onTrained?.();
    } catch (e) {
      notify(e.message);
    } finally {
      setTraining(false);
    }
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const r = await api.importDataset(file);
      notify(`${r.imported} amostras importadas. Treine o modelo para as usar.`);
      await onChanged();
    } catch (err) {
      notify(err.message);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="overline" color="text.secondary">Modelo</Typography>
          <Typography variant="caption" color="text.secondary">
            {modelStatus?.ready ? `Atualizado ${modelStatus.trained_at}` : "Não treinado"}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ my: 1.5 }}>
          <Stat label="Sinais reconhecidos" value={`${trained}/${signs.length}`} />
          <Stat label="Precisão estimada" value={acc != null ? `${Math.round(acc * 100)}%` : "—"} />
          <Stat label="Amostras gravadas" value={totalSamples} />
        </Stack>

        <Typography variant="body2" gutterBottom>Cobertura do vocabulário: <b>{coverage}%</b></Typography>
        <LinearProgress variant="determinate" value={coverage} sx={{ height: 8, borderRadius: 4, mb: 2 }} />

        {modelStatus?.outdated && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>A app foi atualizada: treine o modelo de novo (as gravações mantêm-se).</Alert>
        )}
        {!modelStatus?.outdated && pending > 0 && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            {pending} sina{pending === 1 ? "l gravado ainda não faz" : "is gravados ainda não fazem"} parte do modelo — clique em Treinar modelo.
          </Alert>
        )}
        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<ModelTrainingRoundedIcon />}
          onClick={train}
          disabled={training}
        >
          {training ? "A treinar…" : "Treinar modelo"}
        </Button>
        {training && <LinearProgress sx={{ mt: 1 }} />}

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Tooltip title="Descarregar todas as amostras (para partilhar ou treinar no Colab)">
            <Button fullWidth size="small" startIcon={<FileDownloadOutlinedIcon />} href={api.exportUrl}>
              Exportar dados
            </Button>
          </Tooltip>
          <Tooltip title="Juntar amostras gravadas noutro computador">
            <Button fullWidth size="small" startIcon={<FileUploadOutlinedIcon />} onClick={() => fileRef.current?.click()}>
              Importar dados
            </Button>
          </Tooltip>
          <input ref={fileRef} type="file" accept=".zip" hidden onChange={importFile} />
        </Stack>
      </CardContent>
    </Card>
  );
}
