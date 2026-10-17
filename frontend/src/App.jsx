import { useCallback, useEffect, useState } from "react";
import { Alert, AppBar, Box, Container, IconButton, Tab, Tabs, Toolbar, Tooltip, Typography } from "@mui/material";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import SignLanguageRoundedIcon from "@mui/icons-material/SignLanguageRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import TranslatePage from "./pages/TranslatePage";
import TrainPage from "./pages/TrainPage";
import { api } from "./lib/api";

// localStorage pode falhar (modo privado, etc.) — a app funciona na mesma
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
};

export default function App() {
  const [tab, setTab] = useState(0);
  const [vocab, setVocab] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);
  const [models, setModels] = useState([]);
  const [modelId, setModelIdState] = useState(store.get("lsm_model"));
  const [showGuide, setShowGuideState] = useState(store.get("lsm_guide_seen") !== "1");
  const [offline, setOffline] = useState(false);

  const setModelId = (id) => {
    setModelIdState(id);
    store.set("lsm_model", id);
  };
  const setShowGuide = (v) => {
    setShowGuideState(v);
    if (!v) store.set("lsm_guide_seen", "1");
  };

  const refresh = useCallback(async () => {
    try {
      const [v, m, ms] = await Promise.all([api.vocabulary(), api.model(), api.models()]);
      setVocab(v);
      setModelStatus(m);
      setModels(ms);
      setOffline(false);
      // escolha inicial: o modelo LSM se já existir, senão os gestos prontos
      setModelIdState((cur) => cur || (ms.find((x) => x.id === "lsm")?.available ? "lsm" : "gestos"));
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="primary" elevation={0}>
        <Toolbar sx={{ gap: 1.5 }}>
          <SignLanguageRoundedIcon />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={600} lineHeight={1.2} noWrap>LSM Tradutor</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }} noWrap>
              Língua de Sinais de Moçambique → texto e voz em português
            </Typography>
          </Box>
          <Tooltip title="Como começar">
            <IconButton color="inherit" onClick={() => { setTab(0); setShowGuideState(true); }}>
              <HelpOutlineRoundedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: "#F2A93B", height: 3 } }}
          sx={{ px: { sm: 2 } }}
        >
          <Tab icon={<TranslateRoundedIcon />} iconPosition="start" label="Traduzir" />
          <Tab icon={<SchoolOutlinedIcon />} iconPosition="start" label="Treinar sinais" />
        </Tabs>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {offline && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Não foi possível ligar ao servidor. Confirme que o backend está a correr.
          </Alert>
        )}
        {/* só uma página montada de cada vez → só uma câmara aberta */}
        {tab === 0 && (
          <TranslatePage
            models={models}
            modelId={modelId}
            setModelId={setModelId}
            showGuide={showGuide}
            setShowGuide={setShowGuide}
            onGoTrain={() => setTab(1)}
          />
        )}
        {tab === 1 && <TrainPage vocab={vocab} modelStatus={modelStatus} refresh={refresh} />}
      </Container>
    </Box>
  );
}
