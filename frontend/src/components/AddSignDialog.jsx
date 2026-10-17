import { useState } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField,
} from "@mui/material";

export default function AddSignDialog({ open, categories, onClose, onSave }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Personalizado");

  const save = async () => {
    const ok = await onSave(label.trim(), category);
    if (ok) {
      setLabel("");
      onClose();
    }
  };

  const options = Array.from(new Set([...categories, "Personalizado"])).filter((c) => c !== "Sistema");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Novo sinal</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label="Palavra ou expressão em português"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && label.trim() && save()}
            inputProps={{ maxLength: 60 }}
            fullWidth
          />
          <TextField select label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
            {options.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!label.trim()} onClick={save}>Adicionar</Button>
      </DialogActions>
    </Dialog>
  );
}
