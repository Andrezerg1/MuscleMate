import { describe, expect, it } from 'vitest';
import type { Keypoint } from '@tensorflow-models/pose-detection';
import { analyzeDeadlift, DEADLIFT_POSTURE_LIMITS, KEYPOINTS } from '@/lib/poseUtils';

function poseWithHipAngle(angle: number): Keypoint[] {
  const points = Array.from({ length: 17 }, () => ({ x: 0, y: 0, score: 0 })) as Keypoint[];
  const radians = angle * Math.PI / 180;
  points[KEYPOINTS.RIGHT_HIP] = { x: 0, y: 0, score: 0.99 };
  points[KEYPOINTS.RIGHT_KNEE] = { x: 100, y: 0, score: 0.99 };
  points[KEYPOINTS.RIGHT_SHOULDER] = {
    x: Math.cos(radians) * 100,
    y: Math.sin(radians) * 100,
    score: 0.99,
  };
  return points;
}

describe('analyzeDeadlift', () => {
  it.each([180, 160, 140, 125, 67, DEADLIFT_POSTURE_LIMITS.controlled])(
    'aceita %s° como parte da amplitude normal',
    (angle) => expect(analyzeDeadlift(poseWithHipAngle(angle))?.level).toBe('correct'),
  );

  it('gera aviso apenas abaixo da faixa controlada', () => {
    expect(analyzeDeadlift(poseWithHipAngle(60))?.level).toBe('warning');
  });

  it('reserva erro para inclinação realmente excessiva', () => {
    expect(analyzeDeadlift(poseWithHipAngle(45))?.level).toBe('error');
  });
});
