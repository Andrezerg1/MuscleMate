import type { Keypoint } from "@tensorflow-models/pose-detection";

export function calculateAngle(
  a: [number, number],
  b: [number, number],
  c: [number, number]
): number {
  const radians =
    Math.atan2(c[1] - b[1], c[0] - b[0]) -
    Math.atan2(a[1] - b[1], a[0] - b[0]);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

export type FeedbackLevel = "correct" | "warning" | "error";

export interface FeedbackResult {
  level: FeedbackLevel;
  angle: number;
  message: string;
  joint: string;
}

// MoveNet keypoint indices
export const KEYPOINTS = {
  NOSE: 0,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
};

function kp(keypoints: Keypoint[], idx: number): [number, number] {
  return [keypoints[idx].x, keypoints[idx].y];
}

function isVisible(keypoints: Keypoint[], ...indices: number[]): boolean {
  return indices.every((i) => (keypoints[i].score ?? 0) > 0.3);
}

// Skeleton connections for drawing
export const SKELETON_CONNECTIONS: [number, number][] = [
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
  [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
  [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE],
  [KEYPOINTS.LEFT_KNEE, KEYPOINTS.LEFT_ANKLE],
  [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE],
  [KEYPOINTS.RIGHT_KNEE, KEYPOINTS.RIGHT_ANKLE],
];

// ─── Exercise-specific analysis ──────────────────────────────────

export function analyzeSquat(keypoints: Keypoint[]): FeedbackResult | null {
  const { RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE } = KEYPOINTS;

  // Try right side first, then left
  let hip: number, knee: number, ankle: number;
  if (isVisible(keypoints, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE)) {
    hip = RIGHT_HIP; knee = RIGHT_KNEE; ankle = RIGHT_ANKLE;
  } else if (isVisible(keypoints, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE)) {
    hip = LEFT_HIP; knee = LEFT_KNEE; ankle = LEFT_ANKLE;
  } else {
    return null;
  }

  const angle = calculateAngle(kp(keypoints, hip), kp(keypoints, knee), kp(keypoints, ankle));

  if (angle > 160) {
    return { level: "correct", angle, message: "Posição inicial — inicie a descida", joint: "Joelho" };
  } else if (angle >= 80 && angle <= 100) {
    return { level: "correct", angle, message: "Profundidade correta! ✓", joint: "Joelho" };
  } else if (angle > 100 && angle <= 160) {
    return { level: "warning", angle, message: "Desça mais — paralelo ao chão", joint: "Joelho" };
  } else {
    return { level: "error", angle, message: "Muito baixo — suba um pouco", joint: "Joelho" };
  }
}

/** Elbow drifting in front of the scapular (shoulder) line breaks the curl. */
export function elbowDriftPx(keypoints: Keypoint[], shoulder: number, elbow: number, hip: number): number {
  const s = kp(keypoints, shoulder);
  const e = kp(keypoints, elbow);
  const h = kp(keypoints, hip);
  const torso = Math.max(1, Math.abs(h[1] - s[1]));
  // Positive = elbow ahead of the shoulder line, normalised by torso length
  return (Math.abs(e[0] - s[0]) / torso) * 100;
}

function curlSide(keypoints: Keypoint[]) {
  const { RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST, RIGHT_HIP, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, LEFT_HIP } = KEYPOINTS;
  if (isVisible(keypoints, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST)) {
    return { shoulder: RIGHT_SHOULDER, elbow: RIGHT_ELBOW, wrist: RIGHT_WRIST, hip: RIGHT_HIP };
  }
  if (isVisible(keypoints, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST)) {
    return { shoulder: LEFT_SHOULDER, elbow: LEFT_ELBOW, wrist: LEFT_WRIST, hip: LEFT_HIP };
  }
  return null;
}

export interface PositionCheck {
  ready: boolean;
  message: string;
}

/**
 * Bicep curl requires a true profile (side) view so the elbow travel is visible.
 * We detect it by comparing shoulder separation against torso length: facing the
 * camera the shoulders are wide apart, in profile they nearly overlap.
 */
export function checkBicepCurlPosition(keypoints: Keypoint[] | null): PositionCheck {
  if (!keypoints) return { ready: false, message: "Nenhuma pessoa detectada — entre no enquadramento" };

  const { LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP } = KEYPOINTS;
  const ls = keypoints[LEFT_SHOULDER];
  const rs = keypoints[RIGHT_SHOULDER];
  const lh = keypoints[LEFT_HIP];
  const rh = keypoints[RIGHT_HIP];
  if (!ls || !rs || !lh || !rh) return { ready: false, message: "Corpo não detectado — afaste-se da câmera" };

  const side = curlSide(keypoints);
  if (!side) return { ready: false, message: "Braço não visível — mostre ombro, cotovelo e punho" };

  const shoulderSpan = Math.abs(ls.x - rs.x);
  const torso = Math.max(1, Math.abs((ls.y + rs.y) / 2 - (lh.y + rh.y) / 2));
  const ratio = shoulderSpan / torso;

  if (ratio > 0.75) {
    return { ready: false, message: "Vire-se de lado para a câmera (visão de perfil)" };
  }
  if (ratio > 0.5) {
    return { ready: false, message: "Quase lá — gire mais o corpo até ficar totalmente de perfil" };
  }
  return { ready: true, message: "Perfil correto — pode iniciar a série" };
}

export const positionCheckers: Record<string, (keypoints: Keypoint[] | null) => PositionCheck> = {
  "bicep-curl": checkBicepCurlPosition,
};

export function analyzeBicepCurl(keypoints: Keypoint[]): FeedbackResult | null {
  const side = curlSide(keypoints);
  if (!side) return null;
  const { shoulder, elbow, wrist, hip } = side;

  const angle = calculateAngle(kp(keypoints, shoulder), kp(keypoints, elbow), kp(keypoints, wrist));
  const drift = elbowDriftPx(keypoints, shoulder, elbow, hip);

  if (drift > 28) {
    return { level: "error", angle, message: "Cotovelo à frente do ombro — traga para trás", joint: "Cotovelo" };
  }

  if (angle >= 155) {
    return { level: "correct", angle, message: "Braço estendido — inicie a contração", joint: "Cotovelo" };
  } else if (angle < 90) {
    return { level: "correct", angle, message: "Contração válida! ✓", joint: "Cotovelo" };
  } else if (angle < 120) {
    return { level: "warning", angle, message: "Quase lá — passe dos 90°", joint: "Cotovelo" };
  } else {
    return { level: "warning", angle, message: "Continue contraindo o bíceps", joint: "Cotovelo" };
  }
}

export function analyzeBenchPress(keypoints: Keypoint[]): FeedbackResult | null {
  const { RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST } = KEYPOINTS;

  let shoulder: number, elbow: number, wrist: number;
  if (isVisible(keypoints, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST)) {
    shoulder = RIGHT_SHOULDER; elbow = RIGHT_ELBOW; wrist = RIGHT_WRIST;
  } else if (isVisible(keypoints, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST)) {
    shoulder = LEFT_SHOULDER; elbow = LEFT_ELBOW; wrist = LEFT_WRIST;
  } else {
    return null;
  }

  const angle = calculateAngle(kp(keypoints, shoulder), kp(keypoints, elbow), kp(keypoints, wrist));

  if (angle >= 150) {
    return { level: "correct", angle, message: "Braços estendidos — inicie a descida", joint: "Cotovelo" };
  } else if (angle >= 80 && angle <= 100) {
    return { level: "correct", angle, message: "Descida correta! ✓", joint: "Cotovelo" };
  } else if (angle < 80) {
    return { level: "error", angle, message: "Desceu demais — controle o movimento", joint: "Cotovelo" };
  } else {
    return { level: "warning", angle, message: "Desça mais até 90°", joint: "Cotovelo" };
  }
}

export function analyzeDeadlift(keypoints: Keypoint[]): FeedbackResult | null {
  const { RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE, LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE } = KEYPOINTS;

  let shoulder: number, hip: number, knee: number;
  if (isVisible(keypoints, RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE)) {
    shoulder = RIGHT_SHOULDER; hip = RIGHT_HIP; knee = RIGHT_KNEE;
  } else if (isVisible(keypoints, LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE)) {
    shoulder = LEFT_SHOULDER; hip = LEFT_HIP; knee = LEFT_KNEE;
  } else {
    return null;
  }

  const angle = calculateAngle(kp(keypoints, shoulder), kp(keypoints, hip), kp(keypoints, knee));

  if (angle >= 160) {
    return { level: "correct", angle, message: "Coluna alinhada! ✓", joint: "Coluna" };
  } else if (angle >= 140) {
    return { level: "warning", angle, message: "Mantenha as costas mais retas", joint: "Coluna" };
  } else {
    return { level: "error", angle, message: "Costas curvadas! Corrija a postura", joint: "Coluna" };
  }
}

export function analyzeLunge(keypoints: Keypoint[]): FeedbackResult | null {
  const { RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE } = KEYPOINTS;

  let hip: number, knee: number, ankle: number;
  if (isVisible(keypoints, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE)) {
    hip = RIGHT_HIP; knee = RIGHT_KNEE; ankle = RIGHT_ANKLE;
  } else if (isVisible(keypoints, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE)) {
    hip = LEFT_HIP; knee = LEFT_KNEE; ankle = LEFT_ANKLE;
  } else {
    return null;
  }

  const angle = calculateAngle(kp(keypoints, hip), kp(keypoints, knee), kp(keypoints, ankle));

  if (angle > 160) {
    return { level: "correct", angle, message: "Posição inicial — inicie o afundo", joint: "Joelho" };
  } else if (angle >= 85 && angle <= 100) {
    return { level: "correct", angle, message: "Ângulo perfeito! ✓", joint: "Joelho" };
  } else if (angle > 100) {
    return { level: "warning", angle, message: "Desça mais o quadril", joint: "Joelho" };
  } else {
    return { level: "error", angle, message: "Muito baixo — suba um pouco", joint: "Joelho" };
  }
}

export type ExerciseAnalyzer = (keypoints: Keypoint[]) => FeedbackResult | null;

export const exerciseAnalyzers: Record<string, ExerciseAnalyzer> = {
  squat: analyzeSquat,
  "bicep-curl": analyzeBicepCurl,
  "bench-press": analyzeBenchPress,
  deadlift: analyzeDeadlift,
  lunge: analyzeLunge,
};

// ─── Rep counting state machine ──────────────────────────────────

export interface RepCounterConfig {
  /** Angle at/above which the joint is considered fully extended (top of the movement) */
  topThreshold: number;
  /** Angle at/below which the joint is considered fully flexed (bottom of the movement) */
  bottomThreshold: number;
  /** Frames the phase must persist before it is accepted (noise rejection) */
  stableFrames: number;
  /** Minimum time (ms) a full rep may take — anything faster is jitter */
  minRepMs: number;
  /** Maximum time (ms) a rep may take before the machine resets */
  maxRepMs: number;
  /** Where the rep is validated: at the bottom of the range or back at the top */
  countAt?: "top" | "bottom";
}

export const repCounterConfigs: Record<string, RepCounterConfig> = {
  squat: { topThreshold: 155, bottomThreshold: 105, stableFrames: 3, minRepMs: 700, maxRepMs: 15000 },
  "bicep-curl": { topThreshold: 150, bottomThreshold: 90, stableFrames: 2, minRepMs: 500, maxRepMs: 12000, countAt: "bottom" },
  "bench-press": { topThreshold: 150, bottomThreshold: 100, stableFrames: 3, minRepMs: 600, maxRepMs: 15000 },
  deadlift: { topThreshold: 160, bottomThreshold: 125, stableFrames: 4, minRepMs: 900, maxRepMs: 20000 },
  lunge: { topThreshold: 155, bottomThreshold: 110, stableFrames: 3, minRepMs: 800, maxRepMs: 15000 },
};

export const defaultRepConfig: RepCounterConfig = {
  topThreshold: 155,
  bottomThreshold: 105,
  stableFrames: 3,
  minRepMs: 700,
  maxRepMs: 15000,
};

export type RepPhase = "top" | "descending" | "bottom" | "ascending";

export interface RepUpdate {
  /** true only on the frame the rep is completed */
  repCompleted: boolean;
  phase: RepPhase;
  /** 0..1 how deep into the movement the athlete is */
  progress: number;
  /** smoothed angle used for the decision */
  angle: number;
  /** true when the bottom of the range was reached during this rep */
  reachedBottom: boolean;
}

/**
 * Counts repetitions from a single joint angle using hysteresis + temporal
 * smoothing. A rep is only counted when the athlete goes from the top of the
 * range, through the bottom (full range of motion), and back to the top.
 */
export class RepCounter {
  private config: RepCounterConfig;
  private smoothed: number | null = null;
  private phase: RepPhase = "top";
  private candidatePhase: RepPhase | null = null;
  private candidateCount = 0;
  private reachedBottom = false;
  private repStartedAt = 0;
  private lastRepAt = 0;
  private readonly alpha = 0.35;

  constructor(exerciseId: string) {
    this.config = repCounterConfigs[exerciseId] ?? defaultRepConfig;
  }

  reset(exerciseId?: string) {
    if (exerciseId) this.config = repCounterConfigs[exerciseId] ?? defaultRepConfig;
    this.smoothed = null;
    this.phase = "top";
    this.candidatePhase = null;
    this.candidateCount = 0;
    this.reachedBottom = false;
    this.repStartedAt = 0;
    this.lastRepAt = 0;
  }

  get currentPhase(): RepPhase {
    return this.phase;
  }

  private commit(next: RepPhase): boolean {
    if (next === this.phase) {
      this.candidatePhase = null;
      this.candidateCount = 0;
      return false;
    }
    if (this.candidatePhase !== next) {
      this.candidatePhase = next;
      this.candidateCount = 1;
      return false;
    }
    this.candidateCount++;
    if (this.candidateCount < this.config.stableFrames) return false;
    this.phase = next;
    this.candidatePhase = null;
    this.candidateCount = 0;
    return true;
  }

  update(rawAngle: number, now = Date.now()): RepUpdate {
    // Exponential smoothing kills the per-frame jitter of the pose model
    this.smoothed =
      this.smoothed === null ? rawAngle : this.smoothed + this.alpha * (rawAngle - this.smoothed);
    const angle = this.smoothed;
    const { topThreshold, bottomThreshold, minRepMs, maxRepMs } = this.config;

    // Abandon a rep that is taking too long (user stopped mid-movement)
    if (this.repStartedAt && now - this.repStartedAt > maxRepMs) {
      this.repStartedAt = 0;
      this.reachedBottom = false;
    }

    let repCompleted = false;

    if (angle <= bottomThreshold) {
      const changed = this.commit("bottom");
      if (changed) {
        if (!this.repStartedAt) this.repStartedAt = now;
        if (this.config.countAt === "bottom") {
          if (now - this.lastRepAt >= minRepMs) {
            repCompleted = true;
            this.lastRepAt = now;
          }
          this.reachedBottom = false;
          this.repStartedAt = 0;
        } else {
          this.reachedBottom = true;
        }
      }
    } else if (angle >= topThreshold) {
      const changed = this.commit("top");
      if (changed && this.reachedBottom) {
        const started = this.repStartedAt || now;
        if (now - started >= minRepMs && now - this.lastRepAt >= minRepMs) {
          repCompleted = true;
          this.lastRepAt = now;
        }
        this.reachedBottom = false;
        this.repStartedAt = 0;
      }
    } else {
      // Mid-range: direction tells us if we are going down or coming back up
      const goingDown = this.phase === "top" || this.phase === "descending";
      this.commit(goingDown ? "descending" : "ascending");
      if (!this.repStartedAt && this.phase === "descending") this.repStartedAt = now;
    }

    const span = Math.max(1, topThreshold - bottomThreshold);
    const progress = Math.min(1, Math.max(0, (topThreshold - angle) / span));

    return { repCompleted, phase: this.phase, progress, angle, reachedBottom: this.reachedBottom };
  }
}
