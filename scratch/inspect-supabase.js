require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const supabase = createClient(crmSupabaseUrl, crmSupabaseKey);

async function checkTables() {
    const { data, error } = await supabase.from('chefs').select('*').limit(1);
    console.log("Chefs:", error ? error.message : "OK");
    
    // We can also try fetching the OpenAPI spec or introspecting the DB
    const res = await fetch(`${crmSupabaseUrl}/rest/v1/`, {
        headers: {
            'apikey': crmSupabaseKey
        }
    });
    if (res.ok) {
        const schema = await res.json();
        console.log("Tables:", Object.keys(schema.definitions));
    } else {
        console.error("Failed to get schema");
    }
}

checkTables();
