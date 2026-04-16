require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    console.log('Fetching operators from:', process.env.SUPABASE_URL);
    const { data, error } = await supabase.from('operators').select('*');
    if (error) { 
        console.error('Error fetching operators:', error); 
    } else {
        console.log('Database Operators Content (Count: ' + data.length + '):');
        console.log(JSON.stringify(data, null, 2));
    }
}
check();
