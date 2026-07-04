import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCw } from "lucide-react";

// Captura uma selfie (foto do rosto) usando a câmera frontal do dispositivo.
// Requer contexto seguro (HTTPS ou localhost) para o getUserMedia funcionar.
// Chama onCapture com a data URL (JPEG) quando o usuário captura, e onCapture(null)
// ao refazer.
export default function SelfieCapture({
  onCapture,
}: {
  onCapture: (dataUrl: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-media");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError(
        "Não foi possível acessar a câmera. Permita o acesso à câmera e tente novamente."
      );
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCaptured(dataUrl);
    onCapture(dataUrl);
    stopStream();
  };

  const handleRetake = () => {
    setCaptured(null);
    onCapture(null);
    startCamera();
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        {captured ? (
          <img
            src={captured}
            alt={"Selfie capturada"}
            className="mx-auto max-h-72 w-auto"
          />
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm text-slate-200">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="mx-auto max-h-72 w-auto"
          />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap justify-center gap-2">
        {captured ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-full bg-white"
            onClick={handleRetake}
          >
            <RotateCw className="h-4 w-4" />
            {"Refazer foto"}
          </Button>
        ) : error ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-full bg-white"
            onClick={startCamera}
          >
            <Camera className="h-4 w-4" />
            {"Tentar novamente"}
          </Button>
        ) : (
          <Button
            type="button"
            className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={starting}
            onClick={handleCapture}
          >
            <Camera className="h-4 w-4" />
            {starting ? "Iniciando câmera..." : "Capturar foto"}
          </Button>
        )}
      </div>
    </div>
  );
}
