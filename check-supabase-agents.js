require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

let supabaseUrl = process.env.SUPABASE_URL;
if (supabaseUrl && supabaseUrl.includes('/rest/v1')) {
    supabaseUrl = supabaseUrl.split('/rest/v1')[0];
}
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    const { data: rows, error } = await supabase.from('agent_settings').select('*');
    if (error) { console.error('Error:', error); return; }
    console.log("Tenants found:", rows.map(r => r.tenant_id));
    process.exit(0);
})();
