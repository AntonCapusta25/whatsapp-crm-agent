require('dotenv').config();

process.on('uncaughtException', (err) => {
    console.error('🔥 [Process] Uncaught Exception:', err.message);
    if (err.stack) console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 [Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { renderTemplate } = require('./templates');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const BOOT_TIME = Date.now();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// ------------------------------------------------------------------
// Authentication API & Middleware
// ------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    if (!supabase) {
        return res.status(500).json({ error: 'Supabase is not configured on the server' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        // Return basic session info to frontend
        res.json({ success: true, token: data.session.access_token, user: data.user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// Middleware to protect API routes
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }

    const token = authHeader.split(' ')[1];

    // Allow local scripts/crons using the WEBHOOK_API_KEY to bypass auth checks
    const webhookKey = process.env.WEBHOOK_API_KEY;
    if (webhookKey && token === webhookKey) {
        return next();
    }

    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Server error during authentication validation' });
    }
};

// Apply auth middleware to all API routes except login
app.use('/api', (req, res, next) => {
    if (req.path === '/auth/login') {
        return next();
    }
    requireAuth(req, res, next);
});

// ------------------------------------------------------------------
// Supabase Integration Setup
// ------------------------------------------------------------------
let supabaseUrl = process.env.SUPABASE_URL;
if (supabaseUrl && supabaseUrl.includes('/rest/v1')) {
    supabaseUrl = supabaseUrl.split('/rest/v1')[0];
}
const supabaseKey = process.env.SUPABASE_KEY;
console.log('🔍 [Supabase Debug] env values:', { supabaseUrl, hasKey: !!supabaseKey });
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (supabase) {
    console.log('⚡ Supabase Client initialized successfully.');
} else {
    console.log('⚠️ Supabase credentials missing in .env. Falling back to local configuration storage.');
}

// ------------------------------------------------------------------
// Secondary Supabase Integration (Homemade CRM Project)
// ------------------------------------------------------------------
let crmSupabaseUrl = process.env.CRM_SUPABASE_URL;
if (crmSupabaseUrl && crmSupabaseUrl.includes('/rest/v1')) {
    crmSupabaseUrl = crmSupabaseUrl.split('/rest/v1')[0];
}
const crmSupabaseKey = process.env.CRM_SUPABASE_KEY;
const isValidUrl = crmSupabaseUrl && crmSupabaseUrl.startsWith('http');
const crmSupabase = (isValidUrl && crmSupabaseKey) ? createClient(crmSupabaseUrl, crmSupabaseKey) : null;

if (crmSupabase) {
    console.log('⚡ CRM Supabase Client (Secondary) initialized successfully.');
} else {
    console.log('⚠️ CRM Supabase credentials missing or invalid in .env. (CRM context disabled)');
}

// Map CRM admin user IDs to WhatsApp tenants
const ADMIN_TO_TENANT_MAP = {
    'c50a568a-1566-4fa5-a0a2-2a0f44ffdebd': 'napoleon', // Walid Sabihi
    'd6ad7fc9-2f7b-4936-8711-79d7f683edee': 'tia',       // Tia Yahya
};

const AdmZip = require('adm-zip');

async function saveSessionToSupabase(tenantId) {
    if (!supabase) return;
    const sessionDir = path.join(__dirname, `.wwebjs_auth/session-tenant-${tenantId}`);
    if (!fs.existsSync(sessionDir)) {
        console.log(`[Supabase-Session] No local session folder found to save for tenant ${tenantId}.`);
        return;
    }

    try {
        console.log(`[Supabase-Session] Zipping session files for tenant ${tenantId}...`);

        const tempDir = path.join(__dirname, `temp-session-${tenantId}`);
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        const copyDirRecursiveSync = (src, dest) => {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const entries = fs.readdirSync(src, { withFileTypes: true });
            for (let entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                // Skip lock files, sockets, caches, and symlinks that cause ENOENT or bloat
                if (
                    entry.name === 'SingletonLock' ||
                    entry.name === 'SingletonSocket' ||
                    entry.name === 'SingletonCookie' ||
                    entry.name === 'RunningChromeVersion' ||
                    entry.name === 'Cache' ||
                    entry.name === 'Code Cache' ||
                    entry.name === 'Service Worker' ||
                    entry.name.startsWith('.org.chromium') ||
                    entry.isSymbolicLink()
                ) {
                    continue;
                }

                if (entry.isDirectory()) {
                    copyDirRecursiveSync(srcPath, destPath);
                } else if (entry.isFile()) {
                    try {
                        fs.copyFileSync(srcPath, destPath);
                    } catch (err) {
                        // Skip if unreadable (e.g. system locked)
                    }
                }
            }
        };

        copyDirRecursiveSync(sessionDir, tempDir);

        const zip = new AdmZip();
        zip.addLocalFolder(tempDir);
        const buffer = zip.toBuffer();
        const base64Data = buffer.toString('base64');

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

        // --- LOCAL BACKUP ADDITION ---
        const backupsDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
        const backupPath = path.join(backupsDir, `session-tenant-${tenantId}.zip`);
        fs.writeFileSync(backupPath, buffer);
        console.log(`[Supabase-Session] Session ZIP successfully saved locally at ${backupPath}`);
        // -----------------------------

        console.log(`[Supabase-Session] Uploading session zip (${(buffer.length / 1024 / 1024).toFixed(2)} MB) to database...`);
        const { error } = await supabase
            .from('whatsapp_sessions')
            .upsert({
                tenant_id: tenantId,
                session_zip: base64Data,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id' });

        if (error) {
            if (error.message && error.message.includes('does not exist')) {
                console.warn(`[Supabase-Session] ⚠️ Table 'whatsapp_sessions' does not exist in Supabase yet. Please run the SQL migration script to enable cloud session backup.`);
            } else {
                console.error(`[Supabase-Session] Failed to save session to Supabase:`, error);
            }
        } else {
            console.log(`[Supabase-Session] Session successfully saved to Supabase for tenant: ${tenantId}`);
        }
    } catch (err) {
        console.error(`[Supabase-Session] Exception saving session for tenant ${tenantId}:`, err.message);
    }
}

async function restoreSessionFromSupabase(tenantId) {
    if (!supabase) return false;
    const sessionDir = path.join(__dirname, `.wwebjs_auth/session-tenant-${tenantId}`);

    // Only skip restore if the folder has actual WhatsApp auth data inside
    // We check for critical files that WhatsApp Web.js actually needs: Cookies and Local Storage
    if (fs.existsSync(sessionDir)) {
        const defaultDir = path.join(sessionDir, 'Default');
        const hasCookies = fs.existsSync(path.join(defaultDir, 'Cookies'));
        const hasLocalStorage = fs.existsSync(path.join(defaultDir, 'Local Storage'));
        const hasAuthData = hasCookies && hasLocalStorage;
        if (hasAuthData) {
            console.log(`[Supabase-Session] Local session folder already exists for tenant ${tenantId} with valid auth data. Skipping restore.`);
            return true;
        } else {
            console.log(`[Supabase-Session] Local folder for tenant ${tenantId} exists but is missing critical auth files (Cookies=${hasCookies}, LocalStorage=${hasLocalStorage}). Attempting Supabase restore...`);
            // Remove the stale folder so we can extract properly
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
    }

    try {
        console.log(`[Supabase-Session] Checking Supabase for saved session for tenant ${tenantId}...`);
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('session_zip')
            .eq('tenant_id', tenantId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log(`[Supabase-Session] No saved session found in Supabase for tenant ${tenantId}.`);
            } else if (error.message && error.message.includes('does not exist')) {
                console.warn(`[Supabase-Session] ⚠️ Table 'whatsapp_sessions' does not exist in Supabase yet. Please run the SQL migration script to enable cloud session backup.`);
            } else {
                console.error(`[Supabase-Session] Error fetching session for tenant ${tenantId}:`, error);
            }
            return false;
        }

        if (data && data.session_zip) {
            console.log(`[Supabase-Session] Restoring session files from database zip...`);
            const buffer = Buffer.from(data.session_zip, 'base64');
            const zip = new AdmZip(buffer);

            fs.mkdirSync(sessionDir, { recursive: true });
            zip.extractAllTo(sessionDir, true);
            console.log(`[Supabase-Session] Session successfully restored locally for tenant: ${tenantId}`);
            return true;
        }
    } catch (err) {
        console.error(`[Supabase-Session] Exception restoring session for tenant ${tenantId}:`, err.message);
    }
    return false;
}

// Default Configuration Template
const DEFAULT_CONFIG = {
    profileName: "",
    cateringWelcomeEnabled: false,
    cateringWelcomeMessage: "Hey! This is Tia from Homemade.\n\nThank you so much for signing up for a private chef{Name}! Can you provide your city so we're able to match you up with a Chef in your area?",
    chefWelcomeEnabled: false,
    chefWelcomeMessage: "Hey{Name}, thanks for signing up to become a chef on Homemade! 🧑‍🍳 We are super excited to have you.\n\nOur team is reviewing your details and we will reach out shortly to help you complete your onboarding. In the meantime, let us know if you have any questions!",
    noAnswerFollowupEnabled: false,
    noAnswerFollowupMessage: "Hey{Name}, we tried calling you regarding your Homemade application but it looks like you were not available. Let us know when is a good time to reach you, or if you prefer, we can just chat right here!",
    cateringNoAnswerFollowupEnabled: false,
    cateringNoAnswerFollowupMessage: "Hey{Name}, we tried calling you regarding your catering request but it looks like you were not available. Let us know when is a good time to reach you, or if you prefer, we can just chat right here!",
    orderCancellationEnabled: true,
    orderCancellationSenderTenant: "assigned",
    orderCancellationChefTemplate: "Hey! Homemade meals team here. 🧑‍🍳\n\nWe are really sorry, but the chef had to cancel your order. We know this is disappointing and apologize for the inconvenience! 🥺\n\nYour refund is on the way. 💳\n\nHere is a discount code for your next order:\n👉 *SECONDCHANCE15*\n\nWe hope to cook for you again soon! 💚",
    orderCancellationCustomerTemplate: "Hi! Homemade meals team here. 💚\n\nIt is quite sad that you canceled the order. We understand plans change, but we would love to learn how we can improve! Please let us know why the order was canceled so we can do better next time. 🙏\n\nHere is a discount code for your next order:\n👉 *SECONDCHANCE15*\n\nWe hope to see you back soon! 🧑‍🍳",
    welcomeMessage: {
        enabled: false,
        template: "Hello! Thank you for reaching out. How can I help you today? 🤖"
    },
    autoReply: {
        enabled: false,
        rules: [
            { trigger: "price, cost, plan, plans", response: "You can choose a yearly commission-only plan (10%, 12%, or 14%) or a monthly plan that combines a small base fee (€25/€35/€45) with a lower commission (5%/6%/7%). Yearly is the default." },
            { trigger: "commission, fee", response: "Commission is taken from the gross order value, which includes delivery fees and VAT." },
            { trigger: "cancel, refund", response: "Within the first 10 minutes — no fee, but contact the customer. After 10 minutes — a €15 handling fee, and we ask you to make it right. 3+ cancellations in 3 months triggers a support call and may pause orders." },
            { trigger: "kvk, nvwa, haccp", response: "Yes — KVK + NVWA registration and HACCP compliance are mandatory. We also recommend at least €1,000,000 liability insurance." },
            { trigger: "contract, term", response: "Yearly plans run for 12 months from signing. Monthly plans renew each month with 30 days' notice." },
            { trigger: "switch, upgrade, downgrade", response: "Yes — you can upgrade any time. Pro and Pro Plus can also downgrade." },
            { trigger: "help, call, tia, onboarding specialist", response: "Yes — book a call with Tia, our onboarding specialist: https://calendly.com/homemademeals-info/launch-assistance" },
            { trigger: "kitchen, check", response: "Upload 2 kitchen photos + 1 fridge photo. Our AI scores Hygiene, Fridge Safety, and Storage. 70+ passes; 55–69 conditional; <55 fail. Re-check monthly." },
            { trigger: "quiz, safety", response: "80% or higher. You'll watch 5 short training videos first." },
            { trigger: "online, offline, status", response: "You're Online (green) only when you're accepting orders AND within your opening hours. Otherwise you're Offline (gray)." }
        ]
    },
    aiAgent: {
        enabled: false,
        provider: "gemini",
        apiKey: "",
        systemPrompt: "You are Tia, the expert onboarding specialist for Homemade Chefs. Your goal is to help hobby chefs launch their home-based culinary business seamlessly. You have access to their live CRM data, so use it to provide personalized, hyper-relevant answers. If they are missing steps (like verification, menu creation, or kitchen check), gently guide them on what to do next. Be exceptionally friendly, encouraging, and clear. Keep your responses concise (like a WhatsApp message), use emojis where appropriate, and do NOT hallucinate policies outside of the official Homemade knowledge base."
    },
    webhook: {
        enabled: false,
        url: ""
    },
    emailNotification: {
        enabled: false,
        apiKey: "",
        fromEmail: "",
        toEmail: "",
        subject: "⚠️ Urgent: WhatsApp Message Needs Human Attention"
    }
};

// Fetch Config (with Supabase fetch or local JSON file fallback)
async function getBrainConfig(tenantId) {
    // 1. Check Supabase first if available
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('agent_settings')
                .select('settings')
                .eq('tenant_id', tenantId)
                .single();

            if (error) {
                // PGRST116 indicates row does not exist
                if (error.code === 'PGRST116') {
                    console.log(`[Supabase] No settings found for tenant ${tenantId}. Creating defaults...`);
                    await supabase
                        .from('agent_settings')
                        .insert({ tenant_id: tenantId, settings: DEFAULT_CONFIG });
                    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                }
                console.error(`[Supabase] Error reading settings for ${tenantId}:`, error);
            } else if (data && data.settings) {
                const loaded = data.settings;
                return {
                    profileName: loaded.profileName || "",
                    cateringWelcomeEnabled: loaded.cateringWelcomeEnabled || false,
                    cateringWelcomeMessage: loaded.cateringWelcomeMessage || DEFAULT_CONFIG.cateringWelcomeMessage,
                    chefWelcomeEnabled: loaded.chefWelcomeEnabled || false,
                    chefWelcomeMessage: loaded.chefWelcomeMessage || DEFAULT_CONFIG.chefWelcomeMessage,
                    noAnswerFollowupEnabled: loaded.noAnswerFollowupEnabled || false,
                    noAnswerFollowupMessage: loaded.noAnswerFollowupMessage || DEFAULT_CONFIG.noAnswerFollowupMessage,
                    cateringNoAnswerFollowupEnabled: loaded.cateringNoAnswerFollowupEnabled || false,
                    cateringNoAnswerFollowupMessage: loaded.cateringNoAnswerFollowupMessage || DEFAULT_CONFIG.cateringNoAnswerFollowupMessage,
                    orderCancellationEnabled: loaded.orderCancellationEnabled !== undefined ? loaded.orderCancellationEnabled : DEFAULT_CONFIG.orderCancellationEnabled,
                    orderCancellationSenderTenant: loaded.orderCancellationSenderTenant || DEFAULT_CONFIG.orderCancellationSenderTenant,
                    orderCancellationChefTemplate: loaded.orderCancellationChefTemplate || DEFAULT_CONFIG.orderCancellationChefTemplate,
                    orderCancellationCustomerTemplate: loaded.orderCancellationCustomerTemplate || DEFAULT_CONFIG.orderCancellationCustomerTemplate,
                    welcomeMessage: { ...DEFAULT_CONFIG.welcomeMessage, ...loaded.welcomeMessage },
                    autoReply: { ...DEFAULT_CONFIG.autoReply, ...loaded.autoReply },
                    aiAgent: { ...DEFAULT_CONFIG.aiAgent, ...loaded.aiAgent },
                    webhook: { ...DEFAULT_CONFIG.webhook, ...loaded.webhook },
                    emailNotification: { ...DEFAULT_CONFIG.emailNotification, ...loaded.emailNotification }
                };
            }
        } catch (err) {
            console.error(`[Supabase] Exception checking config for ${tenantId}:`, err);
        }
    }

    // Fallback to Local config storage
    const configDir = path.join(__dirname, 'configs');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    const tenantFile = path.join(configDir, `brain-config-${tenantId}.json`);
    if (fs.existsSync(tenantFile)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(tenantFile, 'utf8'));
            return {
                profileName: loaded.profileName || "",
                cateringWelcomeEnabled: loaded.cateringWelcomeEnabled || false,
                cateringWelcomeMessage: loaded.cateringWelcomeMessage || DEFAULT_CONFIG.cateringWelcomeMessage,
                chefWelcomeEnabled: loaded.chefWelcomeEnabled || false,
                chefWelcomeMessage: loaded.chefWelcomeMessage || DEFAULT_CONFIG.chefWelcomeMessage,
                noAnswerFollowupEnabled: loaded.noAnswerFollowupEnabled || false,
                noAnswerFollowupMessage: loaded.noAnswerFollowupMessage || DEFAULT_CONFIG.noAnswerFollowupMessage,
                cateringNoAnswerFollowupEnabled: loaded.cateringNoAnswerFollowupEnabled || false,
                cateringNoAnswerFollowupMessage: loaded.cateringNoAnswerFollowupMessage || DEFAULT_CONFIG.cateringNoAnswerFollowupMessage,
                orderCancellationEnabled: loaded.orderCancellationEnabled !== undefined ? loaded.orderCancellationEnabled : DEFAULT_CONFIG.orderCancellationEnabled,
                orderCancellationSenderTenant: loaded.orderCancellationSenderTenant || DEFAULT_CONFIG.orderCancellationSenderTenant,
                orderCancellationChefTemplate: loaded.orderCancellationChefTemplate || DEFAULT_CONFIG.orderCancellationChefTemplate,
                orderCancellationCustomerTemplate: loaded.orderCancellationCustomerTemplate || DEFAULT_CONFIG.orderCancellationCustomerTemplate,
                welcomeMessage: { ...DEFAULT_CONFIG.welcomeMessage, ...loaded.welcomeMessage },
                autoReply: { ...DEFAULT_CONFIG.autoReply, ...loaded.autoReply },
                aiAgent: { ...DEFAULT_CONFIG.aiAgent, ...loaded.aiAgent },
                webhook: { ...DEFAULT_CONFIG.webhook, ...loaded.webhook },
                emailNotification: { ...DEFAULT_CONFIG.emailNotification, ...loaded.emailNotification }
            };
        } catch (e) {
            console.error(`[Config] Error reading local config for tenant ${tenantId}:`, e.message);
        }
    }
    fs.writeFileSync(tenantFile, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

// Save Config (Supabase upsert or local file save fallback)
async function saveBrainConfig(tenantId, newConfig) {
    if (supabase) {
        try {
            const { error } = await supabase
                .from('agent_settings')
                .upsert({ tenant_id: tenantId, settings: newConfig });
            if (error) {
                console.error(`[Supabase] Error saving settings for ${tenantId}:`, error);
            } else {
                console.log(`[Supabase] Configuration saved successfully for tenant: ${tenantId}`);
                return;
            }
        } catch (err) {
            console.error(`[Supabase] Exception saving config for ${tenantId}:`, err);
        }
    }

    // Fallback to Local config storage
    const configDir = path.join(__dirname, 'configs');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    const tenantFile = path.join(configDir, `brain-config-${tenantId}.json`);
    fs.writeFileSync(tenantFile, JSON.stringify(newConfig, null, 2));
    console.log(`[Config] Configuration saved locally for tenant: ${tenantId}`);
}

// Helper utilities
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function formatTemplate(template, vars) {
    if (!template) return '';
    let text = template;
    for (const [key, val] of Object.entries(vars)) {
        text = text.replace(new RegExp(`{${key}}`, 'g'), val || '');
    }
    return text;
}

// ------------------------------------------------------------------
// SSE Notification Subscriptions
// ------------------------------------------------------------------
let sseClients = [];
function broadcastSSE(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
        if (!data.tenantId || client.tenantId === data.tenantId) {
            try {
                client.res.write(payload);
            } catch (err) {
                console.error('Error writing to SSE client:', err.message);
            }
        }
    });
}

// ------------------------------------------------------------------
// AI Prompt Construction & Providers
// ------------------------------------------------------------------

const crmContextCache = new Map(); // Cache to prevent hitting CRM DB every time

async function getChefContext(jid, client = null) {
    if (!crmSupabase) return null;

    let targetJid = jid;
    if (jid.endsWith('@lid') && client) {
        try {
            const contact = await client.getContactById(jid);
            if (contact && contact.id && contact.id._serialized && contact.id._serialized.endsWith('@c.us')) {
                targetJid = contact.id._serialized;
                console.log(`[CRM] Resolved LID ${jid} to Phone JID ${targetJid}`);
            } else if (contact && contact.id && contact.id.user) {
                targetJid = `${contact.id.user}@c.us`;
                console.log(`[CRM] Resolved LID ${jid} to Phone JID ${targetJid}`);
            }
        } catch (e) {
            console.error(`[CRM] Failed to resolve LID ${jid}:`, e.message);
        }
    }

    if (crmContextCache.has(targetJid)) {
        return crmContextCache.get(targetJid);
    }

    try {
        const match = targetJid.match(/^(\d+)@c\.us$/);
        if (match) {
            const rawPhone = match[1];
            const digits = rawPhone.replace(/\D/g, '');
            let data = null;
            let error = null;

            if (digits.length >= 8) {
                const last8 = digits.substring(digits.length - 8);
                const pattern = '%' + last8.split('').join('%') + '%';
                console.log(`[CRM] Querying Supabase 'chef_profiles' with wildcard: ${pattern}`);
                const res = await crmSupabase
                    .from('chef_profiles')
                    .select('*, chef_verification(*), chef_onboarding_steps(*)')
                    .ilike('contact_phone', pattern)
                    .order('created_at', { ascending: false })
                    .limit(1);
                data = res.data;
                error = res.error;
            } else {
                let orQuery = `contact_phone.eq.+${digits},contact_phone.eq.${digits}`;
                console.log(`[CRM] Querying Supabase 'chef_profiles' with fallback exact or: ${orQuery}`);
                const res = await crmSupabase
                    .from('chef_profiles')
                    .select('*, chef_verification(*), chef_onboarding_steps(*)')
                    .or(orQuery)
                    .order('created_at', { ascending: false })
                    .limit(1);
                data = res.data;
                error = res.error;
            }

            if (data && data.length > 0) {
                const profile = data[0];
                
                // Fetch deeper usage context
                try {
                    const [activitiesRes, menusRes] = await Promise.all([
                        crmSupabase.from('chef_activities').select('activity_type, description, created_at').eq('chef_id', profile.id).order('created_at', {ascending: false}).limit(10),
                        crmSupabase.from('menus').select('summary, is_active').eq('chef_profile_id', profile.id).limit(5)
                    ]);
                    profile.recent_activities = activitiesRes.data || [];
                    profile.menus = menusRes.data || [];
                } catch(e) {
                    console.error('[CRM] Error fetching deeper context:', e.message);
                }

                console.log(`[CRM] Profile matched for phone ${rawPhone}: ${profile.chef_name || profile.id}`);
                crmContextCache.set(targetJid, profile);
                if (targetJid !== jid) crmContextCache.set(jid, profile);
                return profile;
            } else {
                console.log(`[CRM] No row matched in Supabase for phone ${rawPhone}`);
            }
            return null;
        } else {
            console.log(`[CRM] JID ${targetJid} did not match expected regex format.`);
        }
    } catch (err) {
        console.error('[CRM] Fetch error for JID ' + targetJid + ':', err.message);
    }
    return null;
}

async function getCateringLeadContext(jid, client = null) {
    if (!crmSupabase) return null;

    let targetJid = jid;
    if (jid.endsWith('@lid') && client) {
        try {
            const contact = await client.getContactById(jid);
            if (contact && contact.id && contact.id._serialized && contact.id._serialized.endsWith('@c.us')) {
                targetJid = contact.id._serialized;
            } else if (contact && contact.id && contact.id.user) {
                targetJid = `${contact.id.user}@c.us`;
            }
        } catch (e) {
            console.error(`[CRM] Failed to resolve LID ${jid} for catering:`, e.message);
        }
    }

    if (crmContextCache.has(targetJid)) {
        return crmContextCache.get(targetJid);
    }

    try {
        const match = targetJid.match(/^(\d+)@c\.us$/);
        if (match) {
            const rawPhone = match[1];
            const digits = rawPhone.replace(/\D/g, '');
            let data = null;
            let error = null;

            if (digits.length >= 8) {
                const last8 = digits.substring(digits.length - 8);
                const pattern = '%' + last8.split('').join('%') + '%';
                console.log(`[CRM] Querying Supabase 'catering_leads' with wildcard: ${pattern}`);
                const res = await crmSupabase
                    .from('catering_leads')
                    .select('*')
                    .ilike('phone', pattern)
                    .order('created_at', { ascending: false })
                    .limit(1);
                data = res.data;
                error = res.error;
            } else {
                let orQuery = `phone.eq.+${digits},phone.eq.${digits}`;
                console.log(`[CRM] Querying Supabase 'catering_leads' with fallback exact or: ${orQuery}`);
                const res = await crmSupabase
                    .from('catering_leads')
                    .select('*')
                    .or(orQuery)
                    .order('created_at', { ascending: false })
                    .limit(1);
                data = res.data;
                error = res.error;
            }

            if (data && data.length > 0) {
                const lead = data[0];
                const wrapped = { _isCateringLead: true, ...lead };
                console.log(`[CRM] Catering Lead matched for phone ${rawPhone}: ${lead.customer_name || lead.id}`);
                crmContextCache.set(targetJid, wrapped);
                if (targetJid !== jid) crmContextCache.set(jid, wrapped);
                return wrapped;
            } else {
                console.log(`[CRM] No row matched in Supabase 'catering_leads' for phone ${rawPhone}`);
            }
        }
    } catch (err) {
        console.error('[CRM] Fetch error for Catering JID ' + targetJid + ':', err.message);
    }
    return null;
}
function constructAIPrompt(msgs, currentMsgBody, config, chefContext = null) {
    const systemPrompt = config.aiAgent.systemPrompt;

    // Load local knowledge base context if available
    let knowledgeContext = '';
    try {
        const kbPath = path.join(__dirname, 'knowledge-base.txt');
        if (fs.existsSync(kbPath)) {
            knowledgeContext = fs.readFileSync(kbPath, 'utf8');
        }
    } catch (err) {
        console.error('[AI-Brain] Error reading knowledge-base.txt:', err.message);
    }

    let history = '';
    for (const m of msgs) {
        const sender = m.fromMe ? 'Agent (Me)' : 'Client';
        history += `[${sender}]: ${m.body}\n`;
    }

    let crmDataString = '';
    if (chefContext) {
        crmDataString = `\n--- CRM DATA FOR THIS CHEF ---\nThe following is live data from the database for the user you are talking to. Use it to provide hyper-personalized answers (e.g. knowing their plan, name, what steps they are missing, etc):\n${JSON.stringify(chefContext, null, 2)}\n------------------------------\n`;
    }

    let rulesString = '';
    if (config.autoReply && config.autoReply.enabled && config.autoReply.rules && config.autoReply.rules.length > 0) {
        rulesString = `\n--- MANDATORY QUICK ANSWERS ---\nIf the user's intent clearly matches any of the topics below, you MUST reply with the exact pre-configured response provided, adjusting slightly only if necessary to sound natural.\n`;
        for (const rule of config.autoReply.rules) {
            rulesString += `- Topic/Keywords: [${rule.trigger}] -> Reply: "${rule.response}"\n`;
        }
        rulesString += `------------------------------\n`;
    }

    return `${systemPrompt}

${knowledgeContext ? `Use the following official Homemade platform rules and reference knowledge to answer the user's questions accurately:\n${knowledgeContext}\n` : ''}${crmDataString}${rulesString}
Below is the chat history:
${history}
The client's last message is: "${currentMsgBody}"

Analyze the chat history and the user's latest message.
GUARDRAILS AND RULES:
1. If the user's message is a simple acknowledgment (like 'ok', 'thanks', 'cool', '👍') and no response is actually required, respond with exactly: NO_RESPONSE_NEEDED.
2. Do not send long follow-ups if the user just answered a quick question.
3. MULTILINGUAL ENFORCEMENT: You MUST formulate your entire response in the EXACT SAME LANGUAGE that the user used in their last message. For example, if they text in Ukrainian, your ENTIRE reply must be in Ukrainian. If Dutch, reply in Dutch.

Otherwise, return only the proposed text response (do not include any conversational formatting like "Here is the response:" or quotes).`;
}

async function callAIProvider(prompt, config) {
    const provider = config.aiAgent.provider;
    const apiKey = (provider === 'gemini')
        ? (process.env.GEMINI_API_KEY || config.aiAgent.apiKey)
        : (process.env.OPENAI_API_KEY || config.aiAgent.apiKey);

    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'your_openai_api_key_here') {
        throw new Error('LLM API key is not configured. Configure it in .env');
    }

    if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 }
            })
        });
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errBody}`);
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } else {
        const url = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: config.aiAgent.systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3
            })
        });
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errBody}`);
        }
        const data = await response.json();
        return data.choices[0].message.content.trim();
    }
}

// ------------------------------------------------------------------
// SendGrid Mail Sender Utility
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Rule-based message importance evaluator
// ------------------------------------------------------------------
async function evaluateImportance(msgBody, config) {
    if (config.aiAgent && config.aiAgent.apiKey) {
        try {
            const prompt = `Analyze this incoming WhatsApp message: "${msgBody}"
