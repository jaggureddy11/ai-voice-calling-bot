require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase.from('operators').select('*').limit(1);
    if(error) console.log('Ping failed:', error);
    else console.log('Supabase Connection PERFECT. Total items returned:', data.length);
}
check();
