import { Box, ButtonBase, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import WavingHandOutlinedIcon from "@mui/icons-material/WavingHandOutlined";
import AbcRoundedIcon from "@mui/icons-material/AbcRounded";
import NumbersRoundedIcon from "@mui/icons-material/NumbersRounded";
import SignLanguageRoundedIcon from "@mui/icons-material/SignLanguageRounded";

const ICONS = {
  gestos: WavingHandOutlinedIcon,
  letras: AbcRoundedIcon,
  numeros: NumbersRoundedIcon,
  lsm: SignLanguageRoundedIcon,
};

function badge(m) {
  if (m.kind === "pronto") return m.available ? { label: "Pronto a usar", color: "success" } : { label: "Indisponível", color: "default" };
  return m.available ? { label: "Treinado por si", color: "primary" } : { label: "Precisa de treino", color: "warning" };
}

/** Escolha do modelo de reconhecimento, em mosaico. */
export default function ModelPicker({ models, value, onChange, disabled }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
      {models.map((m) => {
        const Icon = ICONS[m.id] || SignLanguageRoundedIcon;
        const selected = m.id === value;
        const b = badge(m);
        return (
          <ButtonBase
            key={m.id}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            aria-pressed={selected}
            sx={(t) => ({
              display: "block",
              textAlign: "left",
              p: 1.75,
              borderRadius: 3,
              bgcolor: selected ? alpha(t.palette.primary.main, 0.08) : "background.paper",
              border: "2px solid",
              borderColor: selected ? "primary.main" : "divider",
              transition: "border-color .15s, background-color .15s",
              opacity: !m.available && !selected ? 0.75 : 1,
              "&:hover": { borderColor: selected ? "primary.main" : "text.disabled" },
            })}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Icon color={selected ? "primary" : "action"} />
              <Chip size="small" label={b.label} color={b.color} variant={selected ? "filled" : "outlined"} />
            </Stack>
            <Typography fontWeight={600} lineHeight={1.25}>{m.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {m.summary}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

/** Lista dos sinais que o modelo escolhido reconhece. */
export function SignChips({ model }) {
  if (!model?.signs?.length) return null;
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
      {model.signs.map((s) =>
        s.hint ? (
          <Tooltip key={s.label} title={s.hint}>
            <Chip size="small" variant="outlined" label={<span><b>{s.label}</b> · {s.hint.toLowerCase()}</span>} />
          </Tooltip>
        ) : (
          <Chip key={s.label} size="small" variant="outlined" label={s.label} />
        )
      )}
    </Stack>
  );
}
