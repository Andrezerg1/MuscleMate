export const TRAINING_EXERCISES = [
  { id: 'squat', name: 'Agachamento', analysisId: 'squat' },
  { id: 'bicep-curl', name: 'Rosca Direta', analysisId: 'bicep-curl' },
  { id: 'bench-press', name: 'Supino', analysisId: 'bench-press' },
  { id: 'lunge', name: 'Afundo', analysisId: 'lunge' },
  { id: 'row', name: 'Remada', analysisId: null },
] as const;

export interface TrainingSet {
  id: string;
  setNumber: number;
  targetReps: number;
  actualReps: number | null;
  loadKg: number;
  correctReps: number;
  warningReps: number;
  errorReps: number;
  completed: boolean;
}

export interface TrainingExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  analysisId: string | null;
  postureEnabled: boolean;
  sets: TrainingSet[];
}

export interface TrainingWorkout {
  id: string;
  name: string;
  status: 'active' | 'completed';
  startedAt: string;
  completedAt: string | null;
  exercises: TrainingExercise[];
}

export const newId = () => crypto.randomUUID();
export const newSet = (setNumber: number): TrainingSet => ({
  id: newId(), setNumber, targetReps: 0, actualReps: null, loadKg: 0,
  correctReps: 0, warningReps: 0, errorReps: 0, completed: false,
});

export function workoutTotals(workout: TrainingWorkout) {
  const sets = workout.exercises.flatMap(exercise => exercise.sets);
  return {
    exercises: workout.exercises.length,
    sets: sets.length,
    completedSets: sets.filter(set => set.completed).length,
    reps: sets.reduce((sum, set) => sum + (set.actualReps ?? 0), 0),
    volume: sets.reduce((sum, set) => sum + (set.actualReps ?? 0) * set.loadKg, 0),
  };
}

const GUEST_KEY = 'musclemate-training-workouts';
export function loadGuestWorkouts(): TrainingWorkout[] {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]') as TrainingWorkout[]; }
  catch { return []; }
}
export function saveGuestWorkouts(workouts: TrainingWorkout[]) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(workouts));
}
export function applyPostureResults(workouts: TrainingWorkout[], trainingExerciseId: string, series: Array<{ reps: number; correct: number; warning: number; error: number }>) {
  return workouts.map(workout => ({ ...workout, exercises: workout.exercises.map(exercise => exercise.id !== trainingExerciseId ? exercise : ({
    ...exercise,
    sets: exercise.sets.map((set,index) => series[index] ? ({ ...set, actualReps: series[index].reps, correctReps: series[index].correct, warningReps: series[index].warning, errorReps: series[index].error, completed: true }) : set),
  })) }));
}
