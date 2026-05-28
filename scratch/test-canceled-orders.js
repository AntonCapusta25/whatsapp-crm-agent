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

// Initialize CRM Supabase Client
const crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const crmSupabase = (crmSupabaseUrl && crmSupabaseKey) ? createClient(crmSupabaseUrl, crmSupabaseKey) : null;

const ADMIN_TO_TENANT_MAP = {
    'c50a568a-1566-4fa5-a0a2-2a0f44ffdebd': 'napoleon', // Walid Sabihi
    'd6ad7fc9-2f7b-4936-8711-79d7f683edee': 'tia',       // Tia Yahya
};

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

const DEFAULT_CONFIG = {
    orderCancellationEnabled: true,
    orderCancellationSenderTenant: "assigned",
    orderCancellationChefTemplate: "Hey! Homemade meals team here. 🧑‍🍳\n\nWe are really sorry, but the chef had to cancel your order. We know this is disappointing and apologize for the inconvenience! 🥺\n\nYour refund is on the way. 💳\n\nHere is a discount code for your next order:\n👉 *SECONDCHANCE15*\n\nWe hope to cook for you again soon! 💚",
    orderCancellationCustomerTemplate: "Hi! Homemade meals team here. 💚\n\nIt is quite sad that you canceled the order. We understand plans change, but we would love to learn how we can improve! Please let us know why the order was canceled so we can do better next time. 🙏\n\nHere is a discount code for your next order:\n👉 *SECONDCHANCE15*\n\nWe hope to see you back soon! 🧑‍🍳"
};

async function getBrainConfig(tenantId) {
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('agent_settings')
                .select('settings')
                .eq('tenant_id', tenantId)
                .single();

            if (data && data.settings) {
                const loaded = data.settings;
                return {
                    orderCancellationEnabled: loaded.orderCancellationEnabled !== undefined ? loaded.orderCancellationEnabled : DEFAULT_CONFIG.orderCancellationEnabled,
                    orderCancellationSenderTenant: loaded.orderCancellationSenderTenant || DEFAULT_CONFIG.orderCancellationSenderTenant,
                    orderCancellationChefTemplate: loaded.orderCancellationChefTemplate || DEFAULT_CONFIG.orderCancellationChefTemplate,
                    orderCancellationCustomerTemplate: loaded.orderCancellationCustomerTemplate || DEFAULT_CONFIG.orderCancellationCustomerTemplate
                };
            }
        } catch (err) {
            console.error(`[Test-Config] Error reading settings for ${tenantId}:`, err.message);
        }
    }
    return DEFAULT_CONFIG;
}

function formatTemplate(template, vars) {
    if (!template) return '';
    let text = template;
    for (const [key, val] of Object.entries(vars)) {
        text = text.replace(new RegExp(`{${key}}`, 'g'), val || '');
    }
    return text;
}

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

const BOOT_TIME = 0; // Bypasses boot-time check in testing to allow processing WhatsApp alerts

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

                // Send initial email to BOTH bangalexf@gmail.com and info@homemademeals.net
                console.log(`   [Action] Attempting to send initial alert to BOTH bangalexf@gmail.com and info@homemademeals.net...`);
                if (sendgridApiKey) {
                    const recipients = ['bangalexf@gmail.com', 'info@homemademeals.net'];
                    for (const recipient of recipients) {
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
                                             : 'This payment is not yet refunded. It will be reported in the 3-day batch refund report if it remains unpaid.');

                            await sendSendGridEmail({
                                to: recipient,
                                from: sendgridFromEmail,
                                subject: subject,
                                text: text,
                                apiKey: sendgridApiKey
                            });
                            initialEmailSent = true;
                        } catch (emailErr) {
                            console.error(`   ❌ Failed to send initial email to ${recipient}:`, emailErr.message);
                        }
                    }
                } else {
                    console.log(`   ⚠️ SENDGRID_API_KEY missing, skipping email dispatch.`);
                }

                // Send WhatsApp message to customer if canceled after BOOT_TIME
                const orderUpdatedAtMs = new Date(order.updated_at).getTime();
                if (orderUpdatedAtMs > BOOT_TIME) {
                    // Determine Chef's assigned admin tenant ID first
                    let chefTenantId = null;
                    if (crmSupabase && order.merchant_id) {
                        try {
                            const { data: profile } = await crmSupabase
                                .from('chef_profiles')
                                .select('id')
                                .eq('hyperzod_merchant_id', order.merchant_id)
                                .maybeSingle();
                                
                            if (profile?.id) {
                                const { data: adminData } = await crmSupabase
                                    .from('chef_admin_data')
                                    .select('assigned_admin_id')
                                    .eq('chef_profile_id', profile.id)
                                    .maybeSingle();
                                    
                                if (adminData?.assigned_admin_id && ADMIN_TO_TENANT_MAP[adminData.assigned_admin_id]) {
                                    chefTenantId = ADMIN_TO_TENANT_MAP[adminData.assigned_admin_id];
                                }
                            }
                        } catch (e) {
                            console.error('   ❌ Error fetching chef/admin mapping for WhatsApp config:', e.message);
                        }
                    }

                    // Fallback configuration tenant if chef has no mapping
                    const configTenantId = chefTenantId || 'tia';
                    const config = await getBrainConfig(configTenantId);

                    if (config.orderCancellationEnabled) {
                        let template = '';
                        if (canceledBy.startsWith('Chef')) {
                            template = config.orderCancellationChefTemplate || DEFAULT_CONFIG.orderCancellationChefTemplate;
                        } else if (canceledBy.startsWith('Customer')) {
                            template = config.orderCancellationCustomerTemplate || DEFAULT_CONFIG.orderCancellationCustomerTemplate;
                        }

                        if (template && customerPhone) {
                            const sanitizedCustomerPhone = sanitizePhone(customerPhone);
                            if (sanitizedCustomerPhone) {
                                const customerJid = `${sanitizedCustomerPhone}@c.us`;
                                
                                // Resolve target sender tenant
                                let targetTenantId = chefTenantId; // Start with Chef's assigned tenant
                                if (config.orderCancellationSenderTenant && config.orderCancellationSenderTenant !== 'assigned') {
                                    targetTenantId = config.orderCancellationSenderTenant;
                                }

                                const whatsappMessageText = formatTemplate(template, {
                                    CustomerName: customerName,
                                    ChefName: chefName,
                                    OrderId: orderId,
                                    OrderAmount: orderAmount
                                });

                                console.log(`   [Mock-WhatsApp] Would send cancellation msg to customer ${sanitizedCustomerPhone} using tenant ${targetTenantId || '(first available ready)'}:\n   "${whatsappMessageText}"`);
                            }
                        }
                    } else {
                        console.log(`   [Mock-WhatsApp] WhatsApp cancellation messages are disabled via settings for tenant ${configTenantId}.`);
                    }
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

                console.log(`   [Action] Updating DB record with latest Stripe status...`);
                const { error: updateErr } = await supabase
                    .from('processed_canceled_orders')
                    .update({
                        stripe_payment_intent_id: stripePaymentIntentId,
                        stripe_refunded: stripeRefunded,
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
