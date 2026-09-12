import type { Keypoint } from '@tensorflow-models/pose-detection';
import { calculateAngle, type FeedbackResult, type PositionCheck, type RepPhase, type RepUpdate } from './poseUtils';

export type SquatView = 'front' | 'side';
export const SQUAT_VIEWS = {
  front: {
    title: 'De frente', focus: 'Alinhamento dos joelhos',
    description: 'Identifica sinais de joelhos entrando para dentro (valgo dinâmico) durante o movimento.',
    instruction: 'Fique de frente, comece em pé e enquadre ombros, quadril, joelhos e tornozelos.',
    limitation: 'Esta vista acompanha o alinhamento e o ciclo de descida e subida. Para avaliar a profundidade de 90°, use De lado.',
  },
  side: {
    title: 'De lado', focus: 'Amplitude do movimento',
    description: 'Acompanha a profundidade, o retorno à posição em pé e a inclinação do tronco.',
    instruction: 'Fique de perfil, comece em pé e enquadre ombro, quadril, joelho e tornozelo.',
    limitation: 'Busque cerca de 90° no joelho (margem de 10°) e volte à extensão, sem travar os joelhos. A câmera estima o tronco, mas não confirma a curvatura da lombar nem o apoio do calcanhar.',
  },
} as const;

// Initial camera heuristics: proportional to the athlete, not clinical cutoffs.
// Front-view projected knee angles are NOT sagittal flexion measurements.
export const SQUAT_LIMITS = {
  extension: 165, departure: 155, depth: 100,
  standingMs: 150, depthMs: 80, faultMs: 180,
  minRepMs: 600, maxRepMs: 20000, maxGapMs: 350,
  frontalDeparture: 0.08, frontalDepth: 0.18, frontalReturn: 0.04,
  valgusWarning: 0.045, valgusError: 0.08,
  torsoWarning: 55, torsoError: 70, backwardError: 25,
};
const SIDES = [[6, 12, 14, 16], [5, 11, 13, 15]];
const valid = (p: Keypoint[] | null, ids: number[]) => ids.every(i =>
  p?.[i] && Number.isFinite(p[i].x) && Number.isFinite(p[i].y) && (p[i].score ?? 0) >= 0.5);
const distance = (a: Keypoint, b: Keypoint) => Math.hypot(a.x - b.x, a.y - b.y);
const angleAt = (a: Keypoint, b: Keypoint, c: Keypoint) => calculateAngle([a.x, a.y], [b.x, b.y], [c.x, c.y]);
const average = (a: number, b: number) => (a + b) / 2;

export function checkSquatView(p: Keypoint[] | null, view: SquatView): PositionCheck {
  if (!p) return { ready: false, message: 'Entre no enquadramento e comece em pé' };
  if (!valid(p, [5, 6, 11, 12])) return { ready: false, message: 'Enquadre os ombros e o quadril com boa iluminação' };
  const torso = average(distance(p[5], p[11]), distance(p[6], p[12]));
  if (torso < 20) return { ready: false, message: 'Aproxime-se da câmera, mantendo o corpo inteiro visível' };
  const ratio = distance(p[5], p[6]) / torso;
  if (view === 'front') {
    if (!valid(p, [13, 14, 15, 16])) return { ready: false, message: 'Mostre os dois joelhos e os dois tornozelos' };
    if (ratio < 0.55) return { ready: false, message: 'Vire de frente para avaliar os dois joelhos' };
    if (Math.abs(p[15].x - p[16].x) < torso * 0.15) return { ready: false, message: 'Deixe os dois tornozelos visíveis, sem sobreposição' };
  } else {
    if (!SIDES.some(ids => valid(p, ids))) return { ready: false, message: 'Mostre ombro, quadril, joelho e tornozelo do mesmo lado' };
    if (ratio > 0.5) return { ready: false, message: 'Vire de lado para avaliar a amplitude' };
  }
  return { ready: true, message: `${SQUAT_VIEWS[view].title}: posição da câmera correta` };
}

interface SquatSample {
  knee: number; hip: number; lean: number; leg: number; shin: number;
  hipHeight: number; ankleSpan: number; kneeTravel: number; facing: number;
  inward: number[];
}
export interface SquatUpdate {
  feedback: FeedbackResult;
  rep: RepUpdate;
  rejected: boolean;
  position: PositionCheck;
  metric: string;
  warning: string | null;
}

/** One attempt is armed only at standing, and completed only back at standing.
 * Sustained faults latch for the whole attempt; missing frames require re-arming.
 * Front counts observed vertical cycles, not validated sagittal squat depth.
 */
