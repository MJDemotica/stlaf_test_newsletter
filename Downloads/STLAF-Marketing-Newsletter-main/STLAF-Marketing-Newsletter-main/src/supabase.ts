//
// File: supabase.ts
// Author: <your name>
// Date: <today's date>
// Purpose: Initializes and exports the Supabase client (replaces firebase.ts)
//

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in your .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);