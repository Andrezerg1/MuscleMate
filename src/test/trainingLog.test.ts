import { describe, expect, it } from 'vitest';
import { applyPostureResults, newSet, workoutTotals, type TrainingWorkout } from '../lib/trainingLog';

const workout = (): TrainingWorkout => ({ id:'w1', name:'Treino A', status:'active', startedAt:'2026-09-19', completedAt:null, exercises:[{
  id:'e1', exerciseId:'squat', exerciseName:'Agachamento', analysisId:'squat', postureEnabled:true,
  sets:[{...newSet(1),id:'s1'},{...newSet(2),id:'s2'}],
}] });

describe('training log', () => {
  it('calculates completed sets, reps and volume', () => {
    const item = workout(); item.exercises[0].sets[0] = {...item.exercises[0].sets[0],completed:true,actualReps:10,loadKg:50};
    expect(workoutTotals(item)).toMatchObject({exercises:1,sets:2,completedSets:1,reps:10,volume:500});
  });
  it('applies posture results to matching sets', () => {
    const [updated] = applyPostureResults([workout()],'e1',[{reps:10,correct:7,warning:2,error:1}]);
    expect(updated.exercises[0].sets[0]).toMatchObject({completed:true,actualReps:10,correctReps:7,warningReps:2,errorReps:1});
    expect(updated.exercises[0].sets[1].completed).toBe(false);
  });
});
