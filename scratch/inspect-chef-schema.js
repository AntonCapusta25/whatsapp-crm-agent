require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const supabase = createClient(crmSupabaseUrl, crmSupabaseKey);

async function run() {
    // Get one chef_profile with all nested data
    const { data: profile, error: e1 } = await supabase
        .from('chef_profiles')
        .select('*')
        .limit(1)
        .single();
    if (e1) { console.error('chef_profiles:', e1.message); } else {
        console.log('chef_profiles columns:', Object.keys(profile));
        console.log('chef_profile sample:', profile);
    }

    // Check chef_activities columns
    const { data: act, error: e2 } = await supabase
        .from('chef_activities')
        .select('*')
        .limit(1);
    if (e2) { console.error('chef_activities:', e2.message); } else {
        console.log('\nchef_activities columns:', act && act[0] ? Object.keys(act[0]) : 'empty');
    }

    // Check merchants columns (to see if profile links to merchants)
    const { data: merch, error: e3 } = await supabase
        .from('merchants')
        .select('*')
        .limit(1);
    if (e3) { console.error('merchants:', e3.message); } else {
        console.log('\nmerchants columns:', merch && merch[0] ? Object.keys(merch[0]) : 'empty');
        if (merch && merch[0]) console.log('sample merchant:', JSON.stringify(merch[0], null, 2));
    }

    // Check pending_profiles columns
    const { data: pp, error: e4 } = await supabase
        .from('pending_profiles')
        .select('*')
        .limit(1);
    if (e4) { console.error('pending_profiles:', e4.message); } else {
        console.log('\npending_profiles columns:', pp && pp[0] ? Object.keys(pp[0]) : 'empty');
    }

    // Check menus columns
    const { data: menus, error: e5 } = await supabase
        .from('menus')
        .select('*')
        .limit(1);
    if (e5) { console.error('menus:', e5.message); } else {
        console.log('\nmenus columns:', menus && menus[0] ? Object.keys(menus[0]) : 'empty');
    }
}
run().catch(console.error);
