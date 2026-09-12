import type { Keypoint } from '@tensorflow-models/pose-detection';
import { calculateAngle, checkBicepCurlPosition, type FeedbackResult, type RepUpdate } from './poseUtils';

// Camera tolerances, not a clinical assessment of muscle relaxation.
export const CURL_LIMITS = { extension: 165, departure: 155, peak: 45, minimum: 25, drift: 0.20, shoulderRise: 0.08, elbowRise: 0.12 };
type Sample = { angle: number; shoulderHeight: number; elbowHeight: number; torso: number; drift: number };
export class CurlCounter {
  private side: number[] | null = null;
  private baseline: Sample | null = null;
  private active = false;
  private peak = false;
  private invalid = '';
  private extendedFrames = 0;
  private started = 0;
  reset() {
    this.side = null; this.baseline = null; this.active = false;
    this.peak = false; this.invalid = ''; this.extendedFrames = 0; this.started = 0;
  }
  update(points: Keypoint[] | null, now = Date.now()): { feedback: FeedbackResult; rep: RepUpdate; rejected: boolean } {
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
    if (a < CURL_LIMITS.minimum) fault = 'Contração além do limite — controle a amplitude';
    if (this.active && now-this.started > 12000) { this.reset(); return this.output(a, 'Retorne à extensão para reiniciar', 'warning'); }
    if (this.active && fault) this.invalid ||= fault;
    if (a >= CURL_LIMITS.extension && !fault) {
      this.extendedFrames++;
      if (this.extendedFrames >= 2) {
        const complete = this.active && this.peak && !this.invalid && now-this.started >= 500;
        const rejected = this.active && !complete;
        const reason = this.invalid || 'Amplitude incompleta — complete a contração';
        this.active = false; this.peak = false; this.invalid = ''; this.baseline = sample;
        return this.output(a, complete ? 'Repetição completa! ✓' : rejected ? reason : 'Braço estendido — inicie a contração', rejected ? 'error' : 'correct', complete, rejected);
      }
    } else this.extendedFrames = 0;
    if (!this.baseline) return this.output(a, fault || 'Estenda o braço e mantenha o ombro relaxado para começar', fault ? 'error' : 'warning');
    if (!this.active && a < CURL_LIMITS.departure) { this.active = true; this.started = now; this.invalid = fault; }
    if (this.active && a >= CURL_LIMITS.minimum && a <= CURL_LIMITS.peak) this.peak = true;
    return this.output(a, this.invalid || fault || (this.peak ? 'Desça com controle até estender o braço' : 'Contraia mantendo ombro e cotovelo estáveis'), this.invalid || fault ? 'error' : 'correct');
  }
  private output(angle: number, message: string, level: FeedbackResult['level'], repCompleted = false, rejected = false) {
    return { feedback: { angle, message, level, joint: 'Cotovelo' }, rejected,
      rep: { angle, repCompleted, phase: !this.active ? 'top' : this.peak ? 'ascending' : 'descending', progress: Math.max(0, Math.min(1, (165-angle)/120)), reachedBottom: this.peak } as RepUpdate };
  }
}
