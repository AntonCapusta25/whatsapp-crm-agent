require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// 1. Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL.replace('/rest/v1/', '').replace('/rest/v1', '');
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing or invalid SUPABASE credentials in env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Define SendGrid utility
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

async function testCanceledOrders() {
    console.log("⚡ [Test] Starting canceled orders checker test...");
    
    const hzApiKey = process.env.HYPERZOD_API_KEY;
    const hzTenant = process.env.HYPERZOD_TENANT_ID;

    if (!hzApiKey || !hzTenant) {
        console.error('❌ Hyperzod credentials missing in env (HYPERZOD_API_KEY / HYPERZOD_TENANT_ID).');
        process.exit(1);
    }

    try {
        console.log('[Test] Fetching last 10 canceled orders from Hyperzod...');
        const response = await fetch('https://api.hyperzod.app/admin/v1/order/list?page=1&per_page=10', {
            method: 'POST',
            headers: {
                'x-api-key': hzApiKey,
                'x-tenant': hzTenant,
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                per_page: 10,
                order_status: 6,
                updated_after: new Date(Date.now() - 30 * 60 * 1000).toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`Hyperzod response status ${response.status}: ${await response.text()}`);
        }

        const resJson = await response.json();
        const allOrders = resJson?.data?.data ?? [];
        
        // Filter in memory for canceled orders (status 6)
        const orders = allOrders.filter(o => o.order_status === 6);
        console.log(`[Test] Fetched ${allOrders.length} orders; found ${orders.length} canceled in memory.`);

        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@homemademeals.net';
        const sendgridToEmail = process.env.SENDGRID_TO_EMAIL || 'bangalexf@gmail.com';

        for (const order of orders) {
            const orderId = order.order_id;
            if (!orderId) continue;

            const orderUuid = order.order_uuid || '';
            const orderAmount = order.order_amount || 0;
            const paymentModeName = order.payment_mode_name || order.payment_mode?.name || '';

            // Extract customer details
            const customerName = order.delivery_address?.contact_name || order.user?.name || 'N/A';
            const customerPhone = order.delivery_address?.contact_phone_number || order.user?.phone || 'N/A';
            const customerEmail = order.meta?.email || order.meta?.customer_email || order.user?.email || 'N/A';

            // Extract chef details
            const chefName = order.pickup_address?.contact_name || 'N/A';
            const chefPhone = order.pickup_address?.contact_phone_number || 'N/A';

            // Determine who canceled the order
            const cancelHistory = order.order_status_history?.find(h => h.order_status === 6);
            let canceledBy = 'Customer / System';
            if (cancelHistory?.user) {
                if (cancelHistory.user.roles?.includes('T1003')) {
                    canceledBy = `Chef (${chefName})`;
                } else if (cancelHistory.user.roles?.includes('T1002')) {
                    canceledBy = `Admin (${cancelHistory.user.email || 'Staff'})`;
                }
            }

            console.log(`\n👉 Processing Order #${orderId} (Amount: €${orderAmount}, Mode: ${paymentModeName})...`);

            // Query if we already processed this order
            const { data: existing, error: fetchErr } = await supabase
                .from('processed_canceled_orders')
                .select('*')
                .eq('order_id', orderId)
                .maybeSingle();

            if (fetchErr) {
                console.error(`[Test] Error fetching from database:`, fetchErr.message);
                continue;
            }

            let initialEmailSent = existing ? existing.initial_email_sent : false;
            let refundReminderSent = existing ? existing.refund_reminder_sent : false;
            let stripeRefunded = existing ? existing.stripe_refunded : false;
            let stripePaymentIntentId = existing ? existing.stripe_payment_intent_id : null;

            console.log(`   DB Record Status:`, existing ? `Exists (initial_sent=${initialEmailSent}, stripe_refunded=${stripeRefunded})` : `Not tracked yet`);

            // If new order, verify Stripe first, then send initial email and insert record
            if (!existing) {
                const stripeKey = process.env.STRIPE_SECRET_KEY;
                if (stripeKey) {
                    console.log(`   [Action] Checking Stripe on first run...`);
                    try {
                        const stripe = Stripe(stripeKey);
                        const searchQuery = `metadata['payment_ref_id']:'${orderId}' OR metadata['order_id']:'${orderId}' OR metadata['order_uuid']:'${orderUuid}'`;
                        const stripeSearchResult = await stripe.paymentIntents.search({ query: searchQuery });
                        
                        if (stripeSearchResult.data && stripeSearchResult.data.length > 0) {
                            const pi = stripeSearchResult.data[0];
                            stripePaymentIntentId = pi.id;
                            console.log(`   Stripe PaymentIntent found: ${stripePaymentIntentId}`);
                            
                            let charges = [];
                            if (pi.charges && pi.charges.data) {
                                charges = pi.charges.data;
                            } else if (pi.latest_charge) {
                                const ch = await stripe.charges.retrieve(pi.latest_charge);
                                charges = [ch];
                            }
                            stripeRefunded = charges.some(c => c.refunded || c.amount_refunded > 0);
                            console.log(`   Refund Status on Stripe:`, stripeRefunded ? `REFUNDED` : `NOT REFUNDED`);
                        } else {
                            console.log(`   Stripe PaymentIntent not found.`);
                        }
                    } catch (stripeErr) {
                        console.error(`   ❌ Stripe check error:`, stripeErr.message);
                    }
                }

                console.log(`   [Action] Attempting to send initial alert to ${sendgridToEmail}...`);
                if (sendgridApiKey) {
                    try {
                        const subject = `⚠️ Cancelled Order Alert: Order #${orderId}`;
                        const text = `Order #${orderId} (UUID: ${orderUuid}) has been CANCELLED.\n` +
                                     `Canceled By: ${canceledBy}\n` +
                                     `Amount: €${orderAmount}\n` +
                                     `Payment Mode: ${paymentModeName}\n` +
                                     `Date: ${new Date().toISOString()}\n\n` +
                                     `--- CUSTOMER DETAILS ---\n` +
                                     `Name: ${customerName}\n` +
                                     `Phone: ${customerPhone}\n` +
                                     `Email: ${customerEmail}\n\n` +
                                     `--- CHEF DETAILS ---\n` +
                                     `Name: ${chefName}\n` +
                                     `Phone: ${chefPhone}\n\n` +
                                     `--- STRIPE STATUS ---\n` +
                                     `Stripe Refunded: ${stripeRefunded ? 'YES' : 'NO'}\n` +
                                     `Payment Intent ID: ${stripePaymentIntentId || 'Not Found'}\n\n` +
                                     (stripeRefunded 
                                         ? 'No manual action is required as the refund has already been processed on Stripe.' 
                                         : 'Action Required: This payment is not yet refunded. A reminder email has been sent to info@homemademeals.net.');

                        await sendSendGridEmail({
                            to: sendgridToEmail,
                            from: sendgridFromEmail,
                            subject: subject,
                            text: text,
                            apiKey: sendgridApiKey
                        });
                        initialEmailSent = true;
                    } catch (emailErr) {
                        console.error(`   ❌ Failed to send initial email:`, emailErr.message);
                    }
                } else {
                    console.log(`   ⚠️ SENDGRID_API_KEY missing, skipping email dispatch.`);
                }

                console.log(`   [Action] Inserting tracking record to DB...`);
                const { error: insertErr } = await supabase
                    .from('processed_canceled_orders')
                    .insert({
                        order_id: orderId,
                        order_uuid: orderUuid,
                        customer_email: customerEmail,
                        order_amount: orderAmount,
                        payment_mode_name: paymentModeName,
                        initial_email_sent: initialEmailSent,
                        refund_reminder_sent: false,
                        stripe_refunded: stripeRefunded,
                        stripe_payment_intent_id: stripePaymentIntentId
                    });

                if (insertErr) {
                    console.error(`   ❌ Failed to insert DB record:`, insertErr.message);
                    continue;
                }
            }

            // Only check/update Stripe if it hasn't been verified as refunded yet
            if (!stripeRefunded) {
                const stripeKey = process.env.STRIPE_SECRET_KEY;
                if (!stripeKey) {
                    console.warn(`   ⚠️ STRIPE_SECRET_KEY missing. Skipping Stripe validation.`);
                    continue;
                }

                console.log(`   [Action] Checking Stripe for PaymentIntent...`);
                try {
                    const stripe = Stripe(stripeKey);
                    const searchQuery = `metadata['payment_ref_id']:'${orderId}' OR metadata['order_id']:'${orderId}' OR metadata['order_uuid']:'${orderUuid}'`;
                    const stripeSearchResult = await stripe.paymentIntents.search({ query: searchQuery });
                    
                    if (stripeSearchResult.data && stripeSearchResult.data.length > 0) {
                        const pi = stripeSearchResult.data[0];
                        stripePaymentIntentId = pi.id;
                        console.log(`   Stripe PaymentIntent found: ${stripePaymentIntentId}`);
                        
                        let charges = [];
                        if (pi.charges && pi.charges.data) {
                            charges = pi.charges.data;
                        } else if (pi.latest_charge) {
                            const ch = await stripe.charges.retrieve(pi.latest_charge);
                            charges = [ch];
                        }
                        
                        stripeRefunded = charges.some(c => c.refunded || c.amount_refunded > 0);
                        console.log(`   Refund Status on Stripe:`, stripeRefunded ? `REFUNDED` : `NOT REFUNDED`);
                    } else {
                        console.log(`   Stripe PaymentIntent not found.`);
                    }
                } catch (stripeErr) {
                    console.error(`   ❌ Stripe search error:`, stripeErr.message);
                }

                // If Stripe check confirms it's not refunded and we haven't sent the reminder email yet, send it
                if (!stripeRefunded && !refundReminderSent) {
                    console.log(`   [Action] Attempting to send refund reminder to info@homemademeals.net...`);
                    if (sendgridApiKey) {
                        try {
                            const subject = `🚨 Action Required: Refund Reminder for Order #${orderId}`;
                            const text = `Order #${orderId} (UUID: ${orderUuid}) was CANCELLED but the payment has NOT been refunded on Stripe.\n` +
                                         `Canceled By: ${canceledBy}\n` +
                                         `Amount: €${orderAmount}\n` +
                                         `Stripe Payment Intent ID: ${stripePaymentIntentId || 'Not Found'}\n\n` +
                                         `--- CUSTOMER DETAILS ---\n` +
                                         `Name: ${customerName}\n` +
                                         `Phone: ${customerPhone}\n` +
                                         `Email: ${customerEmail}\n\n` +
                                         `--- CHEF DETAILS ---\n` +
                                         `Name: ${chefName}\n` +
                                         `Phone: ${chefPhone}\n\n` +
                                         `Please process this refund manually on the Stripe Dashboard.`;
                            await sendSendGridEmail({
                                to: 'info@homemademeals.net',
                                from: sendgridFromEmail,
                                subject: subject,
                                text: text,
                                apiKey: sendgridApiKey
                            });
                            refundReminderSent = true;
                        } catch (emailErr) {
                            console.error(`   ❌ Failed to send refund reminder:`, emailErr.message);
                        }
                    } else {
                        console.log(`   ⚠️ SENDGRID_API_KEY missing, skipping email dispatch.`);
                    }
                }

                console.log(`   [Action] Updating DB record with latest checks...`);
                const { error: updateErr } = await supabase
                    .from('processed_canceled_orders')
                    .update({
                        stripe_payment_intent_id: stripePaymentIntentId,
                        stripe_refunded: stripeRefunded,
                        refund_reminder_sent: refundReminderSent,
                        updated_at: new Date().toISOString()
                    })
                    .eq('order_id', orderId);

                if (updateErr) {
                    console.error(`   ❌ Failed to update DB record:`, updateErr.message);
                }
            } else {
                console.log(`   Order already refunded. No action needed.`);
            }
        }

        console.log("\n✅ [Test] Finished test run.");
        process.exit(0);
    } catch (err) {
        console.error('❌ [Test] Execution failed:', err.message);
        process.exit(1);
    }
}

testCanceledOrders();
