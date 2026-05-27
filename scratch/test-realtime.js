require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey);

console.log("Subscribing to chef_admin_data channel...");
const channel = crmSupabase
    .channel('public:chef_admin_data')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chef_admin_data' }, (payload) => {
        console.log("Received UPDATE payload:", payload);
    })
    .subscribe((status, err) => {
        console.log("Subscription status:", status);
        if (err) {
            console.error("Subscription error:", err);
        }
        // Exit after 10 seconds
        setTimeout(() => {
            console.log("Exiting test...");
            process.exit(0);
        }, 10000);
    });
