require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

// Mimic sanitizePhone from index.js
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

async function runTest() {
    console.log("⚡ [Test] Starting chef_admin_data Polling Fallback verification...");

    // 1. Fetch a single chef_admin_data record
    const { data: record, error: fetchErr } = await crmSupabase
        .from('chef_admin_data')
        .select('*')
        .limit(1)
        .single();

    if (fetchErr || !record) {
        console.error("❌ Failed to fetch chef_admin_data record:", fetchErr?.message);
        process.exit(1);
    }

    const testId = record.id;
    const chefId = record.chef_profile_id;
    const originalStatus = record.admin_status || 'new';

    console.log(`📌 Target record ID: ${testId} (linked to Chef ID: ${chefId})`);
    console.log(`📌 Original status: '${originalStatus}'`);

    // 2. Fetch linked chef profile
    const { data: chef, error: chefErr } = await crmSupabase
        .from('chef_profiles')
        .select('contact_phone, chef_name')
        .eq('id', chefId)
        .single();

    if (chefErr || !chef) {
        console.error("❌ Failed to fetch linked chef profile:", chefErr?.message);
        process.exit(1);
    }

    console.log(`📌 Linked Chef: ${chef.chef_name} (Phone: ${chef.contact_phone})`);

    // Override the phone number with a mock/test one if it's null, so the check passes
    const contactPhone = chef.contact_phone || '31612345678';
    if (!chef.contact_phone) {
        console.log(`⚠️ Contact phone was null. Mocking phone to: ${contactPhone}`);
    }

    // 3. Update status to 'called_no_answer' to simulate an admin updating it
    console.log(`✏️ Updating admin_status of ${testId} to 'called_no_answer'...`);
    const { error: updateErr } = await crmSupabase
        .from('chef_admin_data')
        .update({ admin_status: 'called_no_answer' })
        .eq('id', testId);

    if (updateErr) {
        console.error("❌ Failed to update status:", updateErr.message);
        process.exit(1);
    }

    console.log("⏳ Simulating Polling Check...");

    // 4. Run polling query (similar to index.js check)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: results, error: pollErr } = await crmSupabase
        .from('chef_admin_data')
        .select('*')
        .eq('admin_status', 'called_no_answer')
        .gte('updated_at', fiveMinutesAgo);

    if (pollErr) {
        console.error("❌ Polling query failed:", pollErr.message);
    } else {
        console.log(`📊 Polling query found ${results.length} records updated to 'called_no_answer' in the last 5 minutes.`);
        const matched = results.find(r => r.id === testId);
        
        if (matched) {
            console.log("✅ Success! Polling query correctly identified our test record.");
            
            // Format mock message
            const firstName = chef.chef_name ? chef.chef_name.trim().split(' ')[0] : '';
            const nameReplacement = firstName ? ', ' + firstName : '';
            const messageText = DEFAULT_TEMPLATE.replace('{Name}', nameReplacement);
            
            console.log(`💬 Simulated message body to send:
               Phone: ${sanitizePhone(contactPhone)}
               Text: "${messageText}"`);
        } else {
            console.error("❌ Error: Our updated test record was not returned in the polling query.");
        }
    }

    // 5. Restore original status
    console.log(`✏️ Restoring status of ${testId} back to '${originalStatus}'...`);
    const { error: restoreErr } = await crmSupabase
        .from('chef_admin_data')
        .update({ admin_status: originalStatus })
        .eq('id', testId);

    if (restoreErr) {
        console.error("❌ Failed to restore status:", restoreErr.message);
    } else {
        console.log("✅ Record restored successfully.");
    }

    console.log("👋 Done.");
    process.exit(0);
}

runTest().catch(err => {
    console.error("❌ Exception:", err.message);
    process.exit(1);
});
