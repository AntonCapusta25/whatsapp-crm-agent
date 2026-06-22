require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

async function run() {
    console.log("⚡ Fetching all 'called_no_answer' chefs from chef_admin_data...");
    const { data: adminData, error: adminErr } = await crmSupabase
        .from('chef_admin_data')
        .select('chef_profile_id, updated_at, call_attempts, admin_notes')
        .eq('admin_status', 'called_no_answer');

    if (adminErr) {
        console.error("❌ Error fetching chef_admin_data:", adminErr.message);
        process.exit(1);
    }

    console.log(`📊 Found ${adminData.length} records in chef_admin_data with status 'called_no_answer'.`);

    if (adminData.length === 0) {
        console.log("No chefs found.");
        process.exit(0);
    }

    const chefProfileIds = adminData.map(r => r.chef_profile_id).filter(Boolean);
    
    console.log(`⚡ Fetching chef profiles for ${chefProfileIds.length} IDs...`);
    const { data: profiles, error: profileErr } = await crmSupabase
        .from('chef_profiles')
        .select('id, chef_name, contact_phone, created_at, city')
        .in('id', chefProfileIds);

    if (profileErr) {
        console.error("❌ Error fetching chef_profiles:", profileErr.message);
        process.exit(1);
    }

    console.log(`📊 Successfully retrieved ${profiles.length} chef profiles.`);

    // Map profiles by ID for quick lookup
    const profileMap = {};
    profiles.forEach(p => {
        profileMap[p.id] = p;
    });

    // Combine the data
    const combined = adminData.map(record => {
        const profile = profileMap[record.chef_profile_id] || {};
        return {
            chef_profile_id: record.chef_profile_id,
            chef_name: profile.chef_name || 'N/A',
            contact_phone: profile.contact_phone || 'N/A',
            city: profile.city || 'N/A',
            profile_created_at: profile.created_at,
            admin_data_updated_at: record.updated_at,
            call_attempts: record.call_attempts,
            admin_notes: record.admin_notes || ''
        };
    });

    // Sort by admin_data_updated_at descending (newest first)
    combined.sort((a, b) => new Date(b.admin_data_updated_at) - new Date(a.admin_data_updated_at));

    // Save full list to file
    const outputPath = path.join(__dirname, 'called_no_answer_chefs.json');
    fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2), 'utf-8');
    console.log(`💾 Saved full list of ${combined.length} chefs to: ${outputPath}`);

    // Output top 15
    console.log("\n📋 --- TOP 15 MOST RECENT NO ANSWER CHEFS ---");
    const top15 = combined.slice(0, 15);
    console.log(JSON.stringify(top15, null, 2));
    
    console.log(`\n✅ Finished query. Total chefs listed in file: ${combined.length}`);
}

run().catch(err => {
    console.error("❌ Uncaught exception:", err.message);
    process.exit(1);
});
