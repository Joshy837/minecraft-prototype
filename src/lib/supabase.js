import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://rgedimjvxjzjyszbzaqy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZWRpbWp2eGp6anlzemJ6YXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDMwNjIsImV4cCI6MjA5NTQ3OTA2Mn0.4gY1Vx0UJQziLYxseBe3J2NDfrojV_JAIBL7e2CL4F0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Signs in anonymously once per browser, reuses session on subsequent visits
export async function ensureAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}
