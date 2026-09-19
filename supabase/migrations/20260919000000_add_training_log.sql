CREATE TABLE public.training_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Meu treino',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.training_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES public.training_workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL CHECK (exercise_id IN ('squat', 'bicep-curl', 'bench-press', 'lunge', 'row')),
  exercise_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  posture_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.training_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_exercise_id UUID NOT NULL REFERENCES public.training_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  target_reps INTEGER NOT NULL DEFAULT 10 CHECK (target_reps > 0),
  actual_reps INTEGER CHECK (actual_reps >= 0),
  load_kg NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (load_kg >= 0),
  correct_reps INTEGER NOT NULL DEFAULT 0 CHECK (correct_reps >= 0),
  warning_reps INTEGER NOT NULL DEFAULT 0 CHECK (warning_reps >= 0),
  error_reps INTEGER NOT NULL DEFAULT 0 CHECK (error_reps >= 0),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (workout_exercise_id, set_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_workouts, public.training_exercises, public.training_sets TO authenticated;
GRANT ALL ON public.training_workouts, public.training_exercises, public.training_sets TO service_role;

ALTER TABLE public.training_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own training workouts" ON public.training_workouts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage exercises from their workouts" ON public.training_exercises
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.training_workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));

CREATE POLICY "Users manage sets from their workouts" ON public.training_sets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_exercises e
    JOIN public.training_workouts w ON w.id = e.workout_id
    WHERE e.id = workout_exercise_id AND w.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_exercises e
    JOIN public.training_workouts w ON w.id = e.workout_id
    WHERE e.id = workout_exercise_id AND w.user_id = auth.uid()
  ));

CREATE INDEX training_workouts_user_created_idx ON public.training_workouts (user_id, created_at DESC);
CREATE INDEX training_exercises_workout_idx ON public.training_exercises (workout_id, position);
CREATE INDEX training_sets_exercise_idx ON public.training_sets (workout_exercise_id, set_number);
