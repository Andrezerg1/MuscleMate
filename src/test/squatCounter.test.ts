import { describe, expect, it } from 'vitest';
import type { Keypoint } from '@tensorflow-models/pose-detection';
import { SquatCounter, checkSquatView, type SquatView } from '../lib/squatCounter';

function sidePose(angle: number, lean = 15, shinTilt?: number): Keypoint[] {
  const rad = Math.PI/180;
  const tilt = shinTilt ?? (180-angle)*0.28;
  const thigh = 180-angle-tilt;
  const p = Array.from({length:17}, () => ({x:300,y:100,score:0.99}));
  p[16] = {x:300,y:600,score:0.99};
  p[14] = {x:300+200*Math.sin(tilt*rad),y:600-200*Math.cos(tilt*rad),score:0.99};
  p[12] = {x:p[14].x-200*Math.sin(thigh*rad),y:p[14].y-200*Math.cos(thigh*rad),score:0.99};
  p[6] = {x:p[12].x+180*Math.sin(lean*rad),y:p[12].y-180*Math.cos(lean*rad),score:0.99};
  for (const [left,right] of [[5,6],[11,12],[13,14],[15,16]]) p[left] = {...p[right],x:p[right].x+10};
  return p;
}
function frontPose(drop: number, inwardLeft = 0, inwardRight = 0, stance = 200): Keypoint[] {
  const p = Array.from({length:17}, () => ({x:300,y:100,score:0.99}));
  p[5] = {x:220,y:20+drop,score:0.99}; p[6] = {x:380,y:20+drop,score:0.99};
  p[11] = {x:250,y:200+drop,score:0.99}; p[12] = {x:350,y:200+drop,score:0.99};
  p[15] = {x:300-stance/2,y:600,score:0.99}; p[16] = {x:300+stance/2,y:600,score:0.99};
  for (const [h,k,a,offset] of [[11,13,15,inwardLeft],[12,14,16,-inwardRight]]) {
    const y = 400+drop*0.35;
    const t = (y-p[h].y)/(p[a].y-p[h].y);
    p[k] = {x:p[h].x+(p[a].x-p[h].x)*t+offset,y,score:0.99};
  }
  return p;
}
const repeat = <T,>(value: T, n = 3) => Array.from({length:n},()=>value);
const angles = [175,150,120,98,85,98,120,150,175];
function run(points: (Keypoint[] | null)[], view: SquatView = 'side', step = 100) {
  const counter = new SquatCounter(view);
  return points.map((p,i)=>counter.update(p,1000+i*step));
}
const cycle = () => angles.flatMap(a=>repeat(sidePose(a)));
describe('lateral squat: standing → depth → standing', () => {
  it('counts exactly once, only after full return', () => {
    const result = run([...cycle(),...repeat(sidePose(175),8)]);
    expect(result.flatMap((r,i)=>r.rep.repCompleted?[i]:[])).toEqual([26]);
  });
  it('does not count when beginning already crouched', () => expect(run(cycle().slice(9)).some(r=>r.rep.repCompleted)).toBe(false));
  it('rejects a partial descent', () => expect(run([175,150,120,110,120,150,175].flatMap(a=>repeat(sidePose(a)))).filter(r=>r.rejected)).toHaveLength(1));
  it('does not count at depth or before full extension', () => expect(run(cycle().slice(0,-3)).some(r=>r.rep.repCompleted)).toBe(false));
  it('allows 10° depth tolerance and deeper squats', () => {
    for (const depth of [100,90,65]) expect(run([175,150,120,depth,120,150,175].flatMap(a=>repeat(sidePose(a)))).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
  it('rejects sustained excessive forward trunk lean, even if corrected', () => {
    const result = run(angles.flatMap(a=>repeat(sidePose(a,a===85?78:15))));
    expect(result.some(r=>r.rep.repCompleted)).toBe(false);
    expect(result.filter(r=>r.rejected)).toHaveLength(1);
  });
  it('rejects sustained backward trunk lean', () => expect(run(angles.flatMap(a=>repeat(sidePose(a,a===85?-35:15)))).some(r=>r.rep.repCompleted)).toBe(false));
  it('allows natural trunk inclination and moderate knee travel', () => expect(run(angles.flatMap(a=>repeat(sidePose(a,a<120?45:15)))).filter(r=>r.rep.repCompleted)).toHaveLength(1));
  it('warns, without automatically rejecting, substantial knee advance', () => {
    const result = run(angles.flatMap(a=>repeat(sidePose(a,15,a===85?45:undefined))));
    expect(result.filter(r=>r.rep.repCompleted)).toHaveLength(1);
    expect(result.find(r=>r.rep.repCompleted)?.warning).toContain('Joelho avançando');
  });
  it('tolerates one noisy posture frame', () => {
    const p = cycle(); p[13] = sidePose(85,78);
    expect(run(p).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
  it('requires observed depth, not one isolated bad angle', () => {
    const p = [175,150,120,115,120,150,175].flatMap(a=>repeat(sidePose(a)));
    p[10] = sidePose(90);
    expect(run(p).some(r=>r.rep.repCompleted)).toBe(false);
  });
  it('losing detection discards the current attempt', () => {
    const p: (Keypoint[] | null)[] = cycle(); p[14] = null;
    expect(run(p).some(r=>r.rep.repCompleted)).toBe(false);
  });
  it('does not switch to the other leg mid-rep', () => {
    const p = cycle(); p[14] = p[14].map((v,i)=>i===14?{...v,score:0.1}:v);
    expect(run(p).some(r=>r.rep.repCompleted)).toBe(false);
  });
  it.each([0.6,1,1.7])('is independent of image scale %s and mirroring', scale => {
    for (const mirror of [1,-1]) {
      const p = cycle().map(frame=>frame.map(v=>({...v,x:100+v.x*scale*mirror,y:20+v.y*scale})));
      expect(run(p).filter(r=>r.rep.repCompleted)).toHaveLength(1);
    }
  });
  it.each([33,66,100])('works at different frame rates (%s ms)', step => {
    const frames = angles.flatMap(a=>repeat(sidePose(a),Math.ceil(250/step)+1));
    expect(run(frames,'side',step).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
  it('abandons stale tracking and times out long interrupted attempts', () => {
    for (const gap of [500,21000]) {
      const c = new SquatCounter();
      cycle().slice(0,16).forEach((p,i)=>c.update(p,1000+i*100));
      expect(cycle().slice(16).map((p,i)=>c.update(p,2500+gap+i*100)).some(r=>r.rep.repCompleted)).toBe(false);
    }
  });
  it('a new clean cycle can follow an invalid attempt', () => {
    const bad = angles.flatMap(a=>repeat(sidePose(a,a===85?78:15)));
    expect(run([...bad,...cycle()]).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
});
describe('frontal squat: alignment, not sagittal depth', () => {
  const drops = [0,40,90,120,90,40,0];
  it('counts a complete aligned vertical cycle', () => {
    const result = run(drops.flatMap(d=>repeat(frontPose(d))), 'front');
    expect(result.filter(r=>r.rep.repCompleted)).toHaveLength(1);
    expect(result.at(-1)?.metric).toContain('profundidade não avaliada');
  });
  it.each(['left','right','both'])('detects inward collapse on %s', side => {
    const result = run(drops.flatMap(d=>repeat(frontPose(d,d===120&&side!=='right'?40:0,d===120&&side!=='left'?40:0))), 'front');
    expect(result.some(r=>r.rep.repCompleted)).toBe(false);
    expect(result.find(r=>r.rejected)?.feedback.message).toContain('Joelho entrando');
  });
  it('small alignment variation remains valid', () => expect(run(drops.flatMap(d=>repeat(frontPose(d,d>0?5:0))), 'front').filter(r=>r.rep.repCompleted)).toHaveLength(1));
  it.each([140,260])('respects stance width %s', width => expect(run(drops.flatMap(d=>repeat(frontPose(d,0,0,width))), 'front').filter(r=>r.rep.repCompleted)).toHaveLength(1));
  it('does not count a small bob as a full cycle', () => expect(run([0,35,50,35,0].flatMap(d=>repeat(frontPose(d))), 'front').some(r=>r.rep.repCompleted)).toBe(false));
  it('detects inward collapse after mirroring and scaling', () => {
    const frames = drops.flatMap(d=>repeat(frontPose(d,d===120?40:0))).map(p=>p.map(v=>({...v,x:800-v.x*1.5,y:v.y*1.5})));
    expect(run(frames,'front').some(r=>r.rep.repCompleted)).toBe(false);
  });
});
describe('view and input validation', () => {
  it('requires the selected camera view', () => {
    expect(checkSquatView(frontPose(0),'side').ready).toBe(false);
    expect(checkSquatView(sidePose(175),'front').ready).toBe(false);
  });
  it('handles missing, low-confidence and non-finite keypoints', () => {
    expect(checkSquatView(null,'front').ready).toBe(false);
    expect(checkSquatView([],'side').ready).toBe(false);
    const p = frontPose(0); p[13].score=0.1;
    expect(checkSquatView(p,'front').ready).toBe(false);
    p[5].x=NaN;
    expect(new SquatCounter().update(p).position.ready).toBe(false);
  });
  it('resetting for another view clears the unfinished attempt', () => {
    const c = new SquatCounter(); cycle().slice(0,16).forEach((p,i)=>c.update(p,1000+i*100));
    c.reset('front');
    expect(repeat(frontPose(0),4).map((p,i)=>c.update(p,3000+i*100)).some(r=>r.rep.repCompleted)).toBe(false);
  });
});
