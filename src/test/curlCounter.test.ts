import { describe, it, expect } from 'vitest';
import { CurlCounter } from '../lib/curlCounter';

function pose(angle: number, shoulderRise = 0, elbowRise = 0) {
  const p = Array.from({length:17}, () => ({x:100,y:100,score:0.99}));
  p[5] = {x:102,y:100-shoulderRise,score:0.99};
  p[6] = {x:100,y:100-shoulderRise,score:0.99};
  p[11] = {x:102,y:300,score:0.99}; p[12] = {x:100,y:300,score:0.99};
  p[8] = {x:100,y:200-elbowRise,score:0.99};
  p[10] = {x:100+100*Math.sin(angle*Math.PI/180),y:p[8].y-100*Math.cos(angle*Math.PI/180),score:0.99};
  return p;
}
describe('complete curl cycles', () => {
  function run(angles: number[], mutate?: (p: ReturnType<typeof pose>, i: number) => ReturnType<typeof pose>) {
    const counter = new CurlCounter();
    return angles.map((a,i) => counter.update(mutate ? mutate(pose(a),i) : pose(a),1000+i*100));
  }
  const cycle = [175,175,140,100,60,40,60,100,140,175,175];
  it('counts only at the final extension, once per full cycle', () => {
    const result = run([...cycle,175,175]);
    expect(result.flatMap((r,i)=>r.rep.repCompleted?[i]:[])).toEqual([10]);
  });
  it('requires an extended start', () => expect(run(cycle.slice(2)).some(r=>r.rep.repCompleted)).toBe(false));
  it('rejects partial contraction', () => expect(run(cycle.map(a=>Math.max(a,70))).some(r=>r.rep.repCompleted)).toBe(false));
  it('does not count before the return is complete', () => expect(run(cycle.slice(0,-2)).some(r=>r.rep.repCompleted)).toBe(false));
  it('allows deeper contraction without shoulder compensation', () => expect(run(cycle.map((a,i)=>i===5?15:a)).some(r=>r.rep.repCompleted)).toBe(true));
  it.each(['shoulder','elbow'])('tolerates a brief %s detection spike', kind => {
    expect(run(cycle,(p,i)=>i===5?pose(40,kind==='shoulder'?45:0,kind==='elbow'?60:0):p).some(r=>r.rep.repCompleted)).toBe(true);
  });
  it.each(['shoulder','elbow'])('rejects sustained excessive %s movement at completion only', kind => {
    const result = run(cycle,(p,i)=>i>=4 && i<=7?pose(cycle[i],kind==='shoulder'?45:0,kind==='elbow'?60:0):p);
    expect(result.some(r=>r.rep.repCompleted)).toBe(false);
    expect(result.filter(r=>r.rejected)).toHaveLength(1);
    expect(result.slice(2,9).every(r=>r.feedback.level==='correct')).toBe(true);
  });
  it('accepts natural shoulder and elbow variation throughout the cycle', () => {
    expect(run(cycle,(p,i)=>i>=2 && i<=8?pose(cycle[i],20,30):p).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
  it('accepts relaxed extension and a less restrictive peak', () => {
    expect(run([158,158,135,100,60,55,90,130,158,158]).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
  it('keeps stage feedback stable and preserves the final result while resting', () => {
    const result = run([...cycle,175,175,175]);
    expect(result[3].feedback.message).toBe('Faça a contração com controle');
    expect(new Set(result.slice(4,10).map(r=>r.feedback.message)).size).toBe(1);
    expect(result.slice(10).every(r=>r.feedback.message==='Repetição completa! ✓')).toBe(true);
  });
  it('allows a small peak tolerance', () => expect(run(cycle.map(a=>a===40?45:a)).filter(r=>r.rep.repCompleted)).toHaveLength(1));
  it('requires a new full cycle after lost tracking', () => {
    const counter = new CurlCounter();
    const result = cycle.map((a,i)=>counter.update(i===5?null:pose(a),1000+i*100));
    expect(result.some(r=>r.rep.repCompleted)).toBe(false);
  });
  it('recovers after an invalid cycle', () => {
    expect(run([...cycle.map(a=>Math.max(a,80)),...cycle]).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
  it('does not count across a long tracking gap', () => {
    const counter = new CurlCounter();
    expect(cycle.map((a,i)=>counter.update(pose(a),1000+i*100+(i>=6?1000:0))).some(r=>r.rep.repCompleted)).toBe(false);
  });
  it('counts consecutive valid cycles once each', () => {
    expect(run([...cycle,...cycle,...cycle]).filter(r=>r.rep.repCompleted)).toHaveLength(3);
  });
});
