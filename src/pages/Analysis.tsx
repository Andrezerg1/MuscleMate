import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, CameraOff, AlertTriangle, CheckCircle2, XCircle, Loader2, Play, Square, Eye, ClipboardList, X } from "lucide-react";
import { exercises } from "@/lib/exercises";
import {
  type FeedbackResult,
  exerciseAnalyzers,
  SKELETON_CONNECTIONS,
  KEYPOINTS,
  RepCounter,
  type RepPhase,
  positionCheckers,
  type PositionCheck,
} from "@/lib/poseUtils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import type { PoseDetector, Keypoint } from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

interface WorkoutSession {
  id: string;
  exercise_name: string;
  reps: number;
  correct_reps: number;
  warning_reps: number;
  error_reps: number;
  duration_seconds: number;
  created_at: string;
}

interface SeriesReport {
  exerciseName: string;
  reps: number;
  correct: number;
  warning: number;
  error: number;
  duration: number;
  accuracy: number;
  summary: string;
  points: { message: string; count: number }[];
}


const AnalysisPage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [report, setReport] = useState<SeriesReport | null>(null);
  const [seriesActive, setSeriesActive] = useState(false);
  const [phase, setPhase] = useState<RepPhase>("top");
  const [depth, setDepth] = useState(0);
  const [position, setPosition] = useState<PositionCheck | null>(null);
  const repCounterRef = useRef(new RepCounter(exercises[0].id));
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const detectorRef = useRef<PoseDetector | null>(null);
  const selectedExerciseRef = useRef(selectedExercise);
  const issuesRef = useRef<Record<string, number>>({});

  const repFeedbacksRef = useRef<FeedbackResult[]>([]);
  const seriesActiveRef = useRef(false);
  const statsRef = useRef({ reps: 0, correct: 0, warning: 0, error: 0 });
  const seriesStartRef = useRef(0);
  const positionOkRef = useRef(true);
  const { user } = useAuth();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [savingSeries, setSavingSeries] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("workout_sessions")
      .select("id, exercise_name, reps, correct_reps, warning_reps, error_reps, duration_seconds, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory(data ?? []);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Keep ref in sync
  useEffect(() => {
    selectedExerciseRef.current = selectedExercise;
    repCounterRef.current.reset(selectedExercise.id);
    setPhase("top");
    setDepth(0);
    setPosition(null);
  }, [selectedExercise]);

  useEffect(() => {
    seriesActiveRef.current = seriesActive;
  }, [seriesActive]);

  const resetSeriesState = useCallback(() => {
    setSeriesActive(false);
    setRepCount(0);
    repFeedbacksRef.current = [];
    repCounterRef.current.reset(selectedExerciseRef.current.id);
    setPhase("top");
    setDepth(0);
    statsRef.current = { reps: 0, correct: 0, warning: 0, error: 0 };
  }, []);

  const startSeries = useCallback(() => {
    if (!positionOkRef.current) {
      toast.info("Você pode treinar, mas só contamos repetições na posição correta.");
    }

    setReport(null);
    issuesRef.current = {};
    setRepCount(0);
    repCounterRef.current.reset(selectedExerciseRef.current.id);
    setPhase("top");
    setDepth(0);
    repFeedbacksRef.current = [];
    statsRef.current = { reps: 0, correct: 0, warning: 0, error: 0 };
    seriesStartRef.current = Date.now();
    setSeriesActive(true);
  }, []);

  const stopSeries = useCallback(async () => {
    const stats = { ...statsRef.current };
    const wasActive = seriesActiveRef.current;
    const exercise = selectedExerciseRef.current;
    const issues = { ...issuesRef.current };
    const duration = seriesStartRef.current
      ? Math.round((Date.now() - seriesStartRef.current) / 1000)
      : 0;
    resetSeriesState();

    if (!wasActive) return;

    const totalAttempts = stats.reps + stats.error;
    const points = Object.entries(issues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([message, count]) => ({ message, count }));

    const accuracy = totalAttempts > 0 ? Math.round((stats.correct / totalAttempts) * 100) : 0;
    let summary: string;
    if (totalAttempts === 0) {
      summary = "Nenhum movimento completo foi detectado nesta série.";
    } else if (points.length === 0) {
      summary = "Execução consistente do início ao fim — mantenha esse padrão.";
    } else if (accuracy >= 70) {
      summary = "Boa série: a base está correta, ajuste os pontos abaixo para refinar a técnica.";
    } else {
      summary = "A técnica oscilou bastante. Reduza a carga e a velocidade para corrigir os pontos abaixo.";
    }

    setReport({
      exerciseName: exercise.name,
      reps: stats.reps,
      correct: stats.correct,
      warning: stats.warning,
      error: stats.error,
      duration,
      accuracy,
      summary,
      points,
    });

    if (stats.reps === 0 || !user) return;

    setSavingSeries(true);
    const { error } = await supabase.from("workout_sessions").insert({
      user_id: user.id,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      reps: stats.reps,
      correct_reps: stats.correct,
      warning_reps: stats.warning,
      error_reps: stats.error,
      duration_seconds: duration,
      notes: points.length ? points.map((p) => `${p.message} (${p.count}x)`).join(" | ") : null,
    });
    setSavingSeries(false);

    if (error) {
      toast.error("Não foi possível salvar a série.");
      return;
    }
    toast.success(`Série salva: ${stats.reps} repetições`);
    loadHistory();
  }, [user, resetSeriesState, loadHistory]);




  const loadModel = useCallback(async () => {
    if (detectorRef.current) return;
    setModelLoading(true);

    try {
      await tf.setBackend("webgl");
      await tf.ready();

      // Thunder is more accurate but heavier — use Lightning on mobile devices
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: isMobile
            ? poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
            : poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
          enableSmoothing: true,
          minPoseScore: 0.3,
        }
      );

      detectorRef.current = detector;
      setModelReady(true);
    } catch (err) {
      console.error("Erro ao carregar modelo:", err);
      alert("Erro ao carregar o modelo de detecção de pose. Tente recarregar a página.");
    } finally {
      setModelLoading(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("secure-context");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: { ideal: "user" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await loadModel();
      setCameraActive(true);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const name = error instanceof DOMException ? error.name : "";
      const message = name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "A permissão da câmera foi bloqueada. Autorize o acesso nas configurações do navegador e tente novamente."
        : name === "NotFoundError"
          ? "Nenhuma câmera foi encontrada neste dispositivo."
          : error instanceof Error && error.message === "secure-context"
            ? "A câmera só funciona em uma conexão segura (HTTPS)."
            : "Não foi possível iniciar a câmera. Verifique se ela está disponível e tente novamente.";
      setCameraError(message);
    }
  }, [loadModel]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Main detection + draw loop
  useEffect(() => {
    if (!cameraActive || !detectorRef.current) return;

    let lastTime = performance.now();
    let frameCount = 0;

    const detect = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;
      if (!video || !canvas || !detector || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Mirror video
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      ctx.restore();

      try {
        const poses = await detector.estimatePoses(video);

        if (poses.length > 0 && poses[0].keypoints) {
          const keypoints = poses[0].keypoints;
          drawSkeleton(ctx, keypoints, canvas.width);

          const checker = positionCheckers[selectedExerciseRef.current.id];
          if (checker) {
            const check = checker(keypoints);
            setPosition(check);
            positionOkRef.current = check.ready;
          } else {
            setPosition(null);
            positionOkRef.current = true;
          }
          
          // Analyze exercise
          const analyzer = exerciseAnalyzers[selectedExerciseRef.current.id];
          if (analyzer) {
            const result = analyzer(keypoints);
            if (result) {
              setFeedback(result);
              drawFeedbackOverlay(ctx, result);

              // Rep state machine (hysteresis + smoothing)
              const rep = repCounterRef.current.update(result.angle);
              setPhase(rep.phase);
              setDepth(rep.progress);

              // Collect feedback belonging to the current rep
              if (rep.phase !== "top" || rep.reachedBottom) {
                repFeedbacksRef.current.push(result);
              }

              if (rep.repCompleted && seriesActiveRef.current) {
                const feedbacks = repFeedbacksRef.current;
                const errors = feedbacks.filter((f) => f.level === "error");
                const warnings = feedbacks.filter((f) => f.level === "warning");

                if (!positionOkRef.current) {
                  // Movimento fora da posição exigida — não valida a repetição
                  issuesRef.current["Posicionamento incorreto em relação à câmera"] =
                    (issuesRef.current["Posicionamento incorreto em relação à câmera"] ?? 0) + 1;
                  statsRef.current.error++;
                } else if (errors.length > 2) {
                  // Execução incorreta — não conta como repetição válida
                  issuesRef.current[errors[0].message] =
                    (issuesRef.current[errors[0].message] ?? 0) + 1;
                  statsRef.current.error++;
                } else {
                  if (warnings.length > 3) {
                    issuesRef.current[warnings[0].message] =
                      (issuesRef.current[warnings[0].message] ?? 0) + 1;
                    statsRef.current.warning++;
                  } else {
                    statsRef.current.correct++;
                  }
                  statsRef.current.reps++;
                  setRepCount((c) => c + 1);
                }
              }



              if (rep.repCompleted || (rep.phase === "top" && !rep.reachedBottom)) {
                repFeedbacksRef.current = [];
              }
            }
          }
        } else if (positionCheckers[selectedExerciseRef.current.id]) {
          setPosition(positionCheckers[selectedExerciseRef.current.id](null));
          positionOkRef.current = false;
        }
      } catch {
        // Silently continue on detection errors
      }

      // FPS counter
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [cameraActive, modelReady]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ─── Drawing helpers ──────────────────────────────────────
  function drawSkeleton(ctx: CanvasRenderingContext2D, keypoints: Keypoint[], canvasWidth: number) {
    // Draw connections
    ctx.lineWidth = 3;
    for (const [i, j] of SKELETON_CONNECTIONS) {
      const kpA = keypoints[i];
      const kpB = keypoints[j];
      if ((kpA.score ?? 0) > 0.3 && (kpB.score ?? 0) > 0.3) {
        ctx.beginPath();
        ctx.strokeStyle = "hsl(142, 72%, 50%)";
        ctx.moveTo(canvasWidth - kpA.x, kpA.y);
        ctx.lineTo(canvasWidth - kpB.x, kpB.y);
        ctx.stroke();
      }
    }

    // Draw keypoints
    for (const kp of keypoints) {
      if ((kp.score ?? 0) > 0.3) {
        ctx.beginPath();
        ctx.arc(canvasWidth - kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "hsl(142, 72%, 60%)";
        ctx.fill();
        ctx.strokeStyle = "hsl(220, 20%, 6%)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawFeedbackOverlay(ctx: CanvasRenderingContext2D, fb: FeedbackResult) {
    const color =
      fb.level === "correct" ? "#22c55e" : fb.level === "warning" ? "#eab308" : "#ef4444";

    // Background bar
    ctx.fillStyle = "rgba(14, 16, 20, 0.75)";
    ctx.fillRect(0, 0, 400, 50);

    ctx.fillStyle = color;
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillText(`${fb.joint}: ${Math.round(fb.angle)}°`, 15, 33);

    ctx.fillStyle = "rgba(14, 16, 20, 0.75)";
    ctx.fillRect(0, 50, 500, 35);

    ctx.fillStyle = color;
    ctx.font = "16px 'Inter', sans-serif";
    ctx.fillText(fb.message, 15, 72);
  }

  const phaseLabel =
    phase === "top"
      ? "Topo"
      : phase === "descending"
        ? "Descendo"
        : phase === "bottom"
          ? "Fundo"
          : "Subindo";

  const feedbackColor = feedback
    ? feedback.level === "correct"
      ? "text-success"
      : feedback.level === "warning"
        ? "text-warning"
        : "text-danger"
    : "text-muted-foreground";

  const FeedbackIcon = feedback
    ? feedback.level === "correct"
      ? CheckCircle2
      : feedback.level === "warning"
        ? AlertTriangle
        : XCircle
    : Camera;

  return (
    <main className="pt-28 pb-20">
      <div className="container mx-auto px-5 md:px-6 max-w-4xl">
        <div className="mb-6">
          <p className="eyebrow mb-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Sessão de treino</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Análise em tempo real</h1>
        </div>

        {/* Exercise selector */}
        <div className="-mx-5 px-5 md:mx-0 md:px-0 mb-5 overflow-x-auto">
          <div className="flex gap-2 w-max md:w-auto md:flex-wrap">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  setSelectedExercise(ex);
                  stopSeries();
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedExercise.id === ex.id
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "border border-border bg-card/80 text-secondary-foreground hover:bg-secondary"
                }`}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {/* Video feed */}
          <div className="relative rounded-3xl border border-border bg-card overflow-hidden aspect-[3/4] sm:aspect-video shadow-2xl shadow-black/20">
            <video ref={videoRef} className="hidden" playsInline muted />
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-cover ${!cameraActive ? "hidden" : ""}`}
            />

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                {modelLoading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-muted-foreground text-sm">Carregando modelo...</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/15">
                      <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground text-sm px-6 text-center">
                      {selectedExercise.cameraPosition}
                    </p>
                    {cameraError && <p className="max-w-sm px-6 text-center text-xs text-danger">{cameraError}</p>}
                  </>
                )}
              </div>
            )}




            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <button
                onClick={cameraActive ? stopCamera : startCamera}
                disabled={modelLoading}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm shadow-lg transition-all disabled:opacity-50 ${
                  cameraActive ? "bg-danger text-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {modelLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </>
                ) : cameraActive ? (
                  <>
                    <CameraOff className="w-4 h-4" /> Parar
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" /> Ativar câmera
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Essentials: feedback + reps */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="col-span-2 surface rounded-2xl p-4 md:p-5">
              {feedback ? (
                <div className={`flex items-start gap-2 ${feedbackColor}`}>
                  <FeedbackIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm leading-snug">{feedback.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {feedback.joint} {Math.round(feedback.angle)}°
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ative a câmera para receber feedback.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/[0.07] p-4 text-center">
              <p className="text-[10px] text-muted-foreground font-bold tracking-[0.14em]">REPS</p>
              <p className="font-display text-3xl font-extrabold text-primary leading-tight">
                {repCount}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-100"
                  style={{ width: `${Math.round(depth * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{phaseLabel}</p>
            </div>
          </div>

          {cameraActive && position && (
            <div
              className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs ${
                position.ready
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-warning/40 bg-warning/10 text-warning"
              }`}
            >
              <Eye className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-snug">
                {position.ready
                  ? position.message
                  : `${position.message} — repetições só são validadas na posição correta`}
              </p>
            </div>
          )}

          {cameraActive && (
            <button
              onClick={seriesActive ? stopSeries : startSeries}
              disabled={savingSeries}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all disabled:opacity-50 ${
                seriesActive
                  ? "bg-danger/15 text-danger"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {savingSeries ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando série...
                </>
              ) : seriesActive ? (
                <>
                  <Square className="w-4 h-4" /> Finalizar série
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Iniciar série
                </>
              )}
            </button>
          )}

          {report && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface rounded-2xl px-5 py-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Relatório da série — {report.exerciseName}</p>
                </div>
                <button
                  onClick={() => setReport(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fechar relatório"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-muted/55 py-2.5">
                  <p className="text-base font-bold">{report.reps}</p>
                  <p className="text-[10px] text-muted-foreground">Válidas</p>
                </div>
                <div className="rounded-xl bg-muted/55 py-2.5">
                  <p className="text-base font-bold text-success">{report.correct}</p>
                  <p className="text-[10px] text-muted-foreground">Perfeitas</p>
                </div>
                <div className="rounded-xl bg-muted/55 py-2.5">
                  <p className="text-base font-bold text-warning">{report.warning}</p>
                  <p className="text-[10px] text-muted-foreground">Com aviso</p>
                </div>
                <div className="rounded-xl bg-muted/55 py-2.5">
                  <p className="text-base font-bold text-danger">{report.error}</p>
                  <p className="text-[10px] text-muted-foreground">Inválidas</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Duração: {report.duration}s · Precisão técnica: {report.accuracy}%
              </p>

              <p className="text-sm leading-snug">{report.summary}</p>

              {report.points.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pontos de melhoria
                  </p>
                  <ul className="space-y-1.5">
                    {report.points.map((p) => (
                      <li key={p.message} className="flex items-start gap-2 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                        <span className="leading-snug">
                          {p.message}
                          <span className="text-muted-foreground"> — ocorreu {p.count}x</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}


          {history.length > 0 && (
            <div className="surface rounded-2xl px-5 py-4">
              <p className="text-sm font-medium mb-2">Últimas séries</p>
              <ul className="space-y-2">
                {history.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{s.exercise_name}</span>
                    <span className="text-muted-foreground font-mono">
                      {s.reps} reps · {s.correct_reps}✓ {s.warning_reps}! {s.error_reps}✕
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Details, collapsed by default */}
          <details className="surface rounded-2xl px-5 py-4">
            <summary className="text-sm font-medium cursor-pointer select-none">
              Detalhes do exercício
            </summary>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{selectedExercise.cameraPosition}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedExercise.correctCriteria}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {selectedExercise.angleRange.joint} {selectedExercise.angleRange.min}°–
                {selectedExercise.angleRange.max}° · {modelReady ? "MoveNet pronto" : "Modelo não carregado"}
                {cameraActive ? ` · ${fps} FPS` : ""}
              </p>
            </div>
          </details>
        </div>
      </div>
    </main>
  );
};

export default AnalysisPage;
