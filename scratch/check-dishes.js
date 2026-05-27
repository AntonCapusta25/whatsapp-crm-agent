require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.CRM_SUPABASE_URL, process.env.CRM_SUPABASE_KEY);
(async () => {
    const { data, error } = await s.from('dishes').select('*').limit(1);
    if (error) { console.error('dishes error:', error.message); return; }
    console.log('dishes columns:', data && data[0] ? Object.keys(data[0]) : 'empty');
    if (data && data[0]) console.log('sample:', JSON.stringify(data[0], null, 2));
    
    // Also check chef_admin_data and chef_admin_notes
    const { data: d2 } = await s.from('chef_admin_data').select('*').limit(1);
    console.log('\nchef_admin_data columns:', d2 && d2[0] ? Object.keys(d2[0]) : 'empty');
    const { data: d3 } = await s.from('chef_admin_notes').select('*').limit(1);
    console.log('chef_admin_notes columns:', d3 && d3[0] ? Object.keys(d3[0]) : 'empty');
})();
