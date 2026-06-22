require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

// E.164 phone normalization function cloned from index.js
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

const DEFAULT_TEMPLATE = "Hey{Name}, thanks for signing up to become a chef on Homemade! 🧑‍🍳 We are super excited to have you.\n\nOur team is reviewing your details and we will reach out shortly to help you complete your onboarding. In the meantime, let us know if you have any questions!";

async function runTest() {
    console.log("⚡ Starting Chef Welcome Onboarding tests...");

    // 1. Fetch a single chef profile to use as a candidate
    console.log("🔌 Querying chef profiles...");
    const { data: profiles, error } = await crmSupabase
        .from('chef_profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error("❌ Failed to query chef_profiles:", error.message);
        process.exit(1);
    }

    if (!profiles || profiles.length === 0) {
        console.log("⚠️ No profiles found in CRM database. Using mock profile details.");
        profiles.push({
            id: "mock-chef-id-1234",
            chef_name: "Gordon Ramsay",
            contact_phone: "+31 6 12 34 56 78",
            created_at: new Date().toISOString()
        });
    }

    const testChef = profiles[0];
    console.log(`📌 Target profile name: "${testChef.chef_name}"`);
    console.log(`📌 Raw phone number: "${testChef.contact_phone}"`);

    // 2. Test Phone Sanitization
    const sanitized = sanitizePhone(testChef.contact_phone);
    console.log(`🧼 Sanitized phone: "${sanitized}"`);
    if (!sanitized) {
        console.warn("⚠️ Phone could not be sanitized! Ensure it is not null or invalid.");
    }

    // 3. Test Welcome Message formatting
    const firstName = testChef.chef_name ? testChef.chef_name.trim().split(' ')[0] : '';
    const nameReplacement = firstName ? ', ' + firstName : '';
    const messageText = DEFAULT_TEMPLATE.replace('{Name}', nameReplacement);
    
    console.log(`💬 Interpolated Welcome Message:\n------------------------\n${messageText}\n------------------------`);

    // 4. Test Polling Fallback Query execution
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    console.log(`⏳ Testing polling query fallback with created_at >= ${fiveMinutesAgo}`);
    const { data: pollResults, error: pollErr } = await crmSupabase
        .from('chef_profiles')
        .select('id, chef_name, created_at')
        .gte('created_at', fiveMinutesAgo);

    if (pollErr) {
        console.error("❌ Polling fallback query failed:", pollErr.message);
    } else {
        console.log(`📊 Polling query returned ${pollResults.length} records signed up in the last 5 minutes.`);
    }

    console.log("👋 Done.");
}

runTest().catch(err => {
    console.error("❌ Uncaught exception:", err.message);
});
