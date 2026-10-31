import type { Keypoint, Pose } from '@tensorflow-models/pose-detection';

export interface TrackedPoseIdentity {
  id?: number;
  centerX: number;
  centerY: number;
}

export interface PrimaryPoseSelection {
  pose: Pose;
  identity: TrackedPoseIdentity;
}

function visibleBounds(keypoints: Keypoint[]) {
  const visible = keypoints.filter(point => (point.score ?? 0) >= 0.25);
  if (visible.length < 5) return null;
  const xs = visible.map(point => point.x);
  const ys = visible.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    area: Math.max(1, right - left) * Math.max(1, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    confidence: visible.reduce((sum, point) => sum + (point.score ?? 0), 0) / visible.length,
    completeness: visible.length / keypoints.length,
  };
}

/**
 * Seleciona a pessoa mais provável de estar treinando: maior corpo visível
 * (proxy de proximidade), boa confiança e continuidade entre os quadros.
 */
export function selectPrimaryPose(
  poses: Pose[],
  frameWidth: number,
  frameHeight: number,
  previous?: TrackedPoseIdentity | null,
): PrimaryPoseSelection | null {
  const diagonal = Math.hypot(frameWidth, frameHeight) || 1;
  const frameArea = Math.max(1, frameWidth * frameHeight);
  const candidates = poses.flatMap(pose => {
    const bounds = visibleBounds(pose.keypoints);
    if (!bounds) return [];
    const centerDistance = Math.hypot(bounds.centerX - frameWidth / 2, bounds.centerY - frameHeight / 2) / diagonal;
    let continuity = 0;
    if (previous) {
      if (pose.id != null && previous.id != null && pose.id === previous.id) continuity = 0.45;
      else {
        const distance = Math.hypot(bounds.centerX - previous.centerX, bounds.centerY - previous.centerY) / diagonal;
        continuity = Math.max(0, 0.3 - distance);
      }
    }
    const score =
      Math.min(1, bounds.area / (frameArea * 0.45)) * 0.55 +
      bounds.confidence * 0.18 +
      bounds.completeness * 0.12 +
      Math.max(0, 1 - centerDistance * 2) * 0.15 +
      continuity;
    return [{ pose, bounds, score }];
  });

  const selected = candidates.sort((a, b) => b.score - a.score)[0];
  if (!selected) return null;
  return {
    pose: selected.pose,
    identity: {
      id: selected.pose.id,
      centerX: selected.bounds.centerX,
      centerY: selected.bounds.centerY,
    },
  };
}
