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
  it('latches excess contraction even after correcting it', () => expect(run(cycle.map((a,i)=>i===5?15:a)).some(r=>r.rep.repCompleted)).toBe(false));
  it.each(['shoulder','elbow'])('rejects raised %s at the peak', kind => {
    expect(run(cycle,(p,i)=>i===5?pose(40,kind==='shoulder'?25:0,kind==='elbow'?35:0):p).some(r=>r.rep.repCompleted)).toBe(false);
  });
  it('rejects compensation on the way down', () => expect(run(cycle,(p,i)=>i===7?pose(100,25):p).some(r=>r.rep.repCompleted)).toBe(false));
  it('allows a small peak tolerance', () => expect(run(cycle.map(a=>a===40?45:a)).filter(r=>r.rep.repCompleted)).toHaveLength(1));
  it('requires a new full cycle after lost tracking', () => {
    const counter = new CurlCounter();
    const result = cycle.map((a,i)=>counter.update(i===5?null:pose(a),1000+i*100));
    expect(result.some(r=>r.rep.repCompleted)).toBe(false);
  });
  it('recovers after an invalid cycle', () => {
    expect(run([...cycle.map(a=>a===40?15:a),...cycle]).filter(r=>r.rep.repCompleted)).toHaveLength(1);
  });
});
