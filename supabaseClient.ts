import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rjgpyslopnxvnyfqiaqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_D3UrI8KqswYUWQJ0cBUgKw_cU-TPBM5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);