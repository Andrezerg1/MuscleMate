import { describe, expect, it } from 'vitest';
import type { Keypoint, Pose } from '@tensorflow-models/pose-detection';
import { selectPrimaryPose } from '@/lib/poseSelector';

function person(id: number, centerX: number, centerY: number, size: number): Pose {
  const points = Array.from({ length: 17 }, (_, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      x: centerX + (column - 1.5) * size / 3,
      y: centerY + (row - 2) * size / 4,
      score: 0.9,
    } as Keypoint;
  });
  return { id, keypoints: points, score: 0.9 };
}

describe('selectPrimaryPose', () => {
  it('prioriza a pessoa maior e mais próxima da câmera', () => {
    const selected = selectPrimaryPose([person(1, 320, 240, 100), person(2, 330, 250, 320)], 640, 480);
    expect(selected?.pose.id).toBe(2);
  });

  it('mantém a identidade do atleta quando alguém cruza o fundo', () => {
    const athlete = person(7, 320, 250, 280);
    const first = selectPrimaryPose([athlete], 640, 480);
    const crossingPerson = person(8, 260, 230, 250);
    const next = selectPrimaryPose([crossingPerson, athlete], 640, 480, first?.identity);
    expect(next?.pose.id).toBe(7);
  });

  it('ignora detecções incompletas', () => {
    const incomplete = person(3, 320, 240, 400);
    incomplete.keypoints.forEach((point, index) => { if (index > 3) point.score = 0.1; });
    expect(selectPrimaryPose([incomplete], 640, 480)).toBeNull();
  });

  it('aceita uma pose mobile com cinco pontos confiáveis', () => {
    const mobilePose = person(4, 320, 240, 260);
    mobilePose.keypoints.forEach((point, index) => { point.score = index < 5 ? 0.8 : 0.2; });
    expect(selectPrimaryPose([mobilePose], 640, 480)?.pose.id).toBe(4);
  });
});
