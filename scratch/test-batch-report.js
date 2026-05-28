require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const supabaseUrl = process.env.SUPABASE_URL.replace('/rest/v1/', '').replace('/rest/v1', '');
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendSendGridEmail({ to, from, subject, text, apiKey }) {
    if (!apiKey || !to || !from) {
        console.warn('[Email] SendGrid parameters are incomplete.');
        return;
    }
    const url = 'https://api.sendgrid.com/v3/mail/send';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from },
            subject: subject,
            content: [{ type: 'text/plain', value: text }]
        })
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`SendGrid API error: ${response.status} - ${err}`);
    }
    console.log(`[Email] SendGrid notification sent successfully to ${to}`);
}

async function testBatchReport() {
    console.log('⚡ [Test] Starting 3-day batch refund report test...');
    
    // Fetch all canceled orders that are marked as NOT refunded
    const { data: unrefundedOrders, error: fetchErr } = await supabase
        .from('processed_canceled_orders')
        .select('*')
        .eq('stripe_refunded', false);

    if (fetchErr) {
        console.error('❌ Error fetching from DB:', fetchErr.message);
        process.exit(1);
    }

    if (!unrefundedOrders || unrefundedOrders.length === 0) {
        console.log('ℹ️ No unrefunded orders found in DB. Test completed (nothing to report).');
        process.exit(0);
    }

    console.log(`[Test] Found ${unrefundedOrders.length} unrefunded orders in DB. Double-checking Stripe...`);

    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@homemademeals.net';
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    const verifiedUnrefunded = [];

    for (const order of unrefundedOrders) {
        let stripeRefunded = false;
        let stripePaymentIntentId = order.stripe_payment_intent_id;

        if (stripeKey) {
            try {
                const stripe = Stripe(stripeKey);
                const searchQuery = `metadata['payment_ref_id']:'${order.order_id}' OR metadata['order_id']:'${order.order_id}' OR metadata['order_uuid']:'${order.order_uuid}'`;
                const stripeSearchResult = await stripe.paymentIntents.search({ query: searchQuery });
                
                if (stripeSearchResult.data && stripeSearchResult.data.length > 0) {
                    const pi = stripeSearchResult.data[0];
                    stripePaymentIntentId = pi.id;
                    
                    let charges = [];
                    if (pi.charges && pi.charges.data) {
                        charges = pi.charges.data;
                    } else if (pi.latest_charge) {
                        const ch = await stripe.charges.retrieve(pi.latest_charge);
                        charges = [ch];
                    }
                    stripeRefunded = charges.some(c => c.refunded || c.amount_refunded > 0);
                }
            } catch (stripeErr) {
                console.error(`   ❌ Stripe double-check error for order #${order.order_id}:`, stripeErr.message);
            }
        }

        if (stripeRefunded) {
            console.log(`   Order #${order.order_id} was actually refunded on Stripe! Updating DB.`);
            await supabase
                .from('processed_canceled_orders')
                .update({ stripe_refunded: true, stripe_payment_intent_id: stripePaymentIntentId, updated_at: new Date().toISOString() })
                .eq('order_id', order.order_id);
        } else {
            console.log(`   Order #${order.order_id} confirmed UNREFUNDED. Adding to report.`);
            verifiedUnrefunded.push({
                ...order,
                stripe_payment_intent_id: stripePaymentIntentId
            });
        }
    }

    if (verifiedUnrefunded.length === 0) {
        console.log('ℹ️ All orders were refunded upon Stripe double-check. Skipping report.');
        process.exit(0);
    }

    // Send the batch report email
    if (sendgridApiKey) {
        console.log(`[Test] Sending batch report with ${verifiedUnrefunded.length} unrefunded orders...`);
        
        let emailText = `Hello,\n\nThis is the 3-day batch report of canceled orders that have NOT been refunded on Stripe.\n\n`;
        emailText += `Total Unrefunded Orders: ${verifiedUnrefunded.length}\n\n`;
        emailText += `--------------------------------------------------\n`;

        for (const order of verifiedUnrefunded) {
            emailText += `Order #${order.order_id}\n` +
                         `UUID: ${order.order_uuid || 'N/A'}\n` +
                         `Amount: €${order.order_amount}\n` +
                         `Payment Method: ${order.payment_mode_name || 'N/A'}\n` +
                         `Stripe Payment Intent ID: ${order.stripe_payment_intent_id || 'Not Found'}\n` +
                         `Customer Email: ${order.customer_email || 'N/A'}\n` +
                         `Detected Canceled At: ${order.created_at}\n` +
                         `--------------------------------------------------\n`;
        }

        emailText += `\nPlease process these refunds manually on your Stripe Dashboard.\n\nHomemade Meals Team`;

        const recipients = ['info@homemademeals.net', 'bangalexf@gmail.com'];
        for (const recipient of recipients) {
            try {
                await sendSendGridEmail({
                    to: recipient,
                    from: sendgridFromEmail,
                    subject: `🚨 [Action Required] 3-Day Batch Refund Report: ${verifiedUnrefunded.length} Unrefunded Orders`,
                    text: emailText,
                    apiKey: sendgridApiKey
                });
            } catch (emailErr) {
                console.error(`   ❌ Failed to send report to ${recipient}:`, emailErr.message);
            }
        }
    } else {
        console.log('⚠️ SENDGRID_API_KEY missing, skipping email dispatch.');
    }

    console.log('✅ [Test] Finished batch report test.');
    process.exit(0);
}

testBatchReport().catch(console.error);