export class SquatCounter {
  private view: SquatView;
  private side: number[] | null = null;
  private baseline: SquatSample | null = null;
  private active = false;
  private reachedDepth = false;
  private invalid = '';
  private warning: string | null = null;
  private started = 0;
  private lastFrame: number | null = null;
  private progress = 0;
  private phase: RepPhase = 'top';
  private holds = new Map<string, { since: number; frames: number }>();

  constructor(view: SquatView = 'side') { this.view = view; }
  reset(view: SquatView = this.view) {
    this.view = view; this.side = null; this.baseline = null; this.active = false;
    this.reachedDepth = false; this.invalid = ''; this.warning = null;
    this.started = 0; this.lastFrame = null; this.progress = 0; this.phase = 'top'; this.holds.clear();
  }
  private held(key: string, condition: boolean, now: number, duration: number) {
    if (!condition) { this.holds.delete(key); return false; }
    const hold = this.holds.get(key);
    if (!hold) { this.holds.set(key, { since: now, frames: 1 }); return false; }
    hold.frames++;
    return hold.frames >= 2 && now - hold.since >= duration;
  }
  private sample(p: Keypoint[]): SquatSample | null {
    if (this.view === 'side') {
      if (!this.side) {
        this.side = SIDES.filter(ids => valid(p, ids)).sort((a,b) =>
          Math.min(...b.map(i => p[i].score ?? 0)) - Math.min(...a.map(i => p[i].score ?? 0)))[0] ?? null;
      }
      if (!this.side || !valid(p, this.side)) return null;
      const [s,h,k,a] = this.side.map(i => p[i]);
      return { knee: angleAt(h,k,a), hip: angleAt(s,h,k), lean: Math.atan2(s.x-h.x, h.y-s.y)*180/Math.PI,
        leg: distance(h,k)+distance(k,a), shin: distance(k,a), hipHeight: a.y-h.y,
        ankleSpan: 0, kneeTravel: Math.abs(k.x-a.x), facing: Math.sign(k.x-h.x), inward: [] };
    }
    const legs = [[11,13,15], [12,14,16]].map(ids => ids.map(i => p[i]));
    const midline = average(p[11].x, p[12].x);
    const inward = legs.map(([h,k,a]) => {
      const t = Math.max(0, Math.min(1, (k.y-h.y)/Math.max(1,a.y-h.y)));
      const expectedX = h.x+(a.x-h.x)*t;
      return (k.x-expectedX)*Math.sign(midline-a.x)/(distance(h,k)+distance(k,a));
    });
    return { knee: Math.min(...legs.map(([h,k,a]) => angleAt(h,k,a))), hip: 180, lean: 0,
      leg: average(...legs.map(([h,k,a]) => distance(h,k)+distance(k,a)) as [number,number]),
      shin: average(distance(p[13],p[15]),distance(p[14],p[16])),
      hipHeight: average(p[15].y-p[11].y,p[16].y-p[12].y),
      ankleSpan: Math.abs(p[15].x-p[16].x), kneeTravel: 0, facing: 0, inward };
  }

