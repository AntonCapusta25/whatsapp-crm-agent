require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

let supabaseUrl = process.env.SUPABASE_URL;
if (supabaseUrl && supabaseUrl.includes('/rest/v1')) {
    supabaseUrl = supabaseUrl.split('/rest/v1')[0];
}
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log(`🔌 Connecting to Supabase: ${supabaseUrl}`);
    const result = await supabase
        .from('whatsapp_sessions')
        .select('tenant_id, updated_at');
    console.log("Raw Result:", result);
    const { data, error } = result;

    console.log("📊 Records found in 'whatsapp_sessions' table:");
    if (data.length === 0) {
        console.log("⚠️ No sessions found in the database!");
    } else {
        console.table(data);
    }
}

run().catch(console.error);
