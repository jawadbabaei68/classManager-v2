import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Keys for local storage
export const STORAGE_KEY_URL = 'my_school_supabase_url';
export const STORAGE_KEY_KEY = 'my_school_supabase_key';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const url = localStorage.getItem(STORAGE_KEY_URL);
  const key = localStorage.getItem(STORAGE_KEY_KEY);

  if (url && key) {
    try {
      supabaseInstance = createClient(url, key);
      return supabaseInstance;
    } catch (e) {
      console.error("Failed to initialize Supabase", e);
      return null;
    }
  }
  return null;
};

export const hasSupabaseConfig = (): boolean => {
  return !!localStorage.getItem(STORAGE_KEY_URL) && !!localStorage.getItem(STORAGE_KEY_KEY);
};

export const saveSupabaseConfig = (url: string, key: string) => {
  if (!url) throw new Error("آدرس Supabase نمی تواند خالی باشد");
  if (!key) throw new Error("کلید Supabase نمی تواند خالی باشد");
  
  // Basic URL validation
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error("آدرس باید با http:// یا https:// شروع شود");
  }

  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
  
  // Re-initialize immediately so the app can use it without reload
  try {
    supabaseInstance = createClient(url, key);
  } catch (error: any) {
    // If initialization fails, revert changes locally to avoid broken state? 
    // Or just let the user retry. We'll clear the instance to be safe.
    supabaseInstance = null;
    throw new Error("خطا در ایجاد ارتباط با Supabase: " + error.message);
  }
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  supabaseInstance = null;
};