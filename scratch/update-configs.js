require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL.replace('/rest/v1/', '').replace('/rest/v1', '');
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const newRules = [
    { trigger: "price, cost, plan, plans", response: "You can choose a yearly commission-only plan (10%, 12%, or 14%) or a monthly plan that combines a small base fee (€25/€35/€45) with a lower commission (5%/6%/7%). Yearly is the default." },
    { trigger: "commission, fee", response: "Commission is taken from the gross order value, which includes delivery fees and VAT." },
    { trigger: "cancel, refund", response: "Within the first 10 minutes — no fee, but contact the customer. After 10 minutes — a €15 handling fee, and we ask you to make it right. 3+ cancellations in 3 months triggers a support call and may pause orders." },
    { trigger: "kvk, nvwa, haccp", response: "Yes — KVK + NVWA registration and HACCP compliance are mandatory. We also recommend at least €1,000,000 liability insurance." },
    { trigger: "contract, term", response: "Yearly plans run for 12 months from signing. Monthly plans renew each month with 30 days' notice." },
    { trigger: "switch, upgrade, downgrade", response: "Yes — you can upgrade any time. Pro and Pro Plus can also downgrade." },
    { trigger: "help, call, tia, onboarding specialist", response: "Yes — book a call with Tia, our onboarding specialist: https://calendly.com/homemademeals-info/launch-assistance" },
    { trigger: "kitchen, check", response: "Upload 2 kitchen photos + 1 fridge photo. Our AI scores Hygiene, Fridge Safety, and Storage. 70+ passes; 55–69 conditional; <55 fail. Re-check monthly." },
    { trigger: "quiz, safety", response: "80% or higher. You'll watch 5 short training videos first." },
    { trigger: "online, offline, status", response: "You're Online (green) only when you're accepting orders AND within your opening hours. Otherwise you're Offline (gray)." }
];

const newSystemPrompt = "You are Tia, the expert onboarding specialist for Homemade Chefs. Your goal is to help hobby chefs launch their home-based culinary business seamlessly. You have access to their live CRM data, so use it to provide personalized, hyper-relevant answers. If they are missing steps (like verification, menu creation, or kitchen check), gently guide them on what to do next. Be exceptionally friendly, encouraging, and clear. Keep your responses concise (like a WhatsApp message), use emojis where appropriate, and do NOT hallucinate policies outside of the official Homemade knowledge base.";

async function updateConfigs() {
    console.log("Updating Supabase agent_settings...");
    const { data: records, error } = await supabase.from('agent_settings').select('*');
    if (!error && records) {
        for (const record of records) {
            const updatedSettings = { ...record.settings };
            
            if (!updatedSettings.autoReply) updatedSettings.autoReply = {};
            updatedSettings.autoReply.rules = newRules;
            
            if (!updatedSettings.aiAgent) updatedSettings.aiAgent = {};
            updatedSettings.aiAgent.systemPrompt = newSystemPrompt;

            const res = await supabase.from('agent_settings').update({ settings: updatedSettings }).eq('tenant_id', record.tenant_id);
            if (res.error) {
                console.error(`Failed to update tenant ${record.tenant_id}:`, res.error);
            } else {
                console.log(`Updated tenant ${record.tenant_id} in Supabase.`);
            }
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
                    if (!content.autoReply) content.autoReply = {};
                    content.autoReply.rules = newRules;
                    
                    if (!content.aiAgent) content.aiAgent = {};
                    content.aiAgent.systemPrompt = newSystemPrompt;
                    
                    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
                    console.log(`Updated local file ${file}.`);
                } catch (e) {
                    console.error(`Failed to update ${file}:`, e.message);
                }
            }
        }
    }
    console.log("Done!");
}

updateConfigs();
