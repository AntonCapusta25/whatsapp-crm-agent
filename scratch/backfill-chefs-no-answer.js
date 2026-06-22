require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
const tenantId = args.tenant || 'napoleon';
const port = args.port || process.env.PORT || '3005';
const host = args.host || 'localhost';
const isDryRun = !!args['dry-run'];
const limit = args.limit ? parseInt(args.limit) : null;
const delayMs = args.delay ? parseInt(args.delay) : 500;

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const webhookApiKey = process.env.WEBHOOK_API_KEY;

console.log('--- Chef No-Answer Backfill Script ---');
console.log(`Config: Tenant=${tenantId}, Server=${host}:${port}, DryRun=${isDryRun}, Limit=${limit || 'None'}, Delay=${delayMs}ms`);

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
    if (cleaned.startsWith('310') && cleaned.length >= 10) {
        cleaned = '31' + cleaned.substring(3);
    }
    if (cleaned.startsWith('06') && cleaned.length === 10) {
        cleaned = '316' + cleaned.substring(2);
    } 
    else if (cleaned.startsWith('6') && cleaned.length === 9) {
        cleaned = '316' + cleaned.substring(1);
    } 
    else if (cleaned.startsWith('0') && cleaned.length >= 9) {
        cleaned = '31' + cleaned.substring(1);
    }
    return cleaned;
}

const DEFAULT_TEMPLATE = "Hey{Name}, we tried calling you regarding your Homemade application but it looks like you were not available. Let us know when is a good time to reach you, or if you prefer, we can just chat right here!";

async function runBackfill() {
    try {
        // Fetch Tenant Config from Server API to get customized message template if any
        let template = DEFAULT_TEMPLATE;
        console.log(`🔌 Fetching configuration for tenant '${tenantId}'...`);
        const configUrl = `http://${host}:${port}/api/${tenantId}/config`;
        try {
            const configResponse = await fetch(configUrl, {
                headers: { 'Authorization': `Bearer ${webhookApiKey}` }
            });
            if (configResponse.ok) {
                const configResult = await configResponse.ok ? await configResponse.json() : null;
                if (configResult && configResult.success && configResult.config && configResult.config.noAnswerFollowupMessage) {
                    template = configResult.config.noAnswerFollowupMessage;
                    console.log(`✅ Loaded tenant custom template: "${template}"`);
                }
            }
        } catch (configErr) {
            console.log(`ℹ️ Could not fetch config from server (${configErr.message}). Using default template.`);
        }

        console.log('🔌 Connecting to CRM Supabase...');
        const { data: adminData, error: adminErr } = await crmSupabase
            .from('chef_admin_data')
            .select('id, chef_profile_id, updated_at, call_attempts, admin_status')
            .eq('admin_status', 'called_no_answer');

        if (adminErr) {
            throw adminErr;
        }

        console.log(`📊 Found ${adminData.length} chef admin data records with status 'called_no_answer'.`);

        if (adminData.length === 0) {
            console.log('✅ No chefs to backfill.');
            return;
        }

        const chefProfileIds = adminData.map(r => r.chef_profile_id).filter(Boolean);
        
        console.log(`🔌 Fetching chef profiles...`);
        const { data: profiles, error: profileErr } = await crmSupabase
            .from('chef_profiles')
            .select('id, chef_name, contact_phone, created_at')
            .in('id', chefProfileIds);

        if (profileErr) {
            throw profileErr;
        }

        const profileMap = {};
        profiles.forEach(p => { profileMap[p.id] = p; });

        // Build list of candidates
        let candidates = adminData.map(record => {
            const profile = profileMap[record.chef_profile_id] || {};
            return {
                recordId: record.id,
                chefName: profile.chef_name || '',
                rawPhone: profile.contact_phone || '',
                updatedAt: record.updated_at
            };
        });

        // Sort by updatedAt descending (newest first)
        candidates.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        if (limit) {
            candidates = candidates.slice(0, limit);
            console.log(`🔍 Limited processing to the top ${limit} most recent candidates.`);
        }

        let processedCount = 0;
        let skippedCount = 0;
        let successCount = 0;
        let failedCount = 0;

        for (const candidate of candidates) {
            const cleanedPhone = sanitizePhone(candidate.rawPhone);

            if (!cleanedPhone) {
                console.log(`⚠️ Skip [${candidate.recordId}] - No valid phone number. Name: "${candidate.chefName}", Phone: "${candidate.rawPhone}"`);
                skippedCount++;
                continue;
            }

            // Check if they already received the followup message by fetching chat history
            let hasAlreadySent = false;
            const historyUrl = `http://${host}:${port}/api/${tenantId}/history/jid/${cleanedPhone}@c.us`;
            try {
                const historyResponse = await fetch(historyUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${webhookApiKey}`
                    }
                });

                if (historyResponse.ok) {
                    const historyResult = await historyResponse.json();
                    if (historyResult.success && Array.isArray(historyResult.messages)) {
                        hasAlreadySent = historyResult.messages.some(m => 
                            m.fromMe && m.body && (
                                m.body.includes('Homemade application but it looks like you were not available') ||
                                m.body.includes('tried calling you regarding your Homemade application')
                            )
                        );
                    }
                }
            } catch (historyErr) {
                // Connection error (e.g. server offline or tunnel down)
            }

            if (hasAlreadySent) {
                console.log(`⚠️ Skip [${candidate.recordId}] - Already messaged. Name: "${candidate.chefName}", Phone: "${cleanedPhone}"`);
                skippedCount++;
                continue;
            }

            const firstName = candidate.chefName.trim().split(' ')[0];
            const nameReplacement = firstName ? ', ' + firstName : '';
            const messageText = template.replace('{Name}', nameReplacement);

            console.log(`👉 Processing [${candidate.recordId}]: "${candidate.chefName}" (${cleanedPhone})`);

            if (isDryRun) {
                console.log(`   [DRY RUN] Would send via tenant '${tenantId}': "${messageText}"`);
                successCount++;
                processedCount++;
                continue;
            }

            // Dispatch message via Server API
            const sendUrl = `http://${host}:${port}/api/${tenantId}/send`;
            try {
                const response = await fetch(sendUrl, {
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
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        console.log('------------------------------------------');
        console.log('Chef Backfill Execution Summary:');
        console.log(`- Total candidates evaluated: ${candidates.length}`);
        console.log(`- Processed:                  ${processedCount}`);
        console.log(`- Skipped:                    ${skippedCount}`);
        console.log(`- Successfully queued/sent:   ${successCount}`);
        console.log(`- Failed:                     ${failedCount}`);
        console.log('------------------------------------------');

    } catch (e) {
        console.error('❌ Backfill failed with an error:', e.message);
    }
}

runBackfill();
