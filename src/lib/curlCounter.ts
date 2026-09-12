import type { Keypoint } from '@tensorflow-models/pose-detection';
import { calculateAngle, checkBicepCurlPosition, type FeedbackResult, type RepUpdate } from './poseUtils';

// Camera tolerances, not a clinical assessment of muscle relaxation.
export const CURL_LIMITS = { extension: 155, departure: 140, peak: 60, drift: 0.32, shoulderRise: 0.18, elbowRise: 0.25, faultMs: 250, maxGapMs: 400 };
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
    this.lastFrame = now;
    const visible = (indices: number[]) => indices.every(i => points?.[i] && (points[i].score ?? 0) >= 0.5 && Number.isFinite(points[i].x) && Number.isFinite(points[i].y));
    if (!points || !checkBicepCurlPosition(points).ready || (this.side && !visible(this.side))) {
      this.reset();
      return this.output(180, 'Enquadre o braço de perfil e retorne à extensão', 'warning');
    }
    if (!this.side) this.side = [[6, 8, 10, 12], [5, 7, 9, 11]].find(visible) ?? null;
    if (!this.side) return this.output(180, 'Mostre ombro, cotovelo, punho e quadril', 'warning');
    const [s, e, w, h] = this.side.map(i => points[i]);
    const torso = Math.hypot(h.x - s.x, h.y - s.y);
    if (torso < 20) { this.reset(); return this.output(180, 'Aproxime-se e enquadre o braço', 'warning'); }
    const sample: Sample = {
      angle: calculateAngle([s.x,s.y], [e.x,e.y], [w.x,w.y]), torso,
      shoulderHeight: h.y - s.y, elbowHeight: h.y - e.y,
      drift: Math.abs((e.x-s.x)*(h.y-s.y)-(e.y-s.y)*(h.x-s.x))/(torso*torso),
    };
    const a = sample.angle;
    let fault = sample.drift > CURL_LIMITS.drift ? 'Mantenha o cotovelo junto ao tronco' : '';
    if (this.baseline) {
      if ((sample.shoulderHeight-this.baseline.shoulderHeight)/this.baseline.torso > CURL_LIMITS.shoulderRise) fault = 'Não eleve o ombro durante a rosca';
      if ((sample.elbowHeight-this.baseline.elbowHeight)/this.baseline.torso > CURL_LIMITS.elbowRise) fault = 'Não eleve o cotovelo durante a rosca';
    }
    // Deep elbow flexion alone is not compensation: assess shoulder/elbow movement instead.
    if (this.active && now-this.started > 12000) { this.reset(); return this.output(a, 'Retorne à extensão para reiniciar', 'warning'); }
    if (this.active && fault) {
      this.faultSince ??= now;
      if (now-this.faultSince >= CURL_LIMITS.faultMs) this.invalid ||= fault;
    } else this.faultSince = null;
    if (a >= CURL_LIMITS.extension && !fault) {
      this.extendedFrames++;
      if (this.extendedFrames >= 2) {
        const complete = this.active && this.peak && !this.invalid && now-this.started >= 500;
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
    if (!this.active && a < CURL_LIMITS.departure) {
      this.active = true; this.started = now; this.invalid = ''; this.endMessage = '';
      this.faultSince = fault ? now : null;
    }
    if (this.active && a <= CURL_LIMITS.peak) this.peak = true;
    // Stable stage cues: no per-frame corrective messages. Report sustained faults at the end.
    return this.output(a, this.active ? this.peak ? 'Agora retorne com controle' : 'Faça a contração com controle' : this.endMessage || 'Braço estendido — pode começar', this.active ? 'correct' : this.endLevel);
  }
  private output(angle: number, message: string, level: FeedbackResult['level'], repCompleted = false, rejected = false) {
    return { feedback: { angle, message, level, joint: 'Cotovelo' }, rejected,
      rep: { angle, repCompleted, phase: !this.active ? 'top' : this.peak ? 'ascending' : 'descending', progress: Math.max(0, Math.min(1, (CURL_LIMITS.extension-angle)/(CURL_LIMITS.extension-CURL_LIMITS.peak))), reachedBottom: this.peak } as RepUpdate };
  }
}
