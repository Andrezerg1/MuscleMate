import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, CameraOff, AlertTriangle, CheckCircle2, XCircle, Loader2, Play, Square, Eye, ClipboardList, X, Upload, Film } from "lucide-react";
import { exercises } from "@/lib/exercises";
import { CurlCounter } from '@/lib/curlCounter';
import { SquatCounter, SQUAT_VIEWS, checkSquatView, type SquatView } from '@/lib/squatCounter';
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
import { buildSeriesReport, buildWorkoutReport, workoutNotes, type SeriesReport, type WorkoutReport } from '@/lib/workoutSession';
import { applyPostureResults, loadGuestWorkouts, saveGuestWorkouts } from '@/lib/trainingLog';
import { Link, useSearchParams } from 'react-router-dom';

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
  notes: string | null;
  created_at: string;
}

interface ExerciseVideoHistory {
  id: string;
  file_name: string;
  size_bytes: number;
  video_duration_seconds: number;
  reps: number;
  correct_reps: number;
  warning_reps: number;
  error_reps: number;
  created_at: string;
  signedUrl: string;
}

type AnalysisSource = 'camera' | 'video' | null;

const AnalysisPage = () => {
  const [searchParams] = useSearchParams();
  const requestedExercise = searchParams.get('exercise');
  const trainingExerciseId = searchParams.get('trainingExerciseId');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>(null);
  const analysisSourceRef = useRef<AnalysisSource>(null);
  const uploadedVideoRef = useRef<File | null>(null);
  const uploadedVideoUrlRef = useRef<string | null>(null);
  const [uploadedVideoName, setUploadedVideoName] = useState<string | null>(null);
  const [videoAwaitingNext, setVideoAwaitingNext] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState(() => exercises.find(exercise=>exercise.id===requestedExercise) ?? exercises[0]);
  const [squatView, setSquatView] = useState<SquatView>('side');
  const squatViewRef = useRef<SquatView>('side');
  const squatCounterRef = useRef(new SquatCounter());
  const squatEpochRef = useRef(0);
  const [squatMetric, setSquatMetric] = useState('Aguardando enquadramento');
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [report, setReport] = useState<SeriesReport | null>(null);
  const [workoutReport, setWorkoutReport] = useState<WorkoutReport | null>(null);
  const [plannedSeries, setPlannedSeries] = useState(() => Math.max(1,Math.min(8,Number(searchParams.get('series'))||3)));
  const [completedSeries, setCompletedSeries] = useState<SeriesReport[]>([]);
  const completedSeriesRef = useRef<SeriesReport[]>([]);
  const workoutStartRef = useRef(0);
  const [seriesActive, setSeriesActive] = useState(false);
  const [phase, setPhase] = useState<RepPhase>("top");
  const [depth, setDepth] = useState(0);
  const [position, setPosition] = useState<PositionCheck | null>(null);
  const repCounterRef = useRef(new RepCounter(exercises[0].id));
  const curlCounterRef = useRef(new CurlCounter());
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
  const [videoHistory, setVideoHistory] = useState<ExerciseVideoHistory[]>([]);
  const [videoHistoryLoading, setVideoHistoryLoading] = useState(false);
  const [savingSeries, setSavingSeries] = useState(false);
  const workoutInProgress = seriesActive || completedSeries.length > 0;

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("workout_sessions")
      .select("id, exercise_name, reps, correct_reps, warning_reps, error_reps, duration_seconds, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory(data ?? []);
  }, [user]);

  const loadVideoHistory = useCallback(async () => {
    if (!user) { setVideoHistory([]); return; }
    setVideoHistoryLoading(true);
    const { data, error } = await supabase
      .from('exercise_videos')
      .select('id,file_path,file_name,size_bytes,video_duration_seconds,reps,correct_reps,warning_reps,error_reps,created_at')
      .eq('exercise_id', selectedExercise.id)
      .order('created_at', { ascending: false })
      .limit(12);
    if (error || !data) {
      setVideoHistory([]);
      setVideoHistoryLoading(false);
      return;
    }
    const { data: signed } = await supabase.storage.from('exercise-videos').createSignedUrls(data.map(item => item.file_path), 3600);
    setVideoHistory(data.map((item, index) => ({ ...item, signedUrl: signed?.[index]?.signedUrl ?? '' })));
    setVideoHistoryLoading(false);
  }, [selectedExercise.id, user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadVideoHistory();
  }, [loadVideoHistory]);

  // Keep ref in sync
  useEffect(() => {
    selectedExerciseRef.current = selectedExercise;
    repCounterRef.current.reset(selectedExercise.id);
    curlCounterRef.current.reset();
    squatCounterRef.current.reset(squatViewRef.current);
    squatEpochRef.current++;
    setFeedback(null);
    setPhase("top");
    setDepth(0);
    setPosition(null);
  }, [selectedExercise]);

  useEffect(() => {
    seriesActiveRef.current = seriesActive;
  }, [seriesActive]);

  const resetSeriesState = useCallback(() => {
    seriesActiveRef.current = false;
    setSeriesActive(false);
    setRepCount(0);
    repFeedbacksRef.current = [];
    repCounterRef.current.reset(selectedExerciseRef.current.id);
    curlCounterRef.current.reset();
    squatCounterRef.current.reset(squatViewRef.current);
    squatEpochRef.current++;
    setPhase("top");
    setDepth(0);
    statsRef.current = { reps: 0, correct: 0, warning: 0, error: 0 };
  }, []);

  const startSeries = useCallback(() => {
    if (!positionOkRef.current) {
      toast.info("Você pode treinar, mas só contamos repetições na posição correta.");
    }

    setReport(null);
    setWorkoutReport(null);
    if (completedSeriesRef.current.length === 0) workoutStartRef.current = Date.now();
    issuesRef.current = {};
    setRepCount(0);
    repCounterRef.current.reset(selectedExerciseRef.current.id);
    curlCounterRef.current.reset();
    squatCounterRef.current.reset(squatViewRef.current);
    squatEpochRef.current++;
    setPhase("top");
    setDepth(0);
    repFeedbacksRef.current = [];
    statsRef.current = { reps: 0, correct: 0, warning: 0, error: 0 };
    seriesStartRef.current = Date.now();
    setSeriesActive(true);
    seriesActiveRef.current = true;
  }, []);

  const saveAnalyzedVideo = useCallback(async (seriesReport: SeriesReport) => {
    const file = uploadedVideoRef.current;
    if (!user || analysisSourceRef.current !== 'video' || !file) return true;

    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const filePath = `${user.id}/${selectedExerciseRef.current.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('exercise-videos').upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      toast.error('A análise foi concluída, mas o vídeo não pôde ser salvo. Verifique o formato ou o tamanho do arquivo.');
      return false;
    }

    const videoDuration = Number.isFinite(videoRef.current?.duration) ? Math.round(videoRef.current?.duration ?? 0) : 0;
    const { error: recordError } = await supabase.from('exercise_videos').insert({
      user_id: user.id,
      exercise_id: selectedExerciseRef.current.id,
      exercise_name: seriesReport.exerciseName,
      file_path: filePath,
      file_name: file.name,
      size_bytes: file.size,
      video_duration_seconds: videoDuration,
      analysis_duration_seconds: seriesReport.duration,
      reps: seriesReport.reps,
      correct_reps: seriesReport.correct,
      warning_reps: seriesReport.warning,
      error_reps: seriesReport.error,
    });
    if (recordError) {
      await supabase.storage.from('exercise-videos').remove([filePath]);
      toast.error('A análise foi concluída, mas não foi possível registrar o vídeo no histórico.');
      return false;
    }
    await loadVideoHistory();
    return true;
  }, [loadVideoHistory, user]);

  const finishWorkout = useCallback(async (series: SeriesReport[]) => {
    if (series.length === 0) return;
    const exercise = selectedExerciseRef.current;
    const exerciseName = exercise.id === 'squat' ? `${exercise.name} — ${SQUAT_VIEWS[squatViewRef.current].title}` : exercise.name;
    const duration = workoutStartRef.current ? Math.round((Date.now()-workoutStartRef.current)/1000) : series.reduce((sum,item)=>sum+item.duration,0);
    const finalReport = buildWorkoutReport(exerciseName, plannedSeries, series, duration);
    setWorkoutReport(finalReport);
    setCompletedSeries([]);
    completedSeriesRef.current = [];
    workoutStartRef.current = 0;

    if (trainingExerciseId) {
      if (user) {
        const { data: linkedSets } = await supabase.from('training_sets').select('id').eq('workout_exercise_id',trainingExerciseId).order('set_number');
        await Promise.all((linkedSets ?? []).map((set,index) => series[index] ? supabase.from('training_sets').update({
          actual_reps:series[index].reps,correct_reps:series[index].correct,warning_reps:series[index].warning,error_reps:series[index].error,completed:true,completed_at:new Date().toISOString(),
        }).eq('id',set.id) : Promise.resolve()));
      } else {
        saveGuestWorkouts(applyPostureResults(loadGuestWorkouts(),trainingExerciseId,series));
      }
    }

    if (!user) {
      toast.success(`Treino concluído: ${finalReport.completedSeries} ${finalReport.completedSeries === 1 ? 'série' : 'séries'}`);
      if (analysisSourceRef.current === 'video') toast.info('Entre na sua conta para manter o vídeo no histórico.');
      return;
    }

    setSavingSeries(true);
    const { error } = await supabase.from('workout_sessions').insert({
      user_id: user.id,
      exercise_id: exercise.id,
      exercise_name: exerciseName,
      reps: finalReport.reps,
      correct_reps: finalReport.correct,
      warning_reps: finalReport.warning,
      error_reps: finalReport.error,
      duration_seconds: finalReport.duration,
      notes: workoutNotes(finalReport),
    });
    setSavingSeries(false);
    if (error) {
      toast.error('O treino foi concluído, mas não foi possível salvá-lo no histórico.');
      return;
    }
    toast.success(`Treino salvo: ${finalReport.reps} repetições em ${finalReport.completedSeries} ${finalReport.completedSeries === 1 ? 'série' : 'séries'}`);
    loadHistory();
  }, [loadHistory, plannedSeries, trainingExerciseId, user]);

  const stopSeries = useCallback(async () => {
    const stats = { ...statsRef.current };
    const wasActive = seriesActiveRef.current;
    const exercise = selectedExerciseRef.current;
    const exerciseName = exercise.id === 'squat' ? `${exercise.name} — ${SQUAT_VIEWS[squatViewRef.current].title}` : exercise.name;
    const issues = { ...issuesRef.current };
    const duration = seriesStartRef.current
      ? Math.round((Date.now() - seriesStartRef.current) / 1000)
      : 0;
    resetSeriesState();

    if (!wasActive) return;

    const seriesNumber = completedSeriesRef.current.length + 1;
    const seriesReport = buildSeriesReport(exerciseName, seriesNumber, stats, duration, issues);
    const updatedSeries = [...completedSeriesRef.current, seriesReport];
    completedSeriesRef.current = updatedSeries;
    setCompletedSeries(updatedSeries);
    setReport(seriesReport);

    if (analysisSourceRef.current === 'video') {
      setSavingSeries(true);
      const videoSaved = await saveAnalyzedVideo(seriesReport);
      setSavingSeries(false);
      if (videoSaved && user) toast.success(`Vídeo da série ${seriesNumber} salvo no histórico`);
    }

    if (updatedSeries.length >= plannedSeries) await finishWorkout(updatedSeries);
    else {
      if (analysisSourceRef.current === 'video') setVideoAwaitingNext(true);
      toast.success(`Série ${seriesNumber} de ${plannedSeries} concluída`);
    }
  }, [finishWorkout, plannedSeries, resetSeriesState, saveAnalyzedVideo, user]);




  const loadModel = useCallback(async () => {
    if (detectorRef.current) return;
    setModelLoading(true);
    setModelError(null);

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
      setModelError("A câmera está ativa, mas o modelo de análise não carregou. Tente novamente em instantes.");
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
      if (uploadedVideoUrlRef.current) URL.revokeObjectURL(uploadedVideoUrlRef.current);
      uploadedVideoUrlRef.current = null;
      uploadedVideoRef.current = null;
      setUploadedVideoName(null);
      analysisSourceRef.current = 'camera';
      setAnalysisSource('camera');
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      await loadModel();
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
    squatCounterRef.current.reset(squatViewRef.current);
    squatEpochRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    }
    if (uploadedVideoUrlRef.current) URL.revokeObjectURL(uploadedVideoUrlRef.current);
    uploadedVideoUrlRef.current = null;
    uploadedVideoRef.current = null;
    setUploadedVideoName(null);
    setVideoAwaitingNext(false);
    analysisSourceRef.current = null;
    setAnalysisSource(null);
    setCameraActive(false);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const attachVideo = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      toast.error('Formato não suportado. Anexe um vídeo MP4, WebM ou MOV.');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error('O vídeo deve ter no máximo 200 MB.');
      return;
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    cancelAnimationFrame(animFrameRef.current);
    if (uploadedVideoUrlRef.current) URL.revokeObjectURL(uploadedVideoUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    uploadedVideoUrlRef.current = objectUrl;
    uploadedVideoRef.current = file;
    setUploadedVideoName(file.name);
    setCameraError(null);
    const continuingVideoWorkout = completedSeriesRef.current.length > 0;
    setReport(null);
    if (!continuingVideoWorkout) {
      setWorkoutReport(null);
      setCompletedSeries([]);
      completedSeriesRef.current = [];
    }
    resetSeriesState();
    analysisSourceRef.current = 'video';
    setAnalysisSource('video');
    setVideoAwaitingNext(false);

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.src = objectUrl;
      video.muted = true;
      video.currentTime = 0;
      video.load();
    }
    setCameraActive(true);
    await loadModel();
  }, [loadModel, resetSeriesState]);

  const startVideoAnalysis = useCallback(async () => {
    const video = videoRef.current;
    if (!video || analysisSourceRef.current !== 'video') return;
    video.currentTime = 0;
    startSeries();
    try {
      await video.play();
    } catch {
      resetSeriesState();
      toast.error('Não foi possível reproduzir o vídeo. Tente outro arquivo.');
    }
  }, [resetSeriesState, startSeries]);

  const finishVideoAnalysis = useCallback(async () => {
    videoRef.current?.pause();
    await stopSeries();
  }, [stopSeries]);

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

      const mirror = analysisSourceRef.current === 'camera';
      if (mirror) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0);
      }

      try {
        const exerciseId = selectedExerciseRef.current.id;
        const squatEpoch = squatEpochRef.current;
        const poses = await detector.estimatePoses(video);
        if (exerciseId !== selectedExerciseRef.current.id || squatEpoch !== squatEpochRef.current) {
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        }

        if (poses.length > 0 && poses[0].keypoints) {
          const keypoints = poses[0].keypoints;
          drawSkeleton(ctx, keypoints, canvas.width, mirror);

          const checker = exerciseId === 'squat'
            ? (points: Keypoint[] | null) => checkSquatView(points, squatViewRef.current)
            : positionCheckers[exerciseId];
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
            const curl = selectedExerciseRef.current.id === 'bicep-curl' ? curlCounterRef.current.update(keypoints) : null;
            const squat = exerciseId === 'squat' ? squatCounterRef.current.update(keypoints) : null;
            const tracked = squat ?? curl;
            if (squat) {
              setPosition(squat.position);
              positionOkRef.current = squat.position.ready;
              setSquatMetric(squat.metric);
            }
            const result = tracked ? tracked.feedback : analyzer(keypoints);
            if (result) {
              setFeedback(result);
              if (!tracked) drawFeedbackOverlay(ctx, result);

              // Rep state machine (hysteresis + smoothing)
              const rep = tracked ? tracked.rep : repCounterRef.current.update(result.angle);
              setPhase(rep.phase);
              setDepth(rep.progress);

              // Collect feedback belonging to the current rep
              if (!tracked && (rep.phase !== "top" || rep.reachedBottom)) {
                repFeedbacksRef.current.push(result);
              }

              if (tracked?.rejected && seriesActiveRef.current) {
                statsRef.current.error++;
                statsRef.current.reps++;
                setRepCount((count) => count + 1);
                issuesRef.current[result.message] = (issuesRef.current[result.message] ?? 0) + 1;
              }

              if (rep.repCompleted && seriesActiveRef.current) {
                statsRef.current.reps++;
                setRepCount((count) => count + 1);
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
                  if (squat?.warning || warnings.length > 3) {
                    const warningMessage = squat?.warning || warnings[0].message;
                    issuesRef.current[warningMessage] =
                      (issuesRef.current[warningMessage] ?? 0) + 1;
                    statsRef.current.warning++;
                  } else {
                    statsRef.current.correct++;
                  }
                }
              }



              if (rep.repCompleted || (rep.phase === "top" && !rep.reachedBottom)) {
                repFeedbacksRef.current = [];
              }
            }
          }
        } else if (positionCheckers[selectedExerciseRef.current.id]) {
          curlCounterRef.current.reset();
          const missingSquat = exerciseId === 'squat' ? squatCounterRef.current.update(null) : null;
          setPosition(exerciseId === 'squat' ? checkSquatView(null, squatViewRef.current) : positionCheckers[exerciseId](null));
          if (exerciseId === 'squat') {
            setFeedback(missingSquat!.feedback); setPhase(missingSquat!.rep.phase); setDepth(missingSquat!.rep.progress); setSquatMetric('Aguardando enquadramento');
          }
          positionOkRef.current = false;
        }
      } catch {
        curlCounterRef.current.reset();
        squatCounterRef.current.reset(squatViewRef.current);
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
  function drawSkeleton(ctx: CanvasRenderingContext2D, keypoints: Keypoint[], canvasWidth: number, mirror: boolean) {
    const drawX = (x: number) => mirror ? canvasWidth - x : x;
    // Draw connections
    ctx.lineWidth = 3;
    for (const [i, j] of SKELETON_CONNECTIONS) {
      const kpA = keypoints[i];
      const kpB = keypoints[j];
      if ((kpA.score ?? 0) > 0.3 && (kpB.score ?? 0) > 0.3) {
        ctx.beginPath();
        ctx.strokeStyle = "hsl(142, 72%, 50%)";
        ctx.moveTo(drawX(kpA.x), kpA.y);
        ctx.lineTo(drawX(kpB.x), kpB.y);
        ctx.stroke();
      }
    }

    // Draw keypoints
    for (const kp of keypoints) {
      if ((kp.score ?? 0) > 0.3) {
        ctx.beginPath();
        ctx.arc(drawX(kp.x), kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "hsl(142, 72%, 60%)";
        ctx.fill();
        ctx.strokeStyle = "hsl(220, 20%, 6%)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawFeedbackOverlay(ctx: CanvasRenderingContext2D, fb: FeedbackResult, metric?: string) {
    const color =
      fb.level === "correct" ? "#22c55e" : fb.level === "warning" ? "#eab308" : "#ef4444";

    // Background bar
    ctx.fillStyle = "rgba(14, 16, 20, 0.75)";
    ctx.fillRect(0, 0, ctx.canvas.width, 50);

    ctx.fillStyle = color;
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillText(metric || `${fb.joint}: ${Math.round(fb.angle)}°`, 15, 33, Math.max(1, ctx.canvas.width - 30));

    ctx.fillStyle = "rgba(14, 16, 20, 0.75)";
    ctx.fillRect(0, 50, ctx.canvas.width, 35);

    ctx.fillStyle = color;
    ctx.font = "16px 'Inter', sans-serif";
    ctx.fillText(fb.message, 15, 72, Math.max(1, ctx.canvas.width - 30));
  }

  const phaseLabel =
    selectedExercise.id === 'bicep-curl'
      ? phase === 'top' ? 'Braço estendido' : phase === 'descending' ? 'Contraindo' : 'Retornando à extensão'
      :
    phase === "top"
      ? selectedExercise.id === 'squat' ? 'Em pé' : "Topo"
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
          <h1 className="font-display text-3xl md:text-4xl font-bold">Análise de movimento</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use a câmera ao vivo ou anexe um vídeo já gravado.</p>
        </div>

        {/* Exercise selector */}
        <div className="-mx-5 px-5 md:mx-0 md:px-0 mb-5 overflow-x-auto">
          <div className="flex gap-2 w-max md:w-auto md:flex-wrap">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                disabled={workoutInProgress || savingSeries || cameraActive}
                onClick={() => { setSelectedExercise(ex); setReport(null); setWorkoutReport(null); }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedExercise.id === ex.id
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "border border-border bg-card/80 text-secondary-foreground hover:bg-secondary"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        <section className="surface mb-5 rounded-2xl p-4 md:p-5" aria-label="Configuração do treino">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Planejamento do treino</p>
              <p className="mt-1 text-xs text-muted-foreground">Escolha quantas séries deseja realizar neste exercício.</p>
            </div>
            <label className="flex items-center gap-3 text-xs font-medium">
              Quantidade de séries
              <select
                value={plannedSeries}
                disabled={workoutInProgress || savingSeries || analysisSource === 'video'}
                onChange={(event) => setPlannedSeries(Number(event.target.value))}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
              >
                {Array.from({ length: 8 }, (_, index) => index + 1).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2" aria-label={`${completedSeries.length} de ${plannedSeries} séries concluídas`}>
            {Array.from({ length: plannedSeries }, (_, index) => (
              <span key={index} className={`h-2 flex-1 rounded-full ${index < completedSeries.length ? 'bg-primary' : index === completedSeries.length && seriesActive ? 'bg-primary/45' : 'bg-secondary'}`} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {seriesActive ? `Série ${completedSeries.length + 1} de ${plannedSeries} em andamento` : completedSeries.length > 0 ? `${completedSeries.length} de ${plannedSeries} séries concluídas` : `Pronto para iniciar a série 1 de ${plannedSeries}`}
          </p>
        </section>

        {selectedExercise.id === 'squat' && (
          <section aria-label="Posição da câmera para o agachamento" className="mb-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {(['front', 'side'] as const).map(view => (
                <button key={view} type="button" aria-pressed={squatView === view}
                  disabled={seriesActive || savingSeries}
                  onClick={() => {
                    squatViewRef.current = view;
                    squatCounterRef.current.reset(view);
                    squatEpochRef.current++;
                    setSquatView(view); setFeedback(null); setPosition(null); setPhase('top'); setDepth(0);
                    setSquatMetric('Aguardando enquadramento'); positionOkRef.current = false;
                  }}
                  className={`rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed ${squatView === view ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:border-primary/30'}`}>
                  <span className="flex items-center justify-between gap-2 font-display font-bold">
                    {SQUAT_VIEWS[view].title}{squatView === view && <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-primary">{SQUAT_VIEWS[view].focus}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{SQUAT_VIEWS[view].description}</span>
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{SQUAT_VIEWS[squatView].limitation}</p>
            {seriesActive && <p className="text-xs text-muted-foreground">Finalize a série para trocar a posição da câmera.</p>}
          </section>
        )}

        <div className="space-y-5">
          {/* Video feed */}
          <div className="relative rounded-3xl border border-border bg-card overflow-hidden aspect-[3/4] sm:aspect-video shadow-2xl shadow-black/20">
            <video
              ref={videoRef}
              className={`h-full w-full object-contain ${analysisSource === 'camera' ? '-scale-x-100' : ''} ${!cameraActive || modelReady ? "hidden" : ""}`}
              playsInline
              muted
              onEnded={() => { if (analysisSourceRef.current === 'video' && seriesActiveRef.current) void finishVideoAnalysis(); }}
            />
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-cover ${!cameraActive || !modelReady ? "hidden" : ""}`}
            />

            {cameraActive && (modelLoading || modelError) && (
              <div className="absolute left-4 right-4 top-4 rounded-xl border border-border bg-background/85 px-4 py-3 text-center text-xs backdrop-blur-sm">
                {modelLoading ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Preparando análise de movimento...
                  </span>
                ) : (
                  <span className="text-danger">{modelError}</span>
                )}
              </div>
            )}

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
                      <Film className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground text-sm px-6 text-center">
                      {selectedExercise.id === 'squat' ? SQUAT_VIEWS[squatView].instruction : selectedExercise.cameraPosition}
                    </p>
                    <p className="text-xs text-muted-foreground">Escolha a captura ao vivo ou um vídeo gravado.</p>
                    {cameraError && <p className="max-w-sm px-6 text-center text-xs text-danger">{cameraError}</p>}
                  </>
                )}
              </div>
            )}




            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
              {cameraActive ? <>
                {analysisSource === 'video' && videoAwaitingNext && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={savingSeries}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" /> Anexar vídeo da série {completedSeries.length + 1}
                  </button>
                )}
                <button
                  onClick={stopCamera}
                  disabled={seriesActive || savingSeries}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-danger px-5 py-3 text-sm font-bold text-foreground shadow-lg transition-all disabled:opacity-50"
                >
                  <CameraOff className="w-4 h-4" /> {analysisSource === 'video' ? 'Remover vídeo' : 'Parar câmera'}
                </button>
              </> : <>
                <button
                  onClick={startCamera}
                  disabled={modelLoading}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-50"
                >
                  {modelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Ativar câmera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={modelLoading}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-primary/35 bg-background/90 px-5 py-3 text-sm font-bold text-primary shadow-lg backdrop-blur-sm disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" /> Anexar vídeo
                </button>
              </>}
              <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" className="hidden" onChange={event => void attachVideo(event)} />
            </div>
          </div>

          {analysisSource === 'video' && uploadedVideoName && (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-xs">
              <Film className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{uploadedVideoName}</span>
              <span className="shrink-0 text-muted-foreground">
                {videoAwaitingNext ? `Série ${completedSeries.length} concluída · anexe o próximo vídeo` : `Vídeo da série ${completedSeries.length + 1} de ${plannedSeries}`}
              </span>
            </div>
          )}

          {/* Essentials: feedback + reps */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="col-span-2 surface rounded-2xl p-4 md:p-5">
              {feedback ? (
                <div className={`flex items-start gap-2 ${feedbackColor}`}>
                  <FeedbackIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm leading-snug">{feedback.message}</p>
                    {!['bicep-curl', 'squat'].includes(selectedExercise.id) && <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedExercise.id === 'squat' ? squatMetric : `${feedback.joint} ${Math.round(feedback.angle)}°`}
                    </p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ative a câmera ou anexe um vídeo para receber feedback.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/[0.07] p-4 text-center">
              <p className="text-[10px] text-muted-foreground font-bold tracking-[0.14em]">{selectedExercise.id === 'squat' && squatView === 'front' ? 'CICLOS ALINHADOS' : 'REPS'}</p>
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

          {cameraActive && position && !['bicep-curl', 'squat'].includes(selectedExercise.id) && (
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

          {cameraActive && !videoAwaitingNext && (
            <button
              onClick={seriesActive ? (analysisSource === 'video' ? finishVideoAnalysis : stopSeries) : (analysisSource === 'video' ? startVideoAnalysis : startSeries)}
              disabled={savingSeries || modelLoading || !modelReady}
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
                  {analysisSource === 'video' ? 'Analisar vídeo' : completedSeries.length > 0 ? `Iniciar próxima série (${completedSeries.length + 1}/${plannedSeries})` : `Iniciar série 1/${plannedSeries}`}
                </>
              )}
            </button>
          )}

          {cameraActive && !seriesActive && completedSeries.length > 0 && (
            <button
              type="button"
              disabled={savingSeries}
              onClick={() => finishWorkout(completedSeriesRef.current)}
              className="w-full rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              Encerrar treino com {completedSeries.length} {completedSeries.length === 1 ? 'série concluída' : 'séries concluídas'}
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
                  <p className="text-sm font-semibold">Feedback da série {report.seriesNumber} — {report.exerciseName}</p>
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
                  <p className="text-[10px] text-muted-foreground">Repetições</p>
                </div>
                <div className="rounded-xl bg-muted/55 py-2.5">
                  <p className="text-base font-bold text-success">{report.correct}</p>
                  <p className="text-[10px] text-muted-foreground">Corretas</p>
                </div>
                <div className="rounded-xl bg-muted/55 py-2.5">
                  <p className="text-base font-bold text-warning">{report.warning}</p>
                  <p className="text-[10px] text-muted-foreground">Para melhorar</p>
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

          {workoutReport && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-primary/30 bg-primary/[0.07] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Treino concluído — {workoutReport.exerciseName}</p>
                  <p className="text-xs text-muted-foreground">{workoutReport.completedSeries} de {workoutReport.plannedSeries} séries realizadas</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                <div className="rounded-xl bg-background/55 py-3"><p className="text-xl font-bold">{workoutReport.reps}</p><p className="text-[10px] text-muted-foreground">Repetições</p></div>
                <div className="rounded-xl bg-background/55 py-3"><p className="text-xl font-bold text-success">{workoutReport.correct}</p><p className="text-[10px] text-muted-foreground">Corretas</p></div>
                <div className="rounded-xl bg-background/55 py-3"><p className="text-xl font-bold text-warning">{workoutReport.warning}</p><p className="text-[10px] text-muted-foreground">Para melhorar</p></div>
                <div className="rounded-xl bg-background/55 py-3"><p className="text-xl font-bold text-danger">{workoutReport.error}</p><p className="text-[10px] text-muted-foreground">Incorretas</p></div>
              </div>
              <p className="text-sm">{workoutReport.summary}</p>
              <p className="text-xs text-muted-foreground">Precisão técnica: {workoutReport.accuracy}% · Duração total: {workoutReport.duration}s</p>
              {trainingExerciseId && <Link to="/treinos" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">Voltar ao treino registrado</Link>}
            </motion.section>
          )}


          <section className="surface rounded-2xl px-5 py-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Vídeos de {selectedExercise.name}</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Seus vídeos analisados ficam organizados separadamente em cada exercício.</p>
              </div>
              {user && videoHistory.length > 0 && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                  {videoHistory.length} {videoHistory.length === 1 ? 'VÍDEO' : 'VÍDEOS'}
                </span>
              )}
            </div>

            {!user ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                Você pode analisar um vídeo como visitante. Entre na sua conta para mantê-lo salvo no histórico.
              </p>
            ) : videoHistoryLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando vídeos...
              </div>
            ) : videoHistory.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">Nenhum vídeo analisado neste exercício ainda.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {videoHistory.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-background/45">
                    {item.signedUrl ? (
                      <video src={item.signedUrl} controls preload="metadata" className="aspect-video w-full bg-black object-contain" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-muted/50 text-xs text-muted-foreground">Vídeo temporariamente indisponível</div>
                    )}
                    <div className="space-y-3 p-4">
                      <div>
                        <p className="truncate text-xs font-semibold" title={item.file_name}>{item.file_name}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleString('pt-BR')} · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB
                          {item.video_duration_seconds > 0 ? ` · ${item.video_duration_seconds}s` : ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        <div className="rounded-lg bg-muted/60 py-2"><p className="text-sm font-bold">{item.reps}</p><p className="text-[9px] text-muted-foreground">Reps</p></div>
                        <div className="rounded-lg bg-success/10 py-2"><p className="text-sm font-bold text-success">{item.correct_reps}</p><p className="text-[9px] text-muted-foreground">Corretas</p></div>
                        <div className="rounded-lg bg-warning/10 py-2"><p className="text-sm font-bold text-warning">{item.warning_reps}</p><p className="text-[9px] text-muted-foreground">Melhorar</p></div>
                        <div className="rounded-lg bg-danger/10 py-2"><p className="text-sm font-bold text-danger">{item.error_reps}</p><p className="text-[9px] text-muted-foreground">Inválidas</p></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>


          {history.length > 0 && (
            <div className="surface rounded-2xl px-5 py-4">
              <p className="text-sm font-medium mb-2">Últimos treinos registrados</p>
              <ul className="space-y-2">
                {history.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-foreground">
                      {s.exercise_name}
                      {s.notes?.match(/Séries: (\d+\/\d+)/)?.[1] && <span className="ml-2 text-muted-foreground">{s.notes.match(/Séries: (\d+\/\d+)/)?.[1]} séries</span>}
                    </span>
                    <span className="shrink-0 text-muted-foreground font-mono">
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
