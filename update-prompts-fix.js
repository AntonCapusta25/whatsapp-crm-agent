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
    if (error) { console.error(error); return; }
    
    for (const row of rows) {
        let config = row.settings;
        if (!config || !config.aiAgent || !config.aiAgent.systemPrompt) continue;
        
        let prompt = config.aiAgent.systemPrompt;
        if (!prompt.includes('Amsterdam') && !prompt.includes('delivery')) {
            prompt += `\n\nCRITICAL INSTRUCTIONS:\n1. If the user is located in Amsterdam (check CRM data), ALWAYS mention or highlight this fact enthusiastically.\n2. If the user does Delivery (check CRM data for business model/plan), keep a close eye on them and offer extra support or tips specifically for delivery operations.`;
            
            config.aiAgent.systemPrompt = prompt;
            await supabase.from('agent_settings').update({ settings: config }).eq('tenant_id', row.tenant_id);
            console.log(`Updated prompt for tenant ${row.tenant_id}`);
        } else {
            console.log(`Tenant ${row.tenant_id} already has instructions.`);
        }
    }
    process.exit(0);
})();
