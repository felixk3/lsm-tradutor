import { Box, Button, Card, CardContent, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";

function Path({ icon, step, title, text, action, onAction, variant }) {
  return (
    <Box
      sx={(t) => ({
        flex: 1,
        p: 2,
        borderRadius: 2.5,
        bgcolor: alpha(t.palette.primary.main, 0.05),
        display: "flex",
        flexDirection: "column",
        gap: 1,
      })}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Typography variant="overline" color="text.secondary" lineHeight={1}>{step}</Typography>
      </Stack>
      <Typography variant="h6" fontWeight={600} lineHeight={1.2}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{text}</Typography>
      <Box><Button variant={variant} onClick={onAction}>{action}</Button></Box>
    </Box>
  );
}

/** Guia de boas-vindas: as duas formas de usar a app. */
export default function WelcomeGuide({ onTry, onTrain, onClose }) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={600}>Bem-vindo ao LSM Tradutor</Typography>
            <Typography color="text.secondary">
              A câmara lê os sinais das mãos, escreve-os em português e lê-os em voz alta. Há duas formas de começar:
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Fechar guia"><CloseRoundedIcon /></IconButton>
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Path
            icon={<BoltRoundedIcon color="success" />}
            step="Agora mesmo · sem treino"
            title="Experimentar já"
            text="Use os modelos prontos: gestos comuns, alfabeto A–Z e números 0–9. Vêm de dados de outros países (não são LSM), mas mostram a app a funcionar e a tradução sai em português."
            action="Experimentar com gestos"
            variant="contained"
            onAction={onTry}
          />
          <Path
            icon={<SchoolRoundedIcon color="primary" />}
            step="Com um intérprete ou pessoa surda"
            title="Ensinar a LSM"
            text="Na aba Treinar sinais, um profissional grava cada sinal da Língua de Sinais de Moçambique (cerca de 1 minuto por sinal). Treine com um clique e teste logo ali, ao vivo."
            action="Começar a treinar"
            variant="outlined"
            onAction={onTrain}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
