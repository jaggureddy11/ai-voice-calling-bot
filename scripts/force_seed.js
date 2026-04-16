require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function forceSeed() {
    console.log('Force clearing operators...');
    // Delete all operators
    const { error: delErr } = await supabase.from('operators').delete().neq('id', 'dummy'); 
    if (delErr) { console.error('Delete error:', delErr); return; }

    const operators = [
      { id: 'abhibus', name: 'Abhibus', tag: 'Smart Partner', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/da/53/3b/da533b00-49a9-1924-4081-7c359e29a306/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg' },
      { id: 'redbus', name: 'Redbus', tag: 'Global', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/6c/5e/69/6c5e69e7-7df0-2c27-ed2d-1d6d0c02fd03/AppIconiOS26-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/512x512bb.jpg' },
      { id: 'cleartrip', name: 'Cleartrip', tag: 'Premium', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6a/db/5f/6adb5f7d-b581-202b-2e95-5b0b79e3cc91/AppIcon-0-0-1x_U007emarketing-0-8-0-0-85-220.png/512x512bb.jpg' },
      { id: 'goibibo', name: 'Goibibo', tag: 'Popular', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/22/08/9c/22089c0f-7ae0-fc05-85fc-f3308649c21d/appIconSet-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.jpg' }
    ];

    console.log('Inserting correct operators...');
    const { data, error } = await supabase.from('operators').insert(operators).select();
    if (error) {
        console.error('Insert error:', error);
    } else {
        console.log('Successfully inserted:', data.length, 'operators');
    }
}
forceSeed();
