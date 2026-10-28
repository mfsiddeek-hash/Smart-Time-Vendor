import { createClient } from '@supabase/supabase-js';

// Supabase Project Configuration for "Ledger Book"
export const SUPABASE_PROJECT_NAME = 'Ledger Book';
export const SUPABASE_PROJECT_ID = 'actfubmcannmqvbsmmgv';
export const SUPABASE_URL = 'https://actfubmcannmqvbsmmgv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4hVe_Sx-L1MoDg1r9_nNRA_O_vKuLtG';

// Environment variable overrides if defined
const activeUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || SUPABASE_URL)
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

const activeKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || 
  SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(activeUrl, activeKey);