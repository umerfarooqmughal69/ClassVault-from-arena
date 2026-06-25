import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to generate email from username
export function usernameToEmail(username: string): string {
  return `${username}@classvault.app`;
}

// Helper to extract username from email
export function emailToUsername(email: string): string {
  return email.replace('@classvault.app', '');
}
