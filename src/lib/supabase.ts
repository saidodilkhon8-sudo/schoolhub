import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'schoolhub_supabase_url';
const STORAGE_KEY_KEY = 'schoolhub_supabase_anon_key';

export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : null;

  const url = (envUrl && envUrl !== 'https://your-project.supabase.co') ? envUrl : (localUrl || '');
  const key = (envKey && envKey !== 'your-anon-key') ? envKey : (localKey || '');

  return {
    url,
    key,
    isConfigured: Boolean(url && key && url.startsWith('http')),
  };
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    window.location.reload();
  }
}

export function clearSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_KEY);
    window.location.reload();
  }
}

const creds = getSupabaseCredentials();

// Provide valid fallback format so createClient does not throw on module evaluation
const effectiveUrl = creds.url || 'https://placeholder.supabase.co';
const effectiveKey = creds.key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
