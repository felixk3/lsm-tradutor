import { useEffect, useRef, useState } from "react";
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PanToolAltOutlinedIcon from "@mui/icons-material/PanToolAltOutlined";
import VideocamOffOutlinedIcon from "@mui/icons-material/VideocamOffOutlined";
import { drawHands, getHandTracker, toFrame } from "../lib/handTracker";

/**
 * Mostra a câmara, deteta as mãos com MediaPipe e chama `onFrame(frame)` em cada frame.
 * `overlay` é desenhado por cima do vídeo (contagem, estado, etc.).
 */
export default function CameraView({ onFrame, overlay, active = true }) {
  const theme = useTheme();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [handsCount, setHandsCount] = useState(0);

  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!active) return undefined;
    let stream;
    let raf;
    let stopped = false;
    let lastVideoTime = -1;
    let lastCount = -1;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "O navegador bloqueou a câmara. Abra a app em http://localhost ou via HTTPS."
          );
        }
        const [landmarker, s] = await Promise.all([
          getHandTracker(),
          navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" },
            audio: false,
          }),
        ]);
        stream = s;
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus("ready");

        const ctx = canvasRef.current.getContext("2d");
        const colors = { line: theme.palette.secondary.main, point: "#ffffff" };

        const loop = () => {
          if (stopped) return;
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const canvas = canvasRef.current;
            if (canvas.width !== video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            const now = performance.now();
            const result = landmarker.recognizeForVideo(video, now);
            drawHands(ctx, result, colors);
            const frame = toFrame(result, now, video.videoWidth / video.videoHeight);
            if (frame.hands.length !== lastCount) {
              lastCount = frame.hands.length;
              setHandsCount(lastCount);
            }
            onFrameRef.current?.(frame);
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        if (stopped) return;
        setStatus("error");
        setError(
          e?.name === "NotAllowedError"
            ? "Permissão da câmara negada. Autorize o acesso nas definições do navegador."
            : e?.message || "Não foi possível iniciar a câmara."
        );
      }
    }
    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, theme]);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        bgcolor: "grey.900",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      {/* espelhado, como um espelho — mais natural para quem sinaliza */}
      <Box
        component="video"
        ref={videoRef}
        playsInline
        muted
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />

      {status === "loading" && (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ position: "absolute", inset: 0, color: "grey.300" }}>
          <CircularProgress color="inherit" />
          <Typography variant="body2">A iniciar câmara e detetor de mãos…</Typography>
        </Stack>
      )}

      {status === "error" && (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ position: "absolute", inset: 0, p: 3 }}>
          <VideocamOffOutlinedIcon sx={{ fontSize: 48, color: "grey.500" }} />
          <Alert severity="error" sx={{ maxWidth: 420 }}>{error}</Alert>
        </Stack>
      )}

      {status === "ready" && (
        <Chip
          icon={<PanToolAltOutlinedIcon />}
          label={handsCount ? `${handsCount} mão${handsCount > 1 ? "s" : ""} detetada${handsCount > 1 ? "s" : ""}` : "Mostre as mãos"}
          size="small"
          color={handsCount ? "success" : "default"}
          sx={{ position: "absolute", top: 12, left: 12, bgcolor: handsCount ? undefined : "rgba(255,255,255,.85)" }}
        />
      )}

      {status === "ready" && overlay}
    </Box>
  );
}