Decide if this message is important enough to require urgent human attention (e.g. business inquiries, custom requests, pricing quotes, client booking demands, complaints, bugs/technical issues).
CRITICAL: You MUST ignore random emojis, crazy status updates, spam, minor greetings, short nonsensical texts, and simple gratitude/acknowledgment (like 'ok', 'thanks', 'hello'). Only flag actually important, actionable inquiries.
If it is truly important, respond with exactly: IMPORTANT
Otherwise, respond with exactly: NOT_IMPORTANT.`;
            const result = await callAIProvider(prompt, config);
            return result.toUpperCase().includes('IMPORTANT') && !result.toUpperCase().includes('NOT_IMPORTANT');
        } catch (e) {
            console.error('[Agent] Error evaluating importance with AI, using rules fallback:', e.message);
        }
    }

    const text = msgBody.toLowerCase();
    const triggers = ['price', 'pricing', 'cost', 'meeting', 'call', 'book', 'calendly', 'help', 'urgent', 'error', 'wrong', 'fail', 'issue', 'complaint', 'why', 'how', 'when', 'collab', 'partner', 'important', 'crazy', 'attention', 'alert', 'need', 'reply', 'human'];

    if (config.autoReply && config.autoReply.rules) {
        config.autoReply.rules.forEach(rule => {
            if (rule.trigger) {
                const cleanedTrigger = rule.trigger.toLowerCase().trim();
                if (cleanedTrigger && !triggers.includes(cleanedTrigger)) {
                    triggers.push(cleanedTrigger);
                }
            }
        });
    }

    const isShortAck = text.length < 10 && (
        /\bok\b/i.test(text) ||
        /\bthanks\b/i.test(text) ||
        /\bbye\b/i.test(text) ||
        /\bcool\b/i.test(text) ||
        /\bgood\b/i.test(text)
    );

    const matchedTrigger = triggers.find(t => {
        const escaped = escapeRegExp(t);
        const regex = new RegExp('\\b' + escaped + '\\b', 'i');
        return regex.test(text);
    });

    const isLong = text.length > 40;
    const isImportant = !isShortAck && (!!matchedTrigger || isLong);

    console.log(`[Agent] Evaluating importance of: "${msgBody}". Match: ${matchedTrigger || 'None'}, Long: ${isLong}, Result: ${isImportant ? 'IMPORTANT' : 'NOT_IMPORTANT'}`);
    return isImportant;
}

// ------------------------------------------------------------------
// Multi-Tenant Session Manager Service
// ------------------------------------------------------------------
class SessionManager {
    constructor() {
        this.sessions = new Map();         // tenantId -> Client
        this.statuses = new Map();         // tenantId -> Status string
        this.qrTexts = new Map();          // tenantId -> Base64 string
        this.syncPercents = new Map();     // tenantId -> integer
        this.syncMsgs = new Map();         // tenantId -> string
        this.queues = new Map();           // tenantId -> Array
        this.isProcessingQueue = new Map(); // tenantId -> boolean
    }

    async getClient(tenantId) {
        return this.sessions.get(tenantId);
    }

    getStatus(tenantId) {
        return this.statuses.get(tenantId) || 'DISCONNECTED';
    }

    getQrText(tenantId) {
        return this.qrTexts.get(tenantId) || '';
    }

    getSyncInfo(tenantId) {
        return {
            percent: this.syncPercents.get(tenantId) || 0,
            message: this.syncMsgs.get(tenantId) || ''
        };
    }

    async initializeSession(tenantId) {
        if (this.sessions.has(tenantId)) {
            // Already running
            return;
        }

        console.log(`[Sessions] 🚀 Initializing dynamic session for tenant: ${tenantId}`);

        // Restore session files from Supabase if not present locally
        try {
            await restoreSessionFromSupabase(tenantId);
        } catch (restoreErr) {
            console.error(`[Sessions] Error restoring session for tenant ${tenantId}:`, restoreErr.message);
        }

        this.statuses.set(tenantId, 'INITIALIZING');
        this.queues.set(tenantId, []);
        this.isProcessingQueue.set(tenantId, false);

        // Pre-boot cleanup: Scrub Chromium lock files to prevent "profile in use" crashes
        // We do NOT use fs.existsSync on the file itself because SingletonLock is often a symlink. 
        // If the target process is dead, existsSync returns false, and the broken symlink is never deleted!
        const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-tenant-${tenantId}`);
        const defaultProfilePath = path.join(sessionPath, 'Default');

        [sessionPath, defaultProfilePath].forEach(dir => {
            if (fs.existsSync(dir)) {
                const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
                lockFiles.forEach(file => {
                    const filePath = path.join(dir, file);
                    try {
                        fs.unlinkSync(filePath); // Just attempt to delete, catch handles if it doesn't exist
                    } catch (e) { }
                });
            }
        });

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `tenant-${tenantId}`,
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                protocolTimeout: 120000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-site-isolation-trials'
                ]
            }
        });

        this.sessions.set(tenantId, client);

        client.on('qr', (qr) => {
            console.log(`[Sessions] 📲 New QR Code generated for tenant: ${tenantId}`);
            this.statuses.set(tenantId, 'QR_READY');
            this.qrTexts.set(tenantId, qr);
            broadcastSSE({ type: 'qr', tenantId, qr });
            broadcastSSE({ type: 'status', tenantId, status: 'QR_READY' });
        });

        client.on('authenticated', () => {
            console.log(`[Sessions] ✅ Client authenticated successfully for tenant: ${tenantId}`);
            this.statuses.set(tenantId, 'AUTHENTICATED');
            this.qrTexts.delete(tenantId);
            broadcastSSE({ type: 'status', tenantId, status: 'AUTHENTICATED' });
        });

        client.on('auth_failure', (msg) => {
            console.error(`[Sessions] ❌ Auth failure for tenant ${tenantId}:`, msg);
            this.statuses.set(tenantId, 'AUTH_FAILURE');
            broadcastSSE({ type: 'status', tenantId, status: 'AUTH_FAILURE', message: msg });
        });

        let lastPercent = 0;
        client.on('loading_screen', (percent, message) => {
            const pct = parseInt(percent, 10);
            if (pct !== lastPercent) {
                console.log(`[Sessions] ⏳ Syncing chats for tenant ${tenantId}: ${pct}% - ${message}`);
                lastPercent = pct;
            }
            this.statuses.set(tenantId, 'SYNCING');
            this.syncPercents.set(tenantId, pct);
            this.syncMsgs.set(tenantId, message);
            broadcastSSE({ type: 'sync', tenantId, percent: pct, message });
            broadcastSSE({ type: 'status', tenantId, status: 'SYNCING' });

            // Fix for stuck SYNCING state
            if (pct >= 99) {
                setTimeout(() => {
                    if (this.statuses.get(tenantId) === 'SYNCING') {
                        console.log(`[Sessions] 🚀 Auto-reverting status to READY for tenant ${tenantId} after sync completion.`);
                        this.statuses.set(tenantId, 'READY');
                        broadcastSSE({ type: 'status', tenantId, status: 'READY' });
                    }
                }, 3000);
            }
        });

        client.on('ready', () => {
            console.log(`[Sessions] 🚀 WhatsApp Client READY for tenant: ${tenantId}`);
            this.statuses.set(tenantId, 'READY');
            this.qrTexts.delete(tenantId);
            broadcastSSE({ type: 'status', tenantId, status: 'READY' });

            // Backup session to Supabase after 5s delay to let local files settle
            setTimeout(() => {
                saveSessionToSupabase(tenantId).catch(err => {
                    console.error(`[Sessions] Error backing up session for tenant ${tenantId}:`, err.message);
                });
            }, 5000);
        });

        // Event: Incoming messages
        client.on('message', async (msg) => {
            const phone = msg.from.split('@')[0];
            const jid = msg.from;

            broadcastSSE({
                type: 'log',
                tenantId: tenantId,
                logType: 'INCOMING',
                phone: phone,
                body: msg.body,
                timestamp: Date.now()
            });

            if (jid.endsWith('@g.us')) {
                return;
            }

            const config = await getBrainConfig(tenantId);

            // 1. Deliver Webhook notifications if enabled
            if (config.webhook && config.webhook.enabled && config.webhook.url) {
                try {
                    fetch(config.webhook.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'whatsapp_incoming_message',
                            tenantId: tenantId,
                            from: msg.from,
                            body: msg.body,
                            timestamp: msg.timestamp
                        })
                    }).catch(err => console.error(`[Webhook] Webhook post failed for tenant ${tenantId}:`, err.message));
                } catch (e) {
                    console.error(`[Webhook] Error dispatching webhook for tenant ${tenantId}:`, e.message);
                }
            }

            // 2. Evaluate Importance & Log Interaction
            let isImportant = false;
            if (phone !== '3197010208809') {
                try {
                    isImportant = await evaluateImportance(msg.body, config);
                    if (isImportant) {
                        console.log(`[Alert] Live important message flagged for tenant ${tenantId}. Pre-flagged in database.`);
                    }
                } catch (err) {
                    console.error(`[Alert] Importance evaluation failed for tenant ${tenantId}:`, err.message);
                }
            }

            if (crmSupabase) {
                crmSupabase.from('whatsapp_chat_history').insert({
                    tenant_id: tenantId,
                    phone: phone,
                    direction: 'INCOMING',
                    message_body: msg.body,
                    is_important: isImportant
                }).then(({ error }) => {
                    if (error) console.error('[History] INCOMING Insert failed:', error.message);
                });
            }

            // 3. Welcome Message Auto-Reply Trigger
            if (config.welcomeMessage && config.welcomeMessage.enabled && config.welcomeMessage.template) {
                try {
                    const chat = await msg.getChat();
                    const msgs = await chat.fetchMessages({ limit: 5 });
                    const sentByMe = msgs.filter(m => m.fromMe);
                    if (sentByMe.length === 0) {
                        console.log(`[Agent] Sending welcome message template to: ${jid}`);
                        this.queueMessage(tenantId, jid, config.welcomeMessage.template);
                        return;
                    }
                } catch (e) {
                    console.error(`[Agent] Error sending welcome message for tenant ${tenantId}:`, e.message);
                }
            }

            // 4. Keyword Auto-Reply
            if (config.autoReply && config.autoReply.enabled && config.autoReply.rules && config.autoReply.rules.length > 0) {
                let matchedRule = null;
                const lowerMsg = msg.body.toLowerCase();
                for (const rule of config.autoReply.rules) {
                    const triggers = rule.trigger.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                    for (const t of triggers) {
                        if (t && lowerMsg.includes(t)) {
                            matchedRule = rule;
                            break;
                        }
                    }
                    if (matchedRule) break;
                }

                if (matchedRule) {
                    console.log(`[Agent] Keyword match found for "${matchedRule.trigger}" on tenant ${tenantId}`);
                    this.queueMessage(tenantId, jid, matchedRule.response);
                    return;
                }
            }
            const hasApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || (config.aiAgent && config.aiAgent.apiKey);
            if (config.aiAgent && config.aiAgent.enabled && hasApiKey) {
                console.log(`[Agent] Generating automated AI response for JID: ${jid} on tenant ${tenantId}`);
                try {
                    let finalMsgs = [];
                    if (crmSupabase) {
                        const { data } = await crmSupabase.from('whatsapp_chat_history')
                            .select('direction, message_body')
                            .eq('phone', phone)
                            .order('created_at', { ascending: false })
                            .limit(30);
                        if (data && data.length > 0) {
                            finalMsgs = data.reverse().map(m => ({
                                fromMe: m.direction === 'OUTGOING',
                                body: m.message_body
                            }));
                        }
                    }
                    if (finalMsgs.length === 0) {
                        const chat = await msg.getChat();
                        finalMsgs = await chat.fetchMessages({ limit: 8 });
                    }

                    const chefContext = await getChefContext(jid, client);
                    const prompt = constructAIPrompt(finalMsgs, msg.body, config, chefContext);
                    const reply = await callAIProvider(prompt, config);

                    if (reply && reply !== 'NO_RESPONSE_NEEDED') {
                        console.log(`[Agent] Automated AI reply formulated. Queuing send...`);
                        this.queueMessage(tenantId, jid, reply);
                    }
                } catch (e) {
                    console.error(`[Agent] Error processing automated AI response for tenant ${tenantId}:`, e.message);
                }
            }
        });

        // Event: Message create (captures outgoing messages)
        client.on('message_create', (msg) => {
            if (msg.fromMe) {
                const phone = msg.to.split('@')[0];
                broadcastSSE({
                    type: 'log',
                    tenantId: tenantId,
                    logType: 'OUTGOING',
                    phone: phone,
                    body: msg.body,
                    timestamp: Date.now()
                });

                if (crmSupabase) {
                    crmSupabase.from('whatsapp_chat_history').insert({
                        tenant_id: tenantId,
                        phone: phone,
                        direction: 'OUTGOING',
                        message_body: msg.body,
                        is_important: false
                    }).then(({ error }) => {
                        if (error) console.error('[History] OUTGOING Insert failed:', error.message);
                    });
                }
            }
        });

        client.on('disconnected', (reason) => {
            console.log(`[Sessions] 🔌 Disconnected for tenant ${tenantId}:`, reason);
            this.statuses.set(tenantId, 'DISCONNECTED');
            broadcastSSE({ type: 'status', tenantId, status: 'DISCONNECTED' });
            this.sessions.delete(tenantId);

            // If WhatsApp explicitly logged us out, the local session files are now
            // invalid. Wipe them so the next boot can restore a valid session from Supabase.
            if (reason === 'LOGOUT') {
                const authPath = path.join(__dirname, `.wwebjs_auth/session-tenant-${tenantId}`);
                try {
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                        console.log(`[Sessions] 🗑️ Cleared invalidated local session files for tenant ${tenantId} after LOGOUT.`);
                    }
                } catch (cleanupErr) {
                    console.error(`[Sessions] Error cleaning up session files after LOGOUT for tenant ${tenantId}:`, cleanupErr.message);
                }
            } else {
                // For non-LOGOUT disconnects (e.g. network issues, browser crash),
                // attempt auto-reconnect after a short delay
                console.log(`[Sessions] ♻️ Will attempt auto-reconnect for tenant ${tenantId} in 15s...`);
                setTimeout(() => {
                    if (this.statuses.get(tenantId) === 'DISCONNECTED') {
                        console.log(`[Sessions] ♻️ Auto-reconnecting tenant ${tenantId}...`);
                        this.initializeSession(tenantId).catch(err => {
                            console.error(`[Sessions] ♻️ Auto-reconnect failed for tenant ${tenantId}:`, err.message);
                        });
                    }
                }, 15000);
            }
        });

        try {
            await client.initialize();
        } catch (initErr) {
            console.error(`[Sessions] ❌ Initialization failed for tenant ${tenantId}:`, initErr.message);
            this.statuses.set(tenantId, 'FAILED');
            broadcastSSE({ type: 'status', tenantId, status: 'FAILED' });
            this.sessions.delete(tenantId);
        }
    }

    queueMessage(tenantId, jid, text) {
        const q = this.queues.get(tenantId) || [];
        q.push({
            jid: jid,
            messageText: text,
            retryCount: 0,
            timestamp: Date.now()
        });
        this.queues.set(tenantId, q);
        this.processQueue(tenantId);
    }

    async processQueue(tenantId) {
        if (this.isProcessingQueue.get(tenantId)) return;
        this.isProcessingQueue.set(tenantId, true);

        const q = this.queues.get(tenantId) || [];
        const client = this.sessions.get(tenantId);

        if (!client || this.statuses.get(tenantId) !== 'READY') {
            this.isProcessingQueue.set(tenantId, false);
            return;
        }

        while (q.length > 0) {
            const item = q.shift();
            const minDelay = parseInt(process.env.MIN_DELAY_MS, 10) || 5000;
            const maxDelay = parseInt(process.env.MAX_DELAY_MS, 10) || 15000;
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

            console.log(`[Queue] Tenant ${tenantId}: Simulating typing. Next send in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                // Simulate typing status before sending
                const chat = await client.getChatById(item.jid);
                await chat.sendStateTyping();

                const typingDelay = Math.min(8000, Math.max(2000, item.messageText.length * 50));
                await new Promise(resolve => setTimeout(resolve, typingDelay));

                await client.sendMessage(item.jid, item.messageText);
                console.log(`[Queue] Tenant ${tenantId}: Message sent successfully to ${item.jid}`);
            } catch (err) {
                console.error(`[Queue] Tenant ${tenantId}: ❌ Failed sending to ${item.jid}:`, err.message);
                if (item.retryCount < 3) {
                    item.retryCount++;
                    q.push(item);
                }
            }
        }
        this.isProcessingQueue.set(tenantId, false);
    }

    async removeSession(tenantId) {
        const client = this.sessions.get(tenantId);
        const status = this.statuses.get(tenantId);
        if (client) {
            try {
                if (status === 'READY') {
                    console.log(`[Sessions] Logging out tenant ${tenantId} via WhatsApp Web protocol...`);
                    await client.logout();
                }
            } catch (e) {
                console.error(`[Sessions] Error calling client.logout() for tenant ${tenantId}:`, e.message);
            }
            try {
                await client.destroy();
            } catch (e) {
                console.error(`[Sessions] Error destroying client for tenant ${tenantId}:`, e.message);
            }
            this.sessions.delete(tenantId);
            this.statuses.delete(tenantId);
            this.qrTexts.delete(tenantId);
            this.queues.delete(tenantId);
            this.isProcessingQueue.delete(tenantId);
            this.syncPercents.delete(tenantId);
            this.syncMsgs.delete(tenantId);

            // Let the OS release the folder locks
            await new Promise(resolve => setTimeout(resolve, 1500));
            const authPath = path.join(__dirname, `.wwebjs_auth/session-tenant-${tenantId}`);
            if (fs.existsSync(authPath)) {
                for (let i = 0; i < 5; i++) {
                    try {
                        fs.rmSync(authPath, { recursive: true, force: true });
                        console.log(`[Sessions] 🗑️ Cleaned up authentication session folders for: ${tenantId}`);
                        break;
                    } catch (rmErr) {
                        console.warn(`[Sessions] Retrying folder deletion for tenant ${tenantId} (${i + 1}/5):`, rmErr.message);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            // Delete from Supabase if configured
            if (supabase) {
                try {
                    await supabase
                        .from('whatsapp_sessions')
                        .delete()
                        .eq('tenant_id', tenantId);
                    console.log(`[Supabase-Session] Deleted saved session from Supabase for tenant: ${tenantId}`);
                } catch (dbErr) {
                    console.error(`[Supabase-Session] Error deleting session from Supabase for tenant ${tenantId}:`, dbErr.message);
                }
            }
        }
    }
}

const sessionManager = new SessionManager();

// ------------------------------------------------------------------
// Catering Leads Welcome Message Daemon (booking_submissions table)
// ------------------------------------------------------------------
if (supabase) {
    const greetedBookings = new Set();

    // 1. Pre-populate existing bookings on startup to avoid double-greetings
    (async () => {
        try {
            const { data, error } = await supabase
                .from('booking_submissions')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(100);
            if (data && !error) {
                data.forEach(row => greetedBookings.add(row.id));
                console.log(`[Catering-Welcome] Pre-populated ${greetedBookings.size} existing booking IDs to ignore.`);
            }
        } catch (err) {
            console.error('[Catering-Welcome] Startup pre-populate error:', err.message);
        }
    })();

    // Greeting helper
    const sendCateringGreeting = async (row) => {
        if (!row || !row.id || greetedBookings.has(row.id)) return;
        greetedBookings.add(row.id);

        const rawPhone = row.phone;
        const name = row.name || '';

        if (!rawPhone) {
            console.log(`[Catering-Welcome] Booking ${row.id} has no phone. Skipping.`);
            return;
        }

        const sanitizedPhone = sanitizePhone(rawPhone);
        if (!sanitizedPhone) {
            console.log(`[Catering-Welcome] Booking ${row.id} has invalid phone number "${rawPhone}". Skipping.`);
            return;
        }

        // Find which active sessions have cateringWelcomeEnabled enabled in settings
        const activeSenders = [];
        const activeSessions = Array.from(sessionManager.sessions.keys());
        for (const tId of activeSessions) {
            try {
                const config = await getBrainConfig(tId);
                if (config.cateringWelcomeEnabled) {
                    activeSenders.push({ tId, config });
                }
            } catch (err) {
                console.error(`[Catering-Welcome] Error checking config for ${tId}:`, err.message);
            }
        }

        if (activeSenders.length === 0) {
            console.log(`[Catering-Welcome] No active account has catering welcome messages enabled. Skipping.`);
            return;
        }

        const jid = `${sanitizedPhone}@c.us`;
        const firstName = name.trim().split(' ')[0] || '';
        const nameReplacement = firstName ? ', ' + firstName : '';

        for (const sender of activeSenders) {
            const template = sender.config.cateringWelcomeMessage || DEFAULT_CONFIG.cateringWelcomeMessage;
            const welcomeText = template.replace('{Name}', nameReplacement);
            console.log(`[Catering-Welcome] 📩 Queueing welcome message for catering lead ${sanitizedPhone} (${name}) on tenant: ${sender.tId}`);
            sessionManager.queueMessage(sender.tId, jid, welcomeText);
        }
    };

    // 2. Realtime listener triggers welcome message on insert
    try {
        supabase
            .channel('public:booking_submissions')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_submissions' }, async (payload) => {
                if (payload && payload.new) {
                    console.log(`[Catering-Welcome] Realtime caught new insert: ${payload.new.id}`);
                    await sendCateringGreeting(payload.new);
                }
            })
            .subscribe((status) => {
                console.log(`[Catering-Welcome] Supabase Realtime channel status: ${status}`);
            });
    } catch (realtimeErr) {
        console.error('[Catering-Welcome] Realtime subscription exception:', realtimeErr.message);
    }

    // 3. Robust polling engine (fallback in case connection goes quiet or realtime is disabled)
    setInterval(async () => {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('booking_submissions')
                .select('*')
                .gte('created_at', fiveMinutesAgo);

            if (data && !error) {
                for (const row of data) {
                    if (!greetedBookings.has(row.id)) {
                        console.log(`[Catering-Welcome] Polling fallback caught un-greeted booking: ${row.id}`);
                        await sendCateringGreeting(row);
                    }
                }
            }
        } catch (pollErr) {
            console.error('[Catering-Welcome] Polling fallback exception:', pollErr.message);
        }
    }, 20000);
}

// ------------------------------------------------------------------
// "No Answer" Followup Daemon (chef_admin_data & old_leads)
// ------------------------------------------------------------------
if (crmSupabase) {
    const notifiedNoAnswers = new Set();

    // 1. Pre-populate already existing 'no_answer' records at startup so we don't spam historical records on boot
    (async () => {
        try {
            // Pre-populate chef_admin_data
            const { data: cadData, error: cadErr } = await crmSupabase
                .from('chef_admin_data')
                .select('id')
                .eq('admin_status', 'called_no_answer')
                .limit(500);
            if (cadData && !cadErr) {
                cadData.forEach(row => notifiedNoAnswers.add(row.id));
                console.log(`[NoAnswer-Daemon] Pre-populated ${cadData.length} existing called_no_answer chef_admin_data to ignore.`);
            }

            // Pre-populate old_leads
            const { data: olData, error: olErr } = await crmSupabase
                .from('old_leads')
                .select('id')
                .eq('status', 'no_answer')
                .limit(500);
            if (olData && !olErr) {
                olData.forEach(row => notifiedNoAnswers.add(row.id));
                console.log(`[NoAnswer-Daemon] Pre-populated ${olData.length} existing no_answer old_leads to ignore.`);
            }
        } catch (err) {
            console.error('[NoAnswer-Daemon] Startup pre-populate error:', err.message);
        }
    })();

    const dispatchNoAnswerMessage = async (phoneStr, nameStr, recordId, assignedAdminId = null) => {
        if (!phoneStr || notifiedNoAnswers.has(recordId)) return;

        // Determine target tenant if there is a mapped admin assignment
        let targetTenantId = null;
        if (assignedAdminId && ADMIN_TO_TENANT_MAP[assignedAdminId]) {
            targetTenantId = ADMIN_TO_TENANT_MAP[assignedAdminId];
        }

        // Find which active sessions have noAnswerFollowupEnabled enabled in settings
        const activeSenders = [];
        const activeSessions = targetTenantId ? [targetTenantId] : Array.from(sessionManager.sessions.keys());
        for (const tId of activeSessions) {
            try {
                if (sessionManager.getStatus(tId) !== 'READY') {
                    if (targetTenantId) {
                        console.warn(`[NoAnswer-Daemon] Mapped tenant ${tId} for admin ${assignedAdminId} is not READY.`);
                    }
                    continue;
                }
                const config = await getBrainConfig(tId);
                if (config.noAnswerFollowupEnabled) {
                    activeSenders.push({ tId, config });
                } else if (targetTenantId) {
                    console.warn(`[NoAnswer-Daemon] Mapped tenant ${tId} for admin ${assignedAdminId} does not have noAnswerFollowupEnabled enabled.`);
                }
            } catch (err) {
                console.error(`[NoAnswer-Daemon] Error checking config for ${tId}:`, err.message);
            }
        }

        if (activeSenders.length === 0) {
            console.log(`[NoAnswer-Daemon] Dropping No Answer followup for ${phoneStr} - feature is disabled on active target tenant(s).`);
            return;
        }

        notifiedNoAnswers.add(recordId);
        const sanitizedPhone = sanitizePhone(phoneStr);
        if (!sanitizedPhone) return;

        const jid = `${sanitizedPhone}@c.us`;
        const firstName = nameStr ? nameStr.trim().split(' ')[0] : '';
        const nameReplacement = firstName ? ', ' + firstName : '';

        for (const sender of activeSenders) {
            const template = sender.config.noAnswerFollowupMessage || DEFAULT_CONFIG.noAnswerFollowupMessage;
            const messageText = template.replace('{Name}', nameReplacement);
            console.log(`[NoAnswer-Daemon] 📩 Queueing No Answer followup for ${sanitizedPhone} on tenant: ${sender.tId}`);
            sessionManager.queueMessage(sender.tId, jid, messageText);
        }
    };

    try {
        // Listen to chef_admin_data updates
        crmSupabase
            .channel('public:chef_admin_data')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chef_admin_data' }, async (payload) => {
                if (payload.new && payload.new.admin_status === 'called_no_answer') {
                    const chefId = payload.new.chef_profile_id;
                    if (!chefId) return;

                    const { data, error } = await crmSupabase
                        .from('chef_profiles')
                        .select('contact_phone, chef_name')
                        .eq('id', chefId)
                        .single();

                    if (data && !error && data.contact_phone) {
                        await dispatchNoAnswerMessage(data.contact_phone, data.chef_name, payload.new.id, payload.new.assigned_admin_id);
                    }
                }
            })
            .subscribe();

        // Listen to old_leads updates
        crmSupabase
            .channel('public:old_leads')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'old_leads' }, async (payload) => {
                if (payload.new && payload.new.status === 'no_answer') {
                    await dispatchNoAnswerMessage(payload.new.phone, payload.new.name, payload.new.id);
                }
            })
            .subscribe();

        // 3. Robust polling fallback engine (runs every 30 seconds checking updates in the last 5 minutes)
        setInterval(async () => {
            try {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                
                // A. Check chef_admin_data updates
                const { data: cadUpdates, error: cadErr } = await crmSupabase
                    .from('chef_admin_data')
                    .select('*')
                    .eq('admin_status', 'called_no_answer')
                    .gte('updated_at', fiveMinutesAgo);

                if (cadUpdates && !cadErr) {
                    for (const row of cadUpdates) {
                        if (!notifiedNoAnswers.has(row.id)) {
                            console.log(`[NoAnswer-Daemon] Polling fallback caught no-response chef: ${row.id}`);
                            const chefId = row.chef_profile_id;
                            if (chefId) {
                                const { data: chef, error: chefErr } = await crmSupabase
                                    .from('chef_profiles')
                                    .select('contact_phone, chef_name')
                                    .eq('id', chefId)
                                    .single();

                                if (chef && !chefErr && chef.contact_phone) {
                                    await dispatchNoAnswerMessage(chef.contact_phone, chef.chef_name, row.id, row.assigned_admin_id);
                                }
                            }
                        }
                    }
                }

                // B. Check old_leads updates
                const { data: olUpdates, error: olErr } = await crmSupabase
                    .from('old_leads')
                    .select('*')
                    .eq('status', 'no_answer')
                    .gte('updated_at', fiveMinutesAgo);

                if (olUpdates && !olErr) {
                    for (const row of olUpdates) {
                        if (!notifiedNoAnswers.has(row.id)) {
                            console.log(`[NoAnswer-Daemon] Polling fallback caught no-response old_lead: ${row.id}`);
                            await dispatchNoAnswerMessage(row.phone, row.name, row.id);
                        }
                    }
                }

            } catch (pollErr) {
                console.error('[NoAnswer-Daemon] Polling fallback exception:', pollErr.message);
            }
        }, 30000);

        console.log(`[NoAnswer-Daemon] Subscribed to Realtime UPDATE events and Polling fallback for 'no_answer' triggers.`);
    } catch (err) {
        console.error('[NoAnswer-Daemon] Subscription error:', err.message);
    }
}

// ------------------------------------------------------------------
// "Catering No Answer" Followup Daemon (catering_leads table in crmSupabase)
// ------------------------------------------------------------------
if (crmSupabase) {
    const notifiedCateringNoAnswers = new Set();

    // 1. Pre-populate already existing 'no_answer' leads at startup so we don't spam historical records
    (async () => {
        try {
            const { data, error } = await crmSupabase
                .from('catering_leads')
                .select('id')
                .eq('status', 'no_answer')
                .limit(200);

            if (data && !error) {
                data.forEach(row => notifiedCateringNoAnswers.add(row.id));
                console.log(`[Catering-NoAnswer-Daemon] Pre-populated ${notifiedCateringNoAnswers.size} existing no_answer catering leads to ignore.`);
            }
        } catch (err) {
            console.error('[Catering-NoAnswer-Daemon] Startup pre-populate error:', err.message);
        }
    })();

    const dispatchCateringNoAnswerMessage = async (phoneStr, nameStr, recordId, assignedAdminId = null) => {
        if (!phoneStr || notifiedCateringNoAnswers.has(recordId)) return;

        // Determine target tenant if there is a mapped admin assignment
        let targetTenantId = null;
        if (assignedAdminId && ADMIN_TO_TENANT_MAP[assignedAdminId]) {
            targetTenantId = ADMIN_TO_TENANT_MAP[assignedAdminId];
        }

        // Find which active sessions have cateringNoAnswerFollowupEnabled enabled in settings
        const activeSenders = [];
        const activeSessions = targetTenantId ? [targetTenantId] : Array.from(sessionManager.sessions.keys());
        for (const tId of activeSessions) {
            try {
                if (sessionManager.getStatus(tId) !== 'READY') {
                    if (targetTenantId) {
                        console.warn(`[Catering-NoAnswer-Daemon] Mapped tenant ${tId} for admin ${assignedAdminId} is not READY.`);
                    }
                    continue;
                }
                const config = await getBrainConfig(tId);
                if (config.cateringNoAnswerFollowupEnabled) {
                    activeSenders.push({ tId, config });
                } else if (targetTenantId) {
                    console.warn(`[Catering-NoAnswer-Daemon] Mapped tenant ${tId} for admin ${assignedAdminId} does not have cateringNoAnswerFollowupEnabled enabled.`);
                }
            } catch (err) {
                console.error(`[Catering-NoAnswer-Daemon] Error checking config for ${tId}:`, err.message);
            }
        }

        if (activeSenders.length === 0) {
            console.log(`[Catering-NoAnswer-Daemon] Dropping Catering No Answer followup for ${phoneStr} - feature is disabled on active target tenant(s).`);
            return;
        }

        notifiedCateringNoAnswers.add(recordId);
        const sanitizedPhone = sanitizePhone(phoneStr);
        if (!sanitizedPhone) return;

        const jid = `${sanitizedPhone}@c.us`;
        const firstName = nameStr ? nameStr.trim().split(' ')[0] : '';
        const nameReplacement = firstName ? ', ' + firstName : '';

        for (const sender of activeSenders) {
            const template = sender.config.cateringNoAnswerFollowupMessage || DEFAULT_CONFIG.cateringNoAnswerFollowupMessage;
            const messageText = template.replace('{Name}', nameReplacement);
            console.log(`[Catering-NoAnswer-Daemon] 📩 Queueing Catering No Answer followup for ${sanitizedPhone} on tenant: ${sender.tId}`);
            sessionManager.queueMessage(sender.tId, jid, messageText);
        }
    };

    try {
        // 2. Subscribe to Realtime UPDATE events
        crmSupabase
            .channel('public:catering_leads')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'catering_leads' }, async (payload) => {
                if (payload.new && payload.new.status === 'no_answer') {
                    console.log(`[Catering-NoAnswer-Daemon] Realtime update caught status 'no_answer' for: ${payload.new.id}`);
                    await dispatchCateringNoAnswerMessage(payload.new.phone, payload.new.customer_name, payload.new.id, payload.new.assigned_admin_id);
                }
            })
            .subscribe();

        // 3. Polling fallback engine (runs every 20 seconds checking updates in the last 5 minutes)
        setInterval(async () => {
            try {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                const { data, error } = await crmSupabase
                    .from('catering_leads')
                    .select('*')
                    .eq('status', 'no_answer')
                    .gte('updated_at', fiveMinutesAgo);

                if (data && !error) {
                    for (const row of data) {
                        if (!notifiedCateringNoAnswers.has(row.id)) {
                            console.log(`[Catering-NoAnswer-Daemon] Polling fallback caught no-response catering lead: ${row.id}`);
                            await dispatchCateringNoAnswerMessage(row.phone, row.customer_name, row.id, row.assigned_admin_id);
                        }
                    }
                }
            } catch (pollErr) {
                console.error('[Catering-NoAnswer-Daemon] Polling fallback exception:', pollErr.message);
            }
        }, 20000);
        console.log(`[Catering-NoAnswer-Daemon] Subscribed to Realtime UPDATE events for 'no_answer' triggers.`);
    } catch (err) {
        console.error('[Catering-NoAnswer-Daemon] Subscription error:', err.message);
    }
}


// ------------------------------------------------------------------
// "Chef Welcome" Onboarding Daemon (chef_profiles table in crmSupabase)
// ------------------------------------------------------------------
if (crmSupabase) {
    const notifiedChefSignups = new Set();

    // 1. Pre-populate existing chef profiles at startup so we don't greet historical signups on boot
    (async () => {
        try {
            const { data, error } = await crmSupabase
                .from('chef_profiles')
                .select('id')
                .limit(1000);

            if (data && !error) {
                data.forEach(row => notifiedChefSignups.add(row.id));
                console.log(`[Chef-Welcome] Pre-populated ${notifiedChefSignups.size} existing chef profile IDs to ignore.`);
            }
        } catch (err) {
            console.error('[Chef-Welcome] Startup pre-populate error:', err.message);
        }
    })();

    const dispatchChefWelcomeMessage = async (chef) => {
        if (!chef || !chef.contact_phone || notifiedChefSignups.has(chef.id)) return;

        // Find which active sessions have chefWelcomeEnabled enabled in settings
        const activeSenders = [];
        for (const tId of Array.from(sessionManager.sessions.keys())) {
            try {
                if (sessionManager.getStatus(tId) !== 'READY') continue;
                const config = await getBrainConfig(tId);
                if (config.chefWelcomeEnabled) {
                    activeSenders.push({ tId, config });
                }
            } catch (err) {
                console.error(`[Chef-Welcome] Error checking config for ${tId}:`, err.message);
            }
        }

        if (activeSenders.length === 0) {
            console.log(`[Chef-Welcome] Dropping Chef Welcome message for ${chef.contact_phone} - feature is disabled on active target tenant(s).`);
            return;
        }

        notifiedChefSignups.add(chef.id);
        const sanitizedPhone = sanitizePhone(chef.contact_phone);
        if (!sanitizedPhone) return;

        const jid = `${sanitizedPhone}@c.us`;
        const firstName = chef.chef_name ? chef.chef_name.trim().split(' ')[0] : '';
        const nameReplacement = firstName ? ', ' + firstName : '';

        for (const sender of activeSenders) {
            const template = sender.config.chefWelcomeMessage || DEFAULT_CONFIG.chefWelcomeMessage;
            const welcomeText = template.replace('{Name}', nameReplacement);
            console.log(`[Chef-Welcome] 📩 Queueing welcome message for chef ${sanitizedPhone} (${chef.chef_name || 'N/A'}) on tenant: ${sender.tId}`);
            sessionManager.queueMessage(sender.tId, jid, welcomeText);
        }
    };

    try {
        // 2. Subscribe to Realtime INSERT events
        crmSupabase
            .channel('public:chef_profiles')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chef_profiles' }, async (payload) => {
                if (payload.new) {
                    console.log(`[Chef-Welcome] Realtime caught new chef signup: ${payload.new.id}`);
                    await dispatchChefWelcomeMessage(payload.new);
                }
            })
            .subscribe();

        // 3. Polling fallback engine (runs every 30 seconds checking new signups in the last 5 minutes)
        setInterval(async () => {
            try {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                const { data, error } = await crmSupabase
                    .from('chef_profiles')
                    .select('*')
                    .gte('created_at', fiveMinutesAgo);

                if (data && !error) {
                    for (const row of data) {
                        if (!notifiedChefSignups.has(row.id)) {
                            console.log(`[Chef-Welcome] Polling fallback caught new chef signup: ${row.id}`);
                            await dispatchChefWelcomeMessage(row);
                        }
                    }
                }
            } catch (pollErr) {
                console.error('[Chef-Welcome] Polling fallback exception:', pollErr.message);
            }
        }, 30000);

        console.log(`[Chef-Welcome] Subscribed to Realtime INSERT events and Polling fallback for chef signups.`);
    } catch (err) {
        console.error('[Chef-Welcome] Subscription error:', err.message);
    }
}


// ------------------------------------------------------------------
// Express Server & API Endpoints
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

// Auto-start all known tenants on server boot
async function autoStartAllTenants() {
    const tenants = new Set();

    // Always boot 'default'
    tenants.add('default');

    // 1. Add tenants from local configuration files
    const configDir = path.join(__dirname, 'configs');
    if (fs.existsSync(configDir)) {
        try {
            const files = fs.readdirSync(configDir);
            files.forEach(file => {
                const match = file.match(/^brain-config-(.+)\.json$/);
                if (match) {
                    tenants.add(match[1]);
                }
            });
        } catch (e) {
            console.error('[Startup] Error scanning configs:', e.message);
        }
    }

    // 2. Add tenants from local session folders
    const authDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authDir)) {
        try {
            const files = fs.readdirSync(authDir);
            files.forEach(file => {
                const match = file.match(/^session-tenant-(.+)$/);
                if (match) {
                    tenants.add(match[1]);
                }
            });
        } catch (e) {
            console.error('[Startup] Error scanning session folders:', e.message);
        }
    }

    // 3. Add tenants from Supabase settings
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('agent_settings')
                .select('tenant_id');
            if (data && !error) {
                data.forEach(row => {
                    if (row.tenant_id) {
                        tenants.add(row.tenant_id);
                    }
                });
            }
        } catch (dbErr) {
            console.error('[Startup] Error scanning tenants from Supabase settings:', dbErr.message);
        }
    }

    // 4. Add tenants from Supabase session backups table
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .select('tenant_id');
            if (data && !error) {
                data.forEach(row => {
                    if (row.tenant_id) {
                        tenants.add(row.tenant_id);
                    }
                });
            }
        } catch (dbErr) {
            console.error('[Startup] Error scanning tenants from Supabase sessions:', dbErr.message);
        }
    }

    console.log(`[Startup] 🚀 Auto-booting all known tenants: [${Array.from(tenants).join(', ')}]`);

    // Initialize sessions sequentially to prevent overloading CPU/Puppeteer on cold boots
    for (const tenantId of tenants) {
        try {
            console.log(`[Startup] ⏳ Booting tenant session: ${tenantId}`);
            sessionManager.initializeSession(tenantId);
            // Small delay between starts to prevent race conditions during Chromium launches
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (err) {
            console.error(`[Startup] Failed to boot tenant session for ${tenantId}:`, err.message);
        }
    }
    console.log(`[Startup] ✅ Finished auto-booting all tenant sessions.`);
}

// Call startup auto-start handler
autoStartAllTenants();

// 1. Multi-Tenant SSE Event stream subscription
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const tenantId = req.query.tenantId || 'default';
    const sseClient = { res, tenantId };
    sseClients.push(sseClient);

    // Broadcast current state to newly joined client
    const currentStatus = sessionManager.getStatus(tenantId);
    const currentQr = sessionManager.getQrText(tenantId);
    const syncInfo = sessionManager.getSyncInfo(tenantId);

    res.write(`data: ${JSON.stringify({ type: 'status', tenantId, status: currentStatus })}\n\n`);
    if (currentQr) {
        res.write(`data: ${JSON.stringify({ type: 'qr', tenantId, qr: currentQr })}\n\n`);
    }
    if (syncInfo.percent > 0) {
        res.write(`data: ${JSON.stringify({ type: 'sync', tenantId, percent: syncInfo.percent, message: syncInfo.message })}\n\n`);
    }

    req.on('close', () => {
        sseClients = sseClients.filter(c => c.res !== res);
    });
});

// 2. Global status check
app.get('/status', (req, res) => {
    res.json({
        status: 'UP',
        active_sessions: Array.from(sessionManager.sessions.keys()),
        sse_client_count: sseClients.length
    });
});

// 3. Initialize/Boot session
app.post('/api/:tenantId/initialize', async (req, res) => {
    const { tenantId } = req.params;
    try {
        await sessionManager.initializeSession(tenantId);
        return res.json({ success: true, status: sessionManager.getStatus(tenantId) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. Log out/Delete session
app.post('/api/:tenantId/logout', async (req, res) => {
    const { tenantId } = req.params;
    try {
        await sessionManager.removeSession(tenantId);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 5. Fetch config
app.get('/api/:tenantId/config', async (req, res) => {
    const { tenantId } = req.params;
    const config = await getBrainConfig(tenantId);
    return res.json({ success: true, config });
});

// 6. Save config
app.post('/api/:tenantId/config', async (req, res) => {
    const { tenantId } = req.params;
    const newConfig = req.body;
    if (!newConfig) {
        return res.status(400).json({ error: 'Config body is required' });
    }
    await saveBrainConfig(tenantId, newConfig);
    return res.json({ success: true });
});

// 7. Fetch active chats list
app.get('/api/:tenantId/chats', async (req, res) => {
    const { tenantId } = req.params;
    const client = await sessionManager.getClient(tenantId);
    const status = sessionManager.getStatus(tenantId);

    console.log(`[Chats] tenantId=${tenantId} client=${!!client} status=${status} sessions_keys=${JSON.stringify(Array.from(sessionManager.sessions.keys()))}`);

    if (status !== 'READY') {
        return res.status(503).json({ error: 'WhatsApp client is not ready. Status: ' + status, status });
    }

    // If status is READY but client lookup failed, try all session keys
    const resolvedClient = client || Array.from(sessionManager.sessions.values())[0];
    if (!resolvedClient) {
        return res.status(503).json({ error: 'No active client found.', status });
    }

    const fetchAndMapChats = async () => {
        const chats = await resolvedClient.getChats();
        const chatList = await Promise.all(chats.slice(0, 100).map(async (chat) => {
            let lastMsgText = '';
            let lastMsgTime = chat.timestamp;
            let lastMsgFromMe = true;
            try {
                const msgs = await chat.fetchMessages({ limit: 1 });
                if (msgs && msgs.length > 0) {
                    lastMsgText = msgs[0].body;
                    lastMsgTime = msgs[0].timestamp;
                    lastMsgFromMe = msgs[0].fromMe;
                } else if (chat.lastMessage) {
                    lastMsgText = chat.lastMessage.body || '';
                    lastMsgTime = chat.lastMessage.timestamp || chat.timestamp;
                    lastMsgFromMe = chat.lastMessage.fromMe;
                }
            } catch (e) {
                if (chat.lastMessage) {
                    lastMsgText = chat.lastMessage.body || '';
                    lastMsgTime = chat.lastMessage.timestamp || chat.timestamp;
                    lastMsgFromMe = chat.lastMessage.fromMe;
                }
            }
            return {
                id: chat.id._serialized,
                name: chat.name || chat.id.user,
                unreadCount: chat.unreadCount,
                timestamp: lastMsgTime,
                isGroup: chat.isGroup,
                lastMessage: lastMsgText,
                unanswered: lastMsgText ? !lastMsgFromMe : false
            };
        }));
        chatList.sort((a, b) => b.timestamp - a.timestamp);
        return chatList;
    };

    try {
        console.log(`[API] Fetching all active chats for tenant: ${tenantId}`);
        const chatList = await fetchAndMapChats();
        return res.json({ success: true, chats: chatList });
    } catch (err) {
        console.error(`[API] Error fetching chats for ${tenantId}:`, err.message);
        if (err.message.includes('detached Frame') || err.message.includes('Execution context was destroyed') || err.message.includes('detached frame')) {
            console.log('[API] 🔄 Detached frame detected. Re-syncing page...');
            try {
                if (client.pupPage) {
                    await client.pupPage.reload({ waitUntil: 'networkidle2' });
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    const chatList = await fetchAndMapChats();
                    return res.json({ success: true, chats: chatList });
                }
            } catch (recoveryErr) {
                console.error('[API] Recovery failed:', recoveryErr.message);
            }
        }
        return res.status(500).json({ error: err.message });
    }
});

// 13. Fetch all CRM Profiles for Campaign Manager
app.get('/api/crm/profiles', async (req, res) => {
    try {
        const { data, error } = await crmSupabase
            .from('chef_profiles')
            .select('*');
        if (error) throw error;
        return res.json({ success: true, profiles: data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// Fetch all Catering Leads for Dashboard
app.get('/api/crm/catering-leads', async (req, res) => {
    try {
        const { data, error } = await crmSupabase
            .from('catering_leads')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ success: true, leads: data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// 14. Dispatch Batch Campaign
app.post('/api/:tenantId/campaign/send', async (req, res) => {
    const { tenantId } = req.params;
    const { phones, message } = req.body;

    if (!phones || !Array.isArray(phones) || !message) {
        return res.status(400).json({ error: 'Missing phones array or message.' });
    }

    if (sessionManager.getStatus(tenantId) !== 'READY') {
        return res.status(503).json({ error: `Tenant ${tenantId} is not ready.` });
    }

    phones.forEach(phone => {
        if (!phone) return;
        // Strip formatting (keep only digits)
        const rawPhone = phone.toString().replace(/\D/g, '');
        if (rawPhone.length < 8) return;
        const jid = `${rawPhone}@c.us`;
        sessionManager.queueMessage(tenantId, jid, message);
    });

    return res.json({ success: true, queued: phones.length });
});

// 12. Fetch list of all known tenants
app.get('/api/tenants', async (req, res) => {
    const tenants = new Set();

    // 1. Add active sessions
    Array.from(sessionManager.sessions.keys()).forEach(t => tenants.add(t));

    // 2. Add local configuration files
    const configDir = path.join(__dirname, 'configs');
    if (fs.existsSync(configDir)) {
        try {
            const files = fs.readdirSync(configDir);
            files.forEach(file => {
                const match = file.match(/^brain-config-(.+)\.json$/);
                if (match) {
                    tenants.add(match[1]);
                }
            });
        } catch (e) {
            console.error('[API] Error reading local config directory:', e.message);
        }
    }

    // 3. Add tenants from Supabase if active
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('agent_settings')
                .select('tenant_id');
            if (data && !error) {
                data.forEach(row => {
                    if (row.tenant_id) {
                        tenants.add(row.tenant_id);
                    }
                });
            }
        } catch (dbErr) {
            console.error('[API] Error querying tenants from Supabase:', dbErr.message);
        }
    }

    // Always guarantee 'default' is present
    tenants.add('default');

    // Resolve profileName for each tenant
    const tenantsData = [];
    for (const t of tenants) {
        try {
            const config = await getBrainConfig(t);
            tenantsData.push({
                id: t,
                name: config.profileName || t
            });
        } catch (e) {
            tenantsData.push({ id: t, name: t });
        }
    }

    return res.json({ success: true, tenants: tenantsData });
});

// Helper to map history messages and download image media
async function mapMessagesWithMedia(messages) {
    if (!messages) return [];
    return Promise.all(messages.map(async msg => {
        let mediaData = null;
        let mimeType = null;
        if (msg.hasMedia && msg.type === 'image') {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    mediaData = media.data;
                    mimeType = media.mimetype;
                }
            } catch (e) {
                console.warn(`[API] Failed to download media for msg ${msg.id ? msg.id._serialized : 'unknown'}:`, e.message);
            }
        }
        return {
            body: msg.body,
            fromMe: msg.fromMe,
            timestamp: msg.timestamp,
            hasMedia: msg.hasMedia,
            mediaData,
            mimeType
        };
    }));
}

// 8. Fetch message history by raw JID
app.get('/api/:tenantId/history/jid/:jid', async (req, res) => {
    const { tenantId, jid } = req.params;
    const client = await sessionManager.getClient(tenantId);
    const status = sessionManager.getStatus(tenantId);

    if (!client || status !== 'READY') {
        return res.status(503).json({ error: 'WhatsApp client is not ready. Status: ' + status });
    }

    const fetchHistory = async () => {
        const chat = await client.getChatById(jid);
        const messages = await chat.fetchMessages({ limit: 300 });
        return mapMessagesWithMedia(messages);
    };

    try {
        console.log(`[API] Fetching history for direct JID ${jid} on tenant ${tenantId}`);
        const history = await fetchHistory();
        return res.json({ success: true, messages: history });
    } catch (err) {
        console.error(`[API] Error fetching JID history for ${tenantId}:`, err.message);
        if (err.message.includes('detached Frame') || err.message.includes('Execution context was destroyed') || err.message.includes('detached frame')) {
            console.log('[API] 🔄 Detached frame detected in history fetch. Recovering Puppeteer...');
            try {
                if (client.pupPage) {
                    await client.pupPage.reload({ waitUntil: 'networkidle2' });
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    const history = await fetchHistory();
                    return res.json({ success: true, messages: history });
                }
            } catch (recoveryErr) {
                console.error('[API] Recovery failed:', recoveryErr.message);
            }
        }
        return res.status(500).json({ error: err.message });
    }
});

// 9. Fetch message history by phone string
app.get('/api/:tenantId/history/:phone', async (req, res) => {
    const { tenantId, phone } = req.params;
    const sanitizedPhone = sanitizePhone(phone);
    const client = await sessionManager.getClient(tenantId);
    const status = sessionManager.getStatus(tenantId);

    if (!sanitizedPhone) {
        return res.status(400).json({ error: 'Invalid phone number format.' });
    }
    if (!client || status !== 'READY') {
        return res.status(503).json({ error: 'WhatsApp client is not ready yet.' });
    }

    try {
        let numberDetails = null;
        try {
            numberDetails = await client.getNumberId(sanitizedPhone);
        } catch (e) {
            console.warn(`[API] getNumberId failed: ${e.message}`);
        }

        const chatId = numberDetails ? numberDetails._serialized : `${sanitizedPhone}@c.us`;
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 300 });

        const messageHistory = await mapMessagesWithMedia(messages);

        return res.json({ success: true, messages: messageHistory });
    } catch (err) {
        console.error(`[API] Error fetching history for ${phone}:`, err.message);
        return res.status(500).json({ error: err.message });
    }
});

// 9b. Fetch CRM Context for a specific JID
app.get('/api/:tenantId/crm-context/:jid', async (req, res) => {
    try {
        const { tenantId, jid } = req.params;
        const client = await sessionManager.getClient(tenantId);

        console.log(`[API] CRM Context Lookup Initiated for JID: ${jid} (Tenant: ${tenantId})`);
        
        // 1. Try to find chef first
        const chefContext = await getChefContext(jid, client);
        if (chefContext) {
            console.log(`[API] CRM Context Result for JID: ${jid} -> FOUND (Chef)`);
            return res.json({ success: true, type: 'chef', context: chefContext });
        }

        // 2. Try to find catering lead if not chef
        const cateringContext = await getCateringLeadContext(jid, client);
        if (cateringContext) {
            console.log(`[API] CRM Context Result for JID: ${jid} -> FOUND (Catering)`);
            return res.json({ success: true, type: 'catering', context: cateringContext });
        }

        console.log(`[API] CRM Context Result for JID: ${jid} -> NOT FOUND`);
        return res.json({ success: true, type: null, context: null });
    } catch (err) {
        console.error(`[API] CRM context error:`, err.message);
        return res.status(500).json({ error: err.message });
    }
});

// 9c. Debug API to investigate LID structure
app.get('/api/:tenantId/debug/contact/:jid', async (req, res) => {
    try {
        const { tenantId, jid } = req.params;
        const client = await sessionManager.getClient(tenantId);
        if (!client) return res.json({ error: 'No client' });
        const contact = await client.getContactById(jid);
        return res.json({ success: true, contact });
    } catch (err) {
        return res.json({ error: err.message });
    }
});

// 10. Enqueue manual message from UI dashboard
app.post('/api/:tenantId/send', async (req, res) => {
    const { tenantId } = req.params;
    const { phone, jid, message } = req.body;

    if ((!phone && !jid) || !message) {
        return res.status(400).json({ error: 'Recipient phone/jid and message body are required.' });
    }

    const client = await sessionManager.getClient(tenantId);
    const status = sessionManager.getStatus(tenantId);

    if (!client || status !== 'READY') {
        return res.status(503).json({ error: 'WhatsApp client is not ready. Status: ' + status });
    }

    console.log(`[API] Queueing manual message on tenant: ${tenantId}`);
    sessionManager.queueMessage(tenantId, jid || `${sanitizePhone(phone)}@c.us`, message);

    return res.json({
        success: true,
        message: 'Message queued successfully for human-tempo delivery.'
    });
});

// 11. Generate response suggestion
app.post('/api/:tenantId/suggest-response', async (req, res) => {
    const { tenantId } = req.params;
    const { jid } = req.body;

    if (!jid) {
        return res.status(400).json({ error: 'JID is required' });
    }

    const client = await sessionManager.getClient(tenantId);
    const status = sessionManager.getStatus(tenantId);

    if (!client || status !== 'READY') {
        return res.status(503).json({ error: 'WhatsApp client is not ready.' });
    }

    try {
        const chat = await client.getChatById(jid);
        const msgs = await chat.fetchMessages({ limit: 10 });

        if (msgs.length > 0 && msgs[msgs.length - 1].fromMe) {
            return res.json({
                success: true,
                suggestedMessage: 'You already replied to this message.',
                important: false,
                needed: false
            });
        }

        const lastMsgBody = msgs.length > 0 ? msgs[msgs.length - 1].body : '';
        const config = await getBrainConfig(tenantId);
        const hasApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || (config.aiAgent && config.aiAgent.apiKey);

        if (config.aiAgent && hasApiKey) {
            let finalMsgs = msgs;
            if (crmSupabase) {
                const phone = jid.split('@')[0];
                const { data } = await crmSupabase.from('whatsapp_chat_history')
                    .select('direction, message_body')
                    .eq('phone', phone)
                    .order('created_at', { ascending: false })
                    .limit(30);
                if (data && data.length > 0) {
                    finalMsgs = data.reverse().map(m => ({
                        fromMe: m.direction === 'OUTGOING',
                        body: m.message_body
                    }));
                }
            }

            const chefContext = await getChefContext(jid);
            const prompt = constructAIPrompt(finalMsgs, lastMsgBody, config, chefContext);
            try {
                const replyText = await callAIProvider(prompt, config);
                if (replyText === 'NO_RESPONSE_NEEDED') {
                    return res.json({ success: true, suggestedMessage: '', important: false, needed: false });
                }
                return res.json({ success: true, suggestedMessage: replyText, important: true, needed: true });
            } catch (aiErr) {
                console.error('[API] AI suggestion generation error, falling back to rule defaults:', aiErr.message);
            }
        }

        // Rules Fallback Suggestion
        const text = lastMsgBody.toLowerCase().trim();
        let suggestedMessage = '';
        let important = true;

        if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
            suggestedMessage = 'Hi! How can I help you today?';
        } else if (text.includes('price') || text.includes('pricing') || text.includes('cost')) {
            suggestedMessage = 'Our pricing starts at $19/month. Would you like a product demo?';
        } else if (text.includes('meeting') || text.includes('calendly') || text.includes('call')) {
            suggestedMessage = 'Sure! Here is the link to book a meeting: https://calendly.com/homemade-intro';
        } else if (text.length < 5 && (text.includes('ok') || text.includes('thanks') || text.includes('good'))) {
            suggestedMessage = '';
            important = false;
        } else {
            suggestedMessage = `Hi! Thanks for your message. Let me review that and get back to you shortly.`;
        }

        return res.json({
            success: true,
            suggestedMessage,
            important,
            needed: suggestedMessage !== '',
            fallback: true
        });
    } catch (e) {
        console.error('[API] Error generating response suggestion:', e);
        return res.status(500).json({ error: e.message });
    }
});

// 12. General Webhook endpoint (incoming triggers from database / integrations)
app.post('/webhook', async (req, res) => {
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || req.query.api_key;
    if (WEBHOOK_API_KEY && apiKey !== WEBHOOK_API_KEY) {
        console.warn('⚠️ Unauthorized webhook attempt with invalid API key.');
        return res.status(401).json({ error: 'Unauthorized. Invalid API Key.' });
    }

    console.log('📬 Received webhook event payload:', JSON.stringify(req.body, null, 2));

    const tenantId = req.body.tenantId || req.query.tenantId || 'default';
    let phone = null;
    let name = 'Customer';
    let templateName = req.body.template || 'welcome';
    let customVariables = {};

    if (req.body.record) {
        const record = req.body.record;
        phone = record.phone || record.phone_number || record.telephone;
        name = record.first_name || record.name || record.username || name;
        customVariables = { ...record };
    } else {
        phone = req.body.phone || req.body.phoneNumber;
        name = req.body.name || req.body.firstName || name;
        customVariables = req.body.variables || {};
    }

    if (!phone) {
        console.warn('⚠️ Webhook payload missing phone number.');
        return res.status(400).json({ error: 'Bad Request. Phone number is required.' });
    }

    const templateVariables = { name, phone, ...customVariables };
    const renderedMessage = renderTemplate(templateName, templateVariables);

    console.log(`[Webhook] Queueing message for ${phone} (Template: ${templateName}) on tenant ${tenantId}`);
    sessionManager.queueMessage(tenantId, `${sanitizePhone(phone)}@c.us`, renderedMessage);

    return res.status(202).json({
        success: true,
        message: 'Message accepted and queued for human-tempo sending.'
    });
});

// 13. Wildcard routing to react build
app.get(/^(?!\/(api|status|events|webhook)).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// ------------------------------------------------------------------
// Daily Unanswered Chats Email Report Engine
// ------------------------------------------------------------------
cron.schedule('0 18 * * *', async () => {
    // Run daily at 18:00 (6 PM)
    console.log('[Cron] Starting daily unanswered chats report engine for tenant "tia"...');
    let reportText = '📋 *Daily Unanswered Chats Report (Tia)*\n\n';
    let needsFollowUpCount = 0;

    const tenantId = 'tia';
    const client = sessionManager.sessions.get(tenantId);
    const status = sessionManager.getStatus(tenantId);

    if (!client || status !== 'READY') {
        console.error(`[Cron] Cannot generate daily report: tenant ${tenantId} is not READY (Status: ${status}).`);
        return;
    }

    try {
        if (!crmSupabase) {
            console.error('[Cron] CRM Supabase not connected. Cannot generate report.');
            return;
        }

        // Fetch all INCOMING important messages from the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: importantMsgs } = await crmSupabase
            .from('whatsapp_chat_history')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('direction', 'INCOMING')
            .eq('is_important', true)
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: false });

        if (importantMsgs && importantMsgs.length > 0) {
            // Group by phone to get the latest important message
            const phoneMap = new Map();
            for (const msg of importantMsgs) {
                if (!phoneMap.has(msg.phone)) {
                    phoneMap.set(msg.phone, msg);
                }
            }

            for (const [phone, msg] of phoneMap.entries()) {
                // Check if we replied since this message
                const { data: replies } = await crmSupabase
                    .from('whatsapp_chat_history')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('phone', phone)
                    .eq('direction', 'OUTGOING')
                    .gt('created_at', msg.created_at)
                    .limit(1);

                if (!replies || replies.length === 0) {
                    needsFollowUpCount++;
                    reportText += `• *Phone*: ${phone}\n  *Unreplied Important Escalation*: "${msg.message_body}"\n\n`;
                }
            }
        }
    } catch (err) {
        console.error(`[Cron] Error processing tenant ${tenantId}:`, err.message);
    }

    if (needsFollowUpCount === 0) {
        reportText += "Great news! All active chats have been responded to, or the unanswered ones do not require a follow-up.";
    }

    try {
        const targetPhone = '3197010208809';
        const targetJid = `${targetPhone}@c.us`;
        console.log(`[Cron] Queueing daily report to ${targetJid} via tenant "tia"`);
        sessionManager.queueMessage(tenantId, targetJid, reportText);
    } catch (e) {
        console.error('[Cron] Error queueing report WhatsApp message:', e.message);
    }
});

// ------------------------------------------------------------------
// Canceled Orders Refund Verification Engine
// ------------------------------------------------------------------
async function checkCanceledOrders() {
    if (!supabase) {
        console.warn('[Cron-Canceled-Orders] Main Supabase not connected. Skipping.');
        return;
    }

    const hzApiKey = process.env.HYPERZOD_API_KEY;
    const hzTenant = process.env.HYPERZOD_TENANT_ID;

    if (!hzApiKey || !hzTenant) {
        console.warn('[Cron-Canceled-Orders] Hyperzod credentials missing (HYPERZOD_API_KEY / HYPERZOD_TENANT_ID). Skipping.');
        return;
    }

    try {
        console.log('[Cron-Canceled-Orders] Fetching last 50 orders from Hyperzod...');
        const response = await fetch('https://api.hyperzod.app/admin/v1/order/list?page=1&per_page=50', {
            method: 'POST',
            headers: {
                'x-api-key': hzApiKey,
                'x-tenant': hzTenant,
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                per_page: 50
            })
        });

        if (!response.ok) {
            throw new Error(`Hyperzod response status ${response.status}: ${await response.text()}`);
        }

        const resJson = await response.json();
        const allOrders = resJson?.data?.data ?? [];
        
        // Filter in memory for canceled orders (status 6) updated in the last 30 minutes
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        const orders = allOrders.filter(o => {
            if (o.order_status !== 6) return false;
            const updatedAt = new Date(o.updated_at).getTime();
            return updatedAt >= thirtyMinutesAgo;
        });

        console.log(`[Cron-Canceled-Orders] Fetched ${allOrders.length} orders; found ${orders.length} canceled in the last 30 minutes.`);

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

            // Query if we already processed this order
            const { data: existing, error: fetchErr } = await supabase
                .from('processed_canceled_orders')
                .select('*')
                .eq('order_id', orderId)
                .maybeSingle();

            if (fetchErr) {
                console.error(`[Cron-Canceled-Orders] Error fetching from processed_canceled_orders for order #${orderId}:`, fetchErr.message);
                continue;
            }

            let initialEmailSent = existing ? existing.initial_email_sent : false;
            let stripeRefunded = existing ? existing.stripe_refunded : false;
            let stripePaymentIntentId = existing ? existing.stripe_payment_intent_id : null;

            // If new order, verify Stripe first, then send initial email and insert record
            if (!existing) {
                const stripeKey = process.env.STRIPE_SECRET_KEY;
                if (stripeKey) {
                    try {
                        const stripe = require('stripe')(stripeKey);
                        const searchQuery = `metadata['payment_ref_id']:'${orderId}' OR metadata['order_id']:'${orderId}' OR metadata['order_uuid']:'${orderUuid}'`;
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
                        console.error(`[Cron-Canceled-Orders] Stripe check error on first run for order #${orderId}:`, stripeErr.message);
                    }
                }

                // Send initial email to BOTH bangalexf@gmail.com and info@homemademeals.net
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
                            console.error(`[Cron-Canceled-Orders] Failed to send initial email to ${recipient} for order #${orderId}:`, emailErr.message);
                        }
                    }
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
                            console.error('[Cron-Canceled-Orders] Error fetching chef/admin mapping for WhatsApp config:', e.message);
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

                                // Fallback to first available ready tenant if target tenant is not ready/found
                                if (!targetTenantId || sessionManager.getStatus(targetTenantId) !== 'READY') {
                                    const readySessions = Array.from(sessionManager.sessions.keys()).filter(t => sessionManager.getStatus(t) === 'READY');
                                    if (readySessions.length > 0) {
                                        targetTenantId = readySessions[0];
                                    }
                                }

                                if (targetTenantId) {
                                    const whatsappMessageText = formatTemplate(template, {
                                        CustomerName: customerName,
                                        ChefName: chefName,
                                        OrderId: orderId,
                                        OrderAmount: orderAmount
                                    });

                                    console.log(`[Cron-Canceled-Orders] Queueing WhatsApp cancellation msg for customer ${sanitizedCustomerPhone} using tenant ${targetTenantId}`);
                                    sessionManager.queueMessage(targetTenantId, customerJid, whatsappMessageText);
                                } else {
                                    console.warn('[Cron-Canceled-Orders] No active ready WhatsApp session to send cancellation msg.');
                                }
                            }
                        }
                    } else {
                        console.log(`[Cron-Canceled-Orders] WhatsApp cancellation messages are disabled via settings for tenant ${configTenantId}.`);
                    }
                }

                // Insert into the database tracking table
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
                    console.error(`[Cron-Canceled-Orders] Failed to insert order #${orderId} into DB:`, insertErr.message);
                    continue;
                }
            }

            // Only check/update Stripe if it hasn't been verified as refunded yet
            if (!stripeRefunded) {
                const stripeKey = process.env.STRIPE_SECRET_KEY;
                if (!stripeKey) {
                    console.warn(`[Cron-Canceled-Orders] STRIPE_SECRET_KEY is missing. Skipping refund check for order #${orderId}.`);
                    continue;
                }

                try {
                    const stripe = require('stripe')(stripeKey);
                    const searchQuery = `metadata['payment_ref_id']:'${orderId}' OR metadata['order_id']:'${orderId}' OR metadata['order_uuid']:'${orderUuid}'`;
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
                    console.error(`[Cron-Canceled-Orders] Stripe search error for order #${orderId}:`, stripeErr.message);
                }

                // Update the DB record with the latest Stripe status
                const { error: updateErr } = await supabase
                    .from('processed_canceled_orders')
                    .update({
                        stripe_payment_intent_id: stripePaymentIntentId,
                        stripe_refunded: stripeRefunded,
                        updated_at: new Date().toISOString()
                    })
                    .eq('order_id', orderId);

                if (updateErr) {
                    console.error(`[Cron-Canceled-Orders] Failed to update order #${orderId} in DB:`, updateErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[Cron-Canceled-Orders] Execution exception:', err.message);
    }
}

// Schedule canceled orders refund checker to run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Initiating canceled orders refund checker...');
    await checkCanceledOrders();
});

