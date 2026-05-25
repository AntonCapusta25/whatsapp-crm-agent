require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Helper to parse arguments
function getArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, val] = arg.split('=');
            const cleanKey = key.replace('--', '');
            args[cleanKey] = val !== undefined ? val : true;
        }
    });
    return args;
}

const args = getArgs();
const tenantId = args.tenant || 'default';
const port = args.port || process.env.PORT || '3005';
const host = args.host || 'localhost';
const isDryRun = !!args['dry-run'];

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const webhookApiKey = process.env.WEBHOOK_API_KEY;

console.log('--- Catering No-Answer Backfill Script ---');
console.log(`Config: Tenant=${tenantId}, Server=${host}:${port}, DryRun=${isDryRun}`);

if (!crmSupabaseUrl || !crmSupabaseKey) {
    console.error('❌ Missing CRM_SUPABASE_URL or CRM_SUPABASE_KEY in environment variables.');
    process.exit(1);
}

if (!webhookApiKey) {
    console.error('❌ Missing WEBHOOK_API_KEY in environment variables. Auth bypass won\'t work.');
    process.exit(1);
}

const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

function sanitizePhone(phone) {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }
    // Handle Dutch country code +31 (0) formatting where (0) becomes 310...
    if (cleaned.startsWith('310') && cleaned.length >= 10) {
        cleaned = '31' + cleaned.substring(3);
    }
    // Convert local Dutch mobile (06...) to international (316...)
    if (cleaned.startsWith('06') && cleaned.length === 10) {
        cleaned = '316' + cleaned.substring(2);
    } 
    // Convert local Dutch mobile without leading 0 (6...) to international (316...)
    else if (cleaned.startsWith('6') && cleaned.length === 9) {
        cleaned = '316' + cleaned.substring(1);
    } 
    // Convert other local Dutch numbers (0...) to international (31...)
    else if (cleaned.startsWith('0') && cleaned.length >= 9) {
        cleaned = '31' + cleaned.substring(1);
    }
    return cleaned;
}

async function runBackfill() {
    try {
        console.log('🔌 Connecting to CRM Supabase...');
        const { data: leads, error } = await crmSupabase
            .from('catering_leads')
            .select('id, customer_name, phone, status, created_at')
            .eq('status', 'no_answer')
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        console.log(`📊 Found ${leads.length} catering leads with status 'no_answer'.`);

        if (leads.length === 0) {
            console.log('✅ No leads to backfill.');
            return;
        }

        let processedCount = 0;
        let skippedCount = 0;
        let successCount = 0;
        let failedCount = 0;

        for (const lead of leads) {
            const rawPhone = lead.phone;
            const name = lead.customer_name || '';
            const cleanedPhone = sanitizePhone(rawPhone);

            if (!cleanedPhone) {
                console.log(`⚠️ Skip [${lead.id}] - No valid phone number. Name: "${name}", Phone: "${rawPhone}"`);
                skippedCount++;
                continue;
            }

            const firstName = name.trim().split(' ')[0];
            const greeting = firstName ? `Hey ${firstName}, ` : `Hey! `;
            const messageText = `${greeting}we tried calling you regarding your catering request but it looks like you were not available. Let us know when is a good time to reach you, or if you prefer, we can just chat right here!`;

            console.log(`👉 Processing [${lead.id}]: "${name}" (${cleanedPhone})`);

            if (isDryRun) {
                console.log(`   [DRY RUN] Would send to ${tenantId}: "${messageText}"`);
                successCount++;
                processedCount++;
                continue;
            }

            // Dispatch message via Server API
            const url = `http://${host}:${port}/api/${tenantId}/send`;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${webhookApiKey}`
                    },
                    body: JSON.stringify({
                        phone: cleanedPhone,
                        message: messageText
                    })
                });

                const result = await response.json();
                if (response.ok && result.success) {
                    console.log(`   ✅ Success: ${result.message}`);
                    successCount++;
                } else {
                    console.error(`   ❌ Failed: ${JSON.stringify(result || response.statusText)}`);
                    failedCount++;
                }
            } catch (err) {
                console.error(`   ❌ Request Error:`, err.message);
                failedCount++;
            }

            processedCount++;
            // Small throttle to avoid hammering the local server
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log('------------------------------------------');
        console.log('Backfill Execution Summary:');
        console.log(`- Total leads found: ${leads.length}`);
        console.log(`- Processed:        ${processedCount}`);
        console.log(`- Skipped:          ${skippedCount}`);
        console.log(`- Successfully queued: ${successCount}`);
        console.log(`- Failed:           ${failedCount}`);
        console.log('------------------------------------------');

    } catch (e) {
        console.error('❌ Backfill failed with an error:', e.message);
    }
}

runBackfill();
