import { describe, expect, it } from 'vitest';
import { buildSeriesReport, buildWorkoutReport, workoutNotes } from '../lib/workoutSession';

describe('workout session reports', () => {
  it('classifies every completed attempt in the series total', () => {
    const report = buildSeriesReport('Rosca Direta', 1, { reps: 10, correct: 6, warning: 3, error: 1 }, 42, { 'Eleve menos o cotovelo': 2 });
    expect(report.correct + report.warning + report.error).toBe(report.reps);
    expect(report.accuracy).toBe(60);
    expect(report.points[0]).toEqual({ message: 'Eleve menos o cotovelo', count: 2 });
  });

  it('aggregates all series into one workout', () => {
    const first = buildSeriesReport('Agachamento', 1, { reps: 8, correct: 6, warning: 1, error: 1 }, 30, {});
    const second = buildSeriesReport('Agachamento', 2, { reps: 10, correct: 7, warning: 2, error: 1 }, 35, {});
    const workout = buildWorkoutReport('Agachamento', 3, [first, second], 90);
    expect(workout).toMatchObject({ completedSeries: 2, plannedSeries: 3, reps: 18, correct: 13, warning: 3, error: 2 });
    expect(workoutNotes(workout)).toContain('Séries: 2/3');
    expect(workoutNotes(workout)).toContain('Série 2: 7 corretas');
  });

  it('handles a series with no detected attempts', () => {
    const report = buildSeriesReport('Supino', 1, { reps: 0, correct: 0, warning: 0, error: 0 }, 12, {});
    expect(report.accuracy).toBe(0);
    expect(report.summary).toContain('Nenhuma repetição');
  });
});
