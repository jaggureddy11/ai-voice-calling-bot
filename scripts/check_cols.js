require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    console.log('Buses:');
    const { data: b, error: e1 } = await supabase.from('buses').select('*').limit(1);
    console.log(e1 || Object.keys(b[0] || {}));
    
    console.log('\nPassengers:');
    const { data: p, error: e2 } = await supabase.from('passengers').select('*').limit(1);
    console.log(e2 || Object.keys(p[0] || {}));
}
check();
