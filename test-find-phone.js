require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

let crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
if (crmSupabaseUrl && crmSupabaseUrl.includes('/rest/v1')) {
    crmSupabaseUrl = crmSupabaseUrl.split('/rest/v1')[0];
}
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

(async () => {
    const { data, error } = await crmSupabase.from('chef_profiles').select('contact_phone, chef_name').not('contact_phone', 'is', null);
    
    // Manual search through all rows to find variants
    const targetSuffix = "40090902";
    const found = data.filter(d => d.contact_phone.replace(/\D/g, '').endsWith(targetSuffix));
    console.log("Manual search result:", found);
    
    process.exit(0);
})();
