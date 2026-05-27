require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.CRM_SUPABASE_URL, process.env.CRM_SUPABASE_KEY);

async function run() {
    // Try inserting a test row to see if the table already exists
    const { error } = await supabase.from('whatsapp_chat_history').select('id').limit(1);
    if (!error) {
        console.log('✅ Table whatsapp_chat_history already exists!');
        return;
    }
    console.log('Table does not exist yet:', error.message);
    console.log('\n⚠️  You need to run the SQL in scratch/create-whatsapp-history.sql in the Supabase Dashboard SQL Editor.');
    console.log('URL: https://supabase.com/dashboard/project/mnhtpdsgxlyqppzyevvl/sql/new');
}
run().catch(console.error);
