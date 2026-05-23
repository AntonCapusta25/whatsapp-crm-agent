require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 1. Initialize CRM Supabase Client
const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;

if (!crmSupabaseUrl || !crmSupabaseKey || !crmSupabaseUrl.startsWith('http')) {
    console.error("❌ Missing or invalid CRM_SUPABASE credentials in .env");
    process.exit(1);
}

const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

async function testQuery() {
    console.log(`🔌 Connecting to CRM Supabase: ${crmSupabaseUrl}...`);
    
    try {
        // Query just 1 chef to verify the connection and joins work
        const { data, error } = await crmSupabase
            .from('chef_profiles')
            .select(`
                id, business_name, chef_name, contact_phone, plan,
                chef_verification ( kitchen_status, food_safety_quiz_passed ),
                chef_onboarding_steps ( step_name, is_completed )
            `)
            .limit(1);

        if (error) {
            console.error("❌ Error querying CRM Supabase:", error.message);
            return;
        }

        if (data && data.length > 0) {
            console.log("✅ Successfully queried CRM Supabase! Found chef data:");
            console.log(JSON.stringify(data[0], null, 2));
        } else {
            console.log("⚠️ Query succeeded, but no chefs found in the 'chef_profiles' table.");
        }
    } catch (e) {
        console.error("❌ Unexpected Error:", e.message);
    }
}

testQuery();
