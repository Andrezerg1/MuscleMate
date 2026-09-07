import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Public browser configuration; Supabase RLS controls access to user data.
// Pin the app to this project so stale environment variables cannot reconnect it.
export const SUPABASE_PROJECT_ID = 'khjkayzjlizajambzgvy';
export const SUPABASE_URL = 'https://khjkayzjlizajambzgvy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hpMkqPzVGrEOgM2d6sosNw_zvoX4sfy';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: `musclemate-${SUPABASE_PROJECT_ID}-auth`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
