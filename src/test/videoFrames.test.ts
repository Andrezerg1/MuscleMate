import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextVideoFrame, seekVideoFrame } from '../lib/videoFrames';

afterEach(() => vi.useRealTimers());
describe('video frame sampling', () => {
  it('includes the last usable frame before completing', () => {
    let time = 0.05;
    const frames = [time];
    while (nextVideoFrame(time, 10.499583) !== null) {
      time = nextVideoFrame(time, 10.499583)!;
      frames.push(time);
    }
    expect(frames.at(-1)).toBeCloseTo(10.449583);
    expect(frames.every((t,i) => i === 0 || t-frames[i-1] <= 0.100001)).toBe(true);
  });
  it('does not invent a timeline for invalid or empty media', () => {
    for (const duration of [NaN, Infinity, 0, -1]) expect(nextVideoFrame(0,duration)).toBeNull();
  });
  it('waits for seeked, rather than treating seek initiation as a decoded frame', async () => {
    const video = document.createElement('video');
    let done = false;
    const pending = seekVideoFrame(video, 0.25).then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    expect(video.currentTime).toBe(0.25);
    video.dispatchEvent(new Event('seeked'));
    await pending;
    expect(done).toBe(true);
  });
  it('cancels a pending seek when the source changes or the view unmounts', async () => {
    const controller = new AbortController();
    const pending = seekVideoFrame(document.createElement('video'), 0.2, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
  });
  it('reports a decoding timeout instead of leaving analysis stuck forever', async () => {
    vi.useFakeTimers();
    const pending = seekVideoFrame(document.createElement('video'), 0.2);
    const result = expect(pending).rejects.toThrow('Não foi possível ler');
    await vi.advanceTimersByTimeAsync(10000);
    await result;
  });
});
