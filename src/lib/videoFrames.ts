// Sample the media timeline, not the machine's processing time.
export const VIDEO_FRAME_STEP = 0.1;
export function nextVideoFrame(time: number, duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const end = Math.max(0, duration - 0.05);
  return time >= end - 0.001 ? null : Math.min(end, time + VIDEO_FRAME_STEP);
}

export function seekVideoFrame(video: HTMLVideoElement, time: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', failed);
      signal?.removeEventListener('abort', aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Não foi possível ler o quadro do vídeo.')); };
    const aborted = () => { cleanup(); reject(new DOMException('Análise interrompida', 'AbortError')); };
    const timer = setTimeout(failed, 10000);
    if (signal?.aborted) { aborted(); return; }
    if (Math.abs(video.currentTime-time) < 0.001 && video.readyState >= 2) { done(); return; }
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal?.addEventListener('abort', aborted, { once: true });
    video.currentTime = time;
  });
}
