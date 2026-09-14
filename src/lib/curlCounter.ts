import type { Keypoint } from '@tensorflow-models/pose-detection';
import { calculateAngle, checkBicepCurlPosition, type FeedbackResult, type RepUpdate } from './poseUtils';

// Camera tolerances, not a clinical assessment of muscle relaxation.
export const CURL_LIMITS = { extension: 135, departure: 12, peak: 85, minTravel: 45, drift: 0.22, shoulderRise: 0.20, elbowRise: 0.28, faultMs: 300, minRepMs: 200, maxGapMs: 400 };
type Sample = { angle: number; shoulderHeight: number; elbowHeight: number; torso: number; drift: number };
export class CurlCounter {
  private side: number[] | null = null;
  private baseline: Sample | null = null;
  private active = false;
  private peak = false;
  private invalid = '';
  private extendedFrames = 0;
  private started = 0;
  private faultSince: number | null = null;
  private lastFrame: number | null = null;
  private endMessage = '';
  private endLevel: FeedbackResult['level'] = 'correct';
  reset() {
    this.side = null; this.baseline = null; this.active = false;
    this.peak = false; this.invalid = ''; this.extendedFrames = 0; this.started = 0;
    this.faultSince = null; this.lastFrame = null; this.endMessage = ''; this.endLevel = 'correct';
  }
  update(points: Keypoint[] | null, now = Date.now()): { feedback: FeedbackResult; rep: RepUpdate; rejected: boolean } {
    if (this.lastFrame !== null && (now < this.lastFrame || now-this.lastFrame > CURL_LIMITS.maxGapMs)) this.reset();
    const visible = (indices: number[], confidence = 0.3) => indices.every(i => points?.[i] && (points[i].score ?? 0) >= confidence && Number.isFinite(points[i].x) && Number.isFinite(points[i].y));
    if (!points || !checkBicepCurlPosition(points).ready || (this.side && !visible(this.side.slice(0, 3)))) {
      return this.output(180, 'Enquadre o braço de perfil e retorne à extensão', 'warning');
    }
    if (!this.side) this.side = [[6, 8, 10, 12], [5, 7, 9, 11]]
      .filter(side => visible(side.slice(0, 3)))
      .sort((a,b) => b.slice(0,3).reduce((sum,i)=>sum+(points[i].score ?? 0),0)-a.slice(0,3).reduce((sum,i)=>sum+(points[i].score ?? 0),0))[0] ?? null;
    if (!this.side) return this.output(180, 'Mostre ombro, cotovelo, punho e quadril', 'warning');
    const [s, e, w, hipIndex] = this.side;
    const h = visible([hipIndex], 0.2) ? points[hipIndex] : points[hipIndex === 12 ? 11 : 12];
    if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return this.output(180, 'Mantenha o tronco visível', 'warning');
    const shoulder = points[s], elbow = points[e], wrist = points[w];
    const torso = Math.hypot(h.x - shoulder.x, h.y - shoulder.y);
    if (torso < 20) { this.reset(); return this.output(180, 'Aproxime-se e enquadre o braço', 'warning'); }
    const sample: Sample = {
      angle: calculateAngle([shoulder.x,shoulder.y], [elbow.x,elbow.y], [wrist.x,wrist.y]), torso,
      shoulderHeight: h.y - shoulder.y, elbowHeight: h.y - elbow.y,
      drift: Math.abs((elbow.x-shoulder.x)*(h.y-shoulder.y)-(elbow.y-shoulder.y)*(h.x-shoulder.x))/(torso*torso),
    };
    this.lastFrame = now;
    const a = sample.angle;
    let fault = '';
    if (this.baseline) {
      if (sample.drift-this.baseline.drift > CURL_LIMITS.drift) fault = 'Mantenha o cotovelo junto ao tronco';
      if ((sample.shoulderHeight-this.baseline.shoulderHeight)/this.baseline.torso > CURL_LIMITS.shoulderRise) fault = 'Não eleve o ombro durante a rosca';
      if ((sample.elbowHeight-this.baseline.elbowHeight)/this.baseline.torso > CURL_LIMITS.elbowRise) fault = 'Não eleve o cotovelo durante a rosca';
    }
    // Deep elbow flexion alone is not compensation: assess shoulder/elbow movement instead.
    if (this.active && now-this.started > 12000) { this.reset(); return this.output(a, 'Retorne à extensão para reiniciar', 'warning'); }
    if (this.active && fault) {
      this.faultSince ??= now;
      if (now-this.faultSince >= CURL_LIMITS.faultMs) this.invalid ||= fault;
    } else this.faultSince = null;
    const extensionTarget = this.baseline ? Math.max(125, this.baseline.angle-10) : CURL_LIMITS.extension;
    if (a >= extensionTarget) {
      this.extendedFrames++;
      if (this.extendedFrames >= 2) {
        const complete = this.active && this.peak && !this.invalid && now-this.started >= CURL_LIMITS.minRepMs;
        const rejected = this.active && !complete;
        const reason = this.invalid || 'Amplitude incompleta — complete a contração';
        if (this.active) {
          this.endMessage = complete ? 'Repetição completa! ✓' : reason;
          this.endLevel = rejected ? 'warning' : 'correct';
        }
        this.active = false; this.peak = false; this.invalid = ''; this.baseline = sample;
        this.faultSince = null;
        return this.output(a, this.endMessage || 'Braço estendido — pode começar', this.endLevel, complete, rejected);
      }
    } else this.extendedFrames = 0;
    if (!this.baseline) return this.output(a, 'Estenda o braço ao lado do corpo para começar', 'warning');
    if (!this.active && a < this.baseline.angle-CURL_LIMITS.departure) {
      this.active = true; this.started = now; this.invalid = ''; this.endMessage = '';
      this.faultSince = fault ? now : null;
    }
    if (this.active && a <= Math.min(CURL_LIMITS.peak, this.baseline.angle-CURL_LIMITS.minTravel)) this.peak = true;
    // Stable stage cues: no per-frame corrective messages. Report sustained faults at the end.
    return this.output(a, this.active ? this.peak ? 'Agora retorne com controle' : 'Faça a contração com controle' : this.endMessage || 'Braço estendido — pode começar', this.active ? 'correct' : this.endLevel);
  }
  private output(angle: number, message: string, level: FeedbackResult['level'], repCompleted = false, rejected = false) {
    return { feedback: { angle, message, level, joint: 'Cotovelo' }, rejected,
      rep: { angle, repCompleted, phase: !this.active ? 'top' : this.peak ? 'ascending' : 'descending', progress: Math.max(0, Math.min(1, (CURL_LIMITS.extension-angle)/(CURL_LIMITS.extension-CURL_LIMITS.peak))), reachedBottom: this.peak } as RepUpdate };
  }
}
