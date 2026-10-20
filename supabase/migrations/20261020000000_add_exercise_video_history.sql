CREATE TABLE public.exercise_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  video_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (video_duration_seconds >= 0),
  analysis_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (analysis_duration_seconds >= 0),
  reps INTEGER NOT NULL DEFAULT 0 CHECK (reps >= 0),
  correct_reps INTEGER NOT NULL DEFAULT 0 CHECK (correct_reps >= 0),
  warning_reps INTEGER NOT NULL DEFAULT 0 CHECK (warning_reps >= 0),
  error_reps INTEGER NOT NULL DEFAULT 0 CHECK (error_reps >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exercise_videos_user_exercise_created_idx
  ON public.exercise_videos (user_id, exercise_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_videos TO authenticated;
GRANT ALL ON public.exercise_videos TO service_role;

ALTER TABLE public.exercise_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own exercise videos" ON public.exercise_videos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-videos',
  'exercise-videos',
  false,
  209715200,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Users can view their own exercise videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exercise-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their own exercise videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own exercise videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exercise-videos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'exercise-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own exercise videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exercise-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Registros antigos de afundo continuam legíveis, mas novas inclusões ficam
-- limitadas aos quatro exercícios disponíveis no registro de treino.
ALTER TABLE public.training_exercises
  DROP CONSTRAINT IF EXISTS training_exercises_exercise_id_check;

ALTER TABLE public.training_exercises
  ADD CONSTRAINT training_exercises_exercise_id_check
  CHECK (exercise_id IN ('squat', 'bicep-curl', 'bench-press', 'row')) NOT VALID;
