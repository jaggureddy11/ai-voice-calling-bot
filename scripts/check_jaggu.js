require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data: p, error: e2 } = await supabase.from('passengers').select('*').eq('name', 'Jaggu');
    console.log(e2 || p);
}
check();
