require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const supabase = createClient(crmSupabaseUrl, crmSupabaseKey);

async function checkTables() {
    const { data: messages, error: err1 } = await supabase.from('chat_messages').select('*').limit(2);
    console.log("Chat Messages:", err1 ? err1.message : messages);

    const { data: cols, error: err2 } = await supabase.rpc('get_schema_info', {}); // Or we can just use OpenAPI spec
    
    const res = await fetch(`${crmSupabaseUrl}/rest/v1/`, {
        headers: { 'apikey': crmSupabaseKey }
    });
    if (res.ok) {
        const schema = await res.json();
        console.log("chat_messages columns:", Object.keys(schema.definitions.chat_messages.properties));
        // what about something like ai_interactions?
        const tables = Object.keys(schema.definitions);
        console.log("Tables with 'ai' or 'history' or 'interaction':", tables.filter(t => t.includes('ai') || t.includes('hist') || t.includes('interact')));
    }
}
checkTables();
