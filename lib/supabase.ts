import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ImportedRepo {
  id: string;
  user_id: string;
  repo_id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  homepage: string;
  language: string;
  stars: number;
  forks: number;
  open_issues: number;
  topics: string[];
  created_at: string;
  updated_at: string;
}

export interface RepoNote {
  id: string;
  user_id: string;
  repo_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}
