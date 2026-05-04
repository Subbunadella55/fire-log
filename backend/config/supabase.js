const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// The Service Role Key is required to bypass RLS from a secure backend environment
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Supabase] Client initialized');
} else {
    console.log('[Supabase] Keys not found, Supabase client NOT initialized. Please check your .env file');
}

module.exports = supabase;