// ------------------------------------------------------------------
// 3-Day Batch Refund Report Generator
// ------------------------------------------------------------------
async function sendUnrefundedBatchReport() {
    if (!supabase) {
        console.warn('[Cron-Batch-Report] Main Supabase not connected. Skipping.');
        return;
    }

    try {
        console.log('[Cron-Batch-Report] Fetching unrefunded canceled orders from database...');
        
        // Fetch all canceled orders in database that are currently marked as NOT refunded
        const { data: unrefundedOrders, error: fetchErr } = await supabase
            .from('processed_canceled_orders')
            .select('*')
            .eq('stripe_refunded', false);

        if (fetchErr) {
            console.error('[Cron-Batch-Report] Error fetching from DB:', fetchErr.message);
            return;
        }

        if (!unrefundedOrders || unrefundedOrders.length === 0) {
            console.log('[Cron-Batch-Report] No unrefunded orders found in database. Skipping report.');
            return;
        }

        console.log(`[Cron-Batch-Report] Found ${unrefundedOrders.length} unrefunded orders in DB. Double-checking Stripe status...`);

        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@homemademeals.net';
        const stripeKey = process.env.STRIPE_SECRET_KEY;

        const verifiedUnrefunded = [];

        // Double check each order on Stripe to make sure the report is completely accurate
        for (const order of unrefundedOrders) {
            let stripeRefunded = false;
            let stripePaymentIntentId = order.stripe_payment_intent_id;

            if (stripeKey) {
                try {
                    const stripe = require('stripe')(stripeKey);
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
                    console.error(`[Cron-Batch-Report] Stripe double-check error for order #${order.order_id}:`, stripeErr.message);
                }
            }

            if (stripeRefunded) {
                // Update DB since it has been refunded since last check
                const { error: updateErr } = await supabase
                    .from('processed_canceled_orders')
                    .update({ stripe_refunded: true, stripe_payment_intent_id: stripePaymentIntentId, updated_at: new Date().toISOString() })
                    .eq('order_id', order.order_id);
                if (updateErr) {
                    console.error(`[Cron-Batch-Report] Failed to update order #${order.order_id} to refunded:`, updateErr.message);
                }
            } else {
                verifiedUnrefunded.push({
                    ...order,
                    stripe_payment_intent_id: stripePaymentIntentId
                });
            }
        }

        if (verifiedUnrefunded.length === 0) {
            console.log('[Cron-Batch-Report] All orders were refunded upon Stripe double-check. Skipping report.');
            return;
        }

        // Send the batch report email
        if (sendgridApiKey) {
            console.log(`[Cron-Batch-Report] Sending batch report with ${verifiedUnrefunded.length} unrefunded orders...`);
            
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
                    console.error(`[Cron-Batch-Report] Failed to send report to ${recipient}:`, emailErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[Cron-Batch-Report] Execution exception:', err.message);
    }
}

// Schedule batch report cron to run once every 3 days at 9:00 AM
cron.schedule('0 9 */3 * *', async () => {
    console.log('[Cron] Initiating 3-day batch refund report...');
    await sendUnrefundedBatchReport();
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`\n==================================================================`);
    console.log(`🌐 Webhook Server running on http://localhost:${PORT}`);
    console.log(`🛡️ Webhook Auth Key: ${WEBHOOK_API_KEY || '(None set)'}`);
    console.log(`📥 Endpoint: POST http://localhost:${PORT}/webhook`);
    console.log(`==================================================================\n`);
});