  update(p: Keypoint[] | null, now = Date.now()): SquatUpdate {
    const position = checkSquatView(p, this.view);
    if (this.lastFrame !== null && (now-this.lastFrame > SQUAT_LIMITS.maxGapMs || now < this.lastFrame)) this.reset();
    this.lastFrame = now;
    const s = position.ready && p ? this.sample(p) : null;
    if (!s || s.leg < 30 || s.shin < 15 || !Number.isFinite(s.knee)) {
      this.reset();
      const missing = position.ready ? { ready: false, message: 'Mantenha o mesmo lado visível e volte à posição em pé' } : position;
      return this.output(null, missing, missing.message, 'warning');
    }
    if (this.active && now-this.started > SQUAT_LIMITS.maxRepMs) {
      this.reset();
      return this.output(s, position, 'Movimento interrompido — volte à posição em pé', 'warning');
    }
    const standingShape = s.knee >= SQUAT_LIMITS.extension && (this.view === 'front' || (s.hip >= 155 && Math.abs(s.lean) <= 25));
    if (!this.baseline) {
      if (this.held('start', standingShape, now, SQUAT_LIMITS.standingMs)) this.baseline = s;
      return this.output(s, position, this.baseline ? 'Posição inicial registrada — pode agachar' : 'Fique em pé por um instante para começar', this.baseline ? 'correct' : 'warning');
    }
    const base = this.baseline;
    const drop = (base.hipHeight-s.hipHeight)/base.leg;
    const nextProgress = this.view === 'side'
      ? Math.max(0,Math.min(1,(SQUAT_LIMITS.extension-s.knee)/(SQUAT_LIMITS.extension-SQUAT_LIMITS.depth)))
      : Math.max(0,Math.min(1,drop/SQUAT_LIMITS.frontalDepth));
    const departed = this.view === 'side' ? s.knee < SQUAT_LIMITS.departure : drop >= SQUAT_LIMITS.frontalDeparture;
    if (!this.active && departed) {
      this.active = true; this.started = now; this.reachedDepth = false; this.invalid = ''; this.warning = null; this.holds.clear();
    }
    const inward = Math.max(0,...s.inward.map((v,i) => v-base.inward[i]));
    const lean = Math.abs(s.lean);
    const backward = s.lean*s.facing < -SQUAT_LIMITS.backwardError;
    const fault = this.view === 'front'
      ? inward > SQUAT_LIMITS.valgusError ? 'Joelho entrando para dentro — mantenha o alinhamento dos joelhos' : ''
      : lean > SQUAT_LIMITS.torsoError || backward ? 'Inclinação excessiva do tronco — retome o controle do movimento' : '';
    const advisory = this.view === 'front'
      ? inward > SQUAT_LIMITS.valgusWarning ? 'Atenção ao alinhamento: evite aproximar os joelhos' : null
      : s.kneeTravel/base.shin > 0.65 ? 'Joelho avançando bastante — observe o apoio dos pés e o controle'
        : lean > SQUAT_LIMITS.torsoWarning ? 'Observe a inclinação do tronco e mantenha o controle' : null;
    if (this.active) {
      if (this.held('fault', !!fault, now, SQUAT_LIMITS.faultMs)) this.invalid ||= fault;
      if (this.held('advisory', !!advisory, now, SQUAT_LIMITS.faultMs)) this.warning ||= advisory;
      const deep = this.view === 'side' ? s.knee <= SQUAT_LIMITS.depth : drop >= SQUAT_LIMITS.frontalDepth;
      if (this.held('depth', deep, now, SQUAT_LIMITS.depthMs)) this.reachedDepth = true;
      this.phase = nextProgress < this.progress-0.015 ? 'ascending' : nextProgress > this.progress+0.015 ? 'descending' : this.phase;
      if (deep && this.phase !== 'ascending') this.phase = 'bottom';
      const returned = standingShape && (this.view === 'side' ? Math.abs(s.lean-base.lean) <= 20 : drop <= SQUAT_LIMITS.frontalReturn);
      if (this.held('return', returned, now, SQUAT_LIMITS.standingMs)) {
        const completed = this.reachedDepth && !this.invalid && now-this.started >= SQUAT_LIMITS.minRepMs;
        const reason = this.invalid || (this.reachedDepth ? 'Movimento rápido demais para validar' : 'Movimento incompleto — complete a descida antes de subir');
        this.active = false; this.phase = 'top'; this.progress = 0; this.reachedDepth = false; this.holds.clear();
        const result = this.output(s, position, completed ? this.view === 'front' ? 'Ciclo completo com alinhamento frontal validado' : 'Agachamento completo! ✓' : reason,
          completed ? this.warning ? 'warning' : 'correct' : 'error', completed, !completed);
        this.invalid = ''; this.warning = null;
        return result;
      }
    }
    this.progress = nextProgress;
    return this.output(s, position, this.invalid || fault || advisory || (!this.active ? 'Em pé — inicie a descida' : this.reachedDepth ? 'Suba com controle até ficar em pé' : this.view === 'front' ? 'Desça mantendo os joelhos alinhados' : 'Desça com controle até cerca de 90°'),
      this.invalid || fault ? 'error' : advisory ? 'warning' : 'correct');
  }
  private output(s: SquatSample | null, position: PositionCheck, message: string, level: FeedbackResult['level'], completed = false, rejected = false): SquatUpdate {
    return { feedback: { angle: s?.knee ?? 180, joint: this.view === 'front' ? 'Joelho (projeção frontal)' : 'Joelho', message, level }, position,
      metric: !s ? 'Aguardando enquadramento' : this.view === 'front' ? 'Alinhamento frontal • profundidade não avaliada' : `Joelho ${Math.round(s.knee)}° • tronco ${Math.round(Math.abs(s.lean))}°`,
      rep: { angle: s?.knee ?? 180, repCompleted: completed, phase: this.phase, progress: this.progress, reachedBottom: this.reachedDepth },
      rejected, warning: completed ? this.warning : null };
  }
}
