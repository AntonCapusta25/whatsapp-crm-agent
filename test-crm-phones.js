require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

let crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
if (crmSupabaseUrl && crmSupabaseUrl.includes('/rest/v1')) {
    crmSupabaseUrl = crmSupabaseUrl.split('/rest/v1')[0];
}
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

(async () => {
    const { data, error } = await crmSupabase.from('chef_profiles').select('contact_phone').limit(10);
    console.log("Sample phones from CRM:", data);
    process.exit(0);
})();
