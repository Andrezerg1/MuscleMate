import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const requiredPublicConfig = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`Configuração pública ausente: ${name}`);
  return value;
};

// These values are public in the compiled browser app. RLS protects user data.
// Private keys such as service_role must never be exposed through VITE_* variables.
export const SUPABASE_PROJECT_ID = requiredPublicConfig('VITE_SUPABASE_PROJECT_ID', import.meta.env.VITE_SUPABASE_PROJECT_ID);
export const SUPABASE_URL = requiredPublicConfig('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_PUBLISHABLE_KEY = requiredPublicConfig('VITE_SUPABASE_PUBLISHABLE_KEY', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: `musclemate-${SUPABASE_PROJECT_ID}-auth`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
