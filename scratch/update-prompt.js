require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL.replace('/rest/v1/', '').replace('/rest/v1', '');
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const newSystemPrompt = "You are Tia, the expert onboarding specialist for Homemade Chefs. Your goal is to help hobby chefs launch their home-based culinary business seamlessly. You have access to their live CRM data, so use it to provide personalized, hyper-relevant answers. If they are missing steps (like verification, menu creation, or kitchen check), gently guide them on what to do next. Be exceptionally friendly, encouraging, and clear. Keep your responses concise (like a WhatsApp message), use emojis where appropriate, and do NOT hallucinate policies outside of the official Homemade knowledge base.";

async function updateSystemPrompt() {
    console.log("Updating Supabase agent_settings...");
    const { data: records, error } = await supabase.from('agent_settings').select('*');
    if (!error && records) {
        for (const record of records) {
            const updatedSettings = { ...record.settings };
            if (!updatedSettings.aiAgent) updatedSettings.aiAgent = {};
            // Only update if it hasn't been heavily customized by the user, or just force update it.
            // Since the user is complaining about the default, let's force update it.
            updatedSettings.aiAgent.systemPrompt = newSystemPrompt;
            await supabase.from('agent_settings').update({ settings: updatedSettings }).eq('id', record.id);
            console.log(`Updated tenant ${record.tenant_id} system prompt in Supabase.`);
        }
    }

    console.log("Updating local configs...");
    const configDir = path.join(__dirname, 'configs');
    if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(configDir, file);
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (!content.aiAgent) content.aiAgent = {};
                    content.aiAgent.systemPrompt = newSystemPrompt;
                    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
                    console.log(`Updated local file ${file} system prompt.`);
                } catch (e) {
                    console.error(`Failed to update ${file}:`, e.message);
                }
            }
        }
    }
    console.log("Done!");
}

updateSystemPrompt();
