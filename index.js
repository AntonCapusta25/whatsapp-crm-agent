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
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/dist')));

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
    
    // Only skip restore if the folder has actual WhatsApp auth data inside (Default/Cookies or similar)
    if (fs.existsSync(sessionDir)) {
        const defaultDir = path.join(sessionDir, 'Default');
        const hasAuthData = fs.existsSync(defaultDir) && fs.readdirSync(defaultDir).length > 5;
        if (hasAuthData) {
            console.log(`[Supabase-Session] Local session folder already exists for tenant ${tenantId}. Skipping restore.`);
            return true;
        } else {
            console.log(`[Supabase-Session] Local folder for tenant ${tenantId} exists but has no valid auth data. Attempting Supabase restore...`);
            // Remove the blank folder so we can extract properly
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
    return cleaned;
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
            const phoneWithPlus = '+' + rawPhone;
            
            // Generate local format if Dutch mobile (316 -> 06)
            let localPhone = '';
            if (rawPhone.startsWith('316')) {
                localPhone = '06' + rawPhone.substring(3);
            }
            
            // Build query
            let orQuery = `contact_phone.eq.${phoneWithPlus},contact_phone.eq.${rawPhone}`;
            if (localPhone) orQuery += `,contact_phone.eq.${localPhone}`;
            
            console.log(`[CRM] Querying Supabase 'chef_profiles' for phone variants: ${orQuery}`);
            
            // Use limit(1) instead of .single() because users often have multiple test accounts 
            // with the same phone number, which causes .single() to crash with HTTP 406!
            let { data, error } = await crmSupabase
                .from('chef_profiles')
                .select('*, chef_verification(*), chef_onboarding_steps(*)')
                .or(orQuery)
                .order('created_at', { ascending: false })
                .limit(1);
                
            if (data && data.length > 0) {
                const profile = data[0];
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
GUARDRAILS TO PREVENT SPAM:
1. If the user's message is a simple acknowledgment (like 'ok', 'thanks', 'cool', '👍') and no response is actually required, respond with exactly: NO_RESPONSE_NEEDED.
2. Do not send long follow-ups if the user just answered a quick question.

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
If it is important, respond with exactly: IMPORTANT
If it is a minor greeting, status update, spam, or simple gratitude/acknowledgment (like 'ok', 'thanks', 'hello'), respond with exactly: NOT_IMPORTANT.`;
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

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `tenant-${tenantId}`,
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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

            // 2. Evaluate Importance & send SendGrid Notification
            if (config.emailNotification && config.emailNotification.enabled) {
                try {
                    const isImportant = await evaluateImportance(msg.body, config);
                    if (isImportant) {
                        const mailApiKey = process.env.SENDGRID_API_KEY || config.emailNotification.apiKey;
                        const fromEmail = process.env.SENDGRID_FROM_EMAIL || config.emailNotification.fromEmail;
                        const toEmail = process.env.SENDGRID_TO_EMAIL || config.emailNotification.toEmail;
                        const subject = config.emailNotification.subject || "⚠️ Urgent WhatsApp Handoff Alert";

                        if (mailApiKey && fromEmail && toEmail) {
                            const emailBody = `Hello,\n\nYour WhatsApp agent has flagged an important message from client.\n\nTenant: ${tenantId}\nContact: ${phone}\nMessage: "${msg.body}"\n\nPlease reply accordingly on the dashboard.`;
                            sendSendGridEmail({
                                apiKey: mailApiKey,
                                to: toEmail,
                                from: fromEmail,
                                subject,
                                text: emailBody
                            }).catch(err => console.error(`[Alert] SendGrid dispatch error for tenant ${tenantId}:`, err.message));
                        }
                    }
                } catch (err) {
                    console.error(`[Alert] Importance evaluation failed for tenant ${tenantId}:`, err.message);
                }
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
                    const chat = await msg.getChat();
                    const msgs = await chat.fetchMessages({ limit: 8 });
                    
                    const chefContext = await getChefContext(jid, client);
                    const prompt = constructAIPrompt(msgs, msg.body, config, chefContext);
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
            }
        });

        client.on('disconnected', (reason) => {
            console.log(`[Sessions] 🔌 Disconnected for tenant ${tenantId}:`, reason);
            this.statuses.set(tenantId, 'DISCONNECTED');
            broadcastSSE({ type: 'status', tenantId, status: 'DISCONNECTED' });
            this.sessions.delete(tenantId);
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
                        console.warn(`[Sessions] Retrying folder deletion for tenant ${tenantId} (${i+1}/5):`, rmErr.message);
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
if (crmSupabase) {
    const greetedBookings = new Set();
    
    // 1. Pre-populate existing bookings on startup to avoid double-greetings
    (async () => {
        try {
            const { data, error } = await crmSupabase
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
                    activeSenders.push(tId);
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
        const welcomeText = `hey, its tia from homemade\n\nthank you so much for signing up for a private chef${firstName ? ', ' + firstName : ''}! can you provide your city and confirm the dates so we can proceed and communicate it with a chef?`;
        
        for (const senderTenantId of activeSenders) {
            console.log(`[Catering-Welcome] 📩 Queueing welcome message for catering lead ${sanitizedPhone} (${name}) on tenant: ${senderTenantId}`);
            sessionManager.queueMessage(senderTenantId, jid, welcomeText);
        }
    };

    // 2. Realtime listener triggers welcome message on insert
    try {
        crmSupabase
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
        const context = await getChefContext(jid, client);
        console.log(`[API] CRM Context Result for JID: ${jid} -> ${context ? 'FOUND' : 'NOT FOUND'}`);
        
        return res.json({ success: true, context });
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
            const chefContext = await getChefContext(jid);
            const prompt = constructAIPrompt(msgs, lastMsgBody, config, chefContext);
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
    console.log('[Cron] Starting daily unanswered chats report engine...');
    let reportText = 'Daily Unanswered Chats Report\n\n';
    let needsFollowUpCount = 0;
    
    // We need to bypass the strict systemPrompt for this classification task
    // so we pass a dummy config to callAIProvider that turns it into a classifier.
    const classifierConfig = {
        aiAgent: {
            provider: 'gemini',
            apiKey: process.env.GEMINI_API_KEY,
            systemPrompt: 'You are an analytical AI.'
        }
    };

    for (const [tenantId, client] of sessionManager.sessions.entries()) {
        if (sessionManager.getStatus(tenantId) !== 'READY') continue;
        
        try {
            const chats = await client.getChats();
            const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

            for (const chat of chats) {
                if (chat.isGroup) continue;

                // Only consider chats with unread messages or where the last message is from the client
                const messages = await chat.fetchMessages({ limit: 5 });
                if (messages.length === 0) continue;
                
                const lastMsg = messages[messages.length - 1];
                if (lastMsg.fromMe) continue; // We replied recently.

                if (apiKey) {
                    const prompt = `Analyze this chat history. The last message is from the client. Does this message reasonably require a response or follow-up from the agent? \nIf it's just a simple 'ok', 'thanks', 'cool', '👍', or a conversational ender, return exactly "NO". \nIf it contains a question, a complaint, or requires an operational response, return exactly "YES".\n\nChat history:\n` + messages.map(m => `[${m.fromMe ? 'Agent' : 'Client'}]: ${m.body}`).join('\n');
                    
                    try {
                        const aiDecision = await callAIProvider(prompt, classifierConfig);
                        if (aiDecision.trim().toUpperCase() === 'YES') {
                            needsFollowUpCount++;
                            reportText += `- Tenant: ${tenantId}\n  Chat: ${chat.name}\n  Phone: ${chat.id.user}\n  Last Message: "${lastMsg.body}"\n\n`;
                        }
                    } catch (e) {
                        console.error(`[Cron] AI classification failed for ${chat.id.user}:`, e.message);
                    }
                }
            }
        } catch (err) {
            console.error(`[Cron] Error processing tenant ${tenantId}:`, err.message);
        }
    }

    if (needsFollowUpCount === 0) {
        reportText += "Great news! All active chats have been responded to, or the unanswered ones do not require a follow-up.";
    }

    try {
        const sendgridKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL;
        const toEmails = ['bangalexf@gmail.com', 'mahmoudelwakil22@gmail.com'];
        
        if (sendgridKey && fromEmail) {
            for (const email of toEmails) {
                await sendSendGridEmail({
                    to: email,
                    from: fromEmail,
                    subject: `Daily Unanswered Chats Report - ${needsFollowUpCount} Need Action`,
                    text: reportText,
                    apiKey: sendgridKey
                });
            }
            console.log('[Cron] Daily report emails sent successfully.');
        } else {
            console.warn('[Cron] SENDGRID_API_KEY or FROM_EMAIL not set. Skipping report email.');
        }
    } catch (e) {
        console.error('[Cron] Error sending report email:', e.message);
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`\n==================================================================`);
    console.log(`🌐 Webhook Server running on http://localhost:${PORT}`);
    console.log(`🛡️ Webhook Auth Key: ${WEBHOOK_API_KEY || '(None set)'}`);
    console.log(`📥 Endpoint: POST http://localhost:${PORT}/webhook`);
    console.log(`==================================================================\n`);
});
