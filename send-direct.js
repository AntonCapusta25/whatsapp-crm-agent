const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Parse command line arguments
const args = process.argv.slice(2);
const phoneArg = args[0];
const messageText = args[1] || 'Hello! This is a test message from your WhatsApp automation script. It works! 🚀';

if (!phoneArg) {
    console.error('❌ Error: Recipient phone number is required.');
    console.log('\nUsage:');
    console.log('  node send-direct.js <phone_number> "[message_text]"');
    console.log('Example:');
    console.log('  node send-direct.js 31687196711 "Hello there!"\n');
    process.exit(1);
}

// Sanitize phone number to digit-only format
const phone = String(phoneArg).replace(/\D/g, '');

console.log(`Starting WhatsApp Web client...`);
console.log(`Target Phone: ${phone}`);
console.log(`Message Content: "${messageText}"\n`);

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('------------------------------------------------------------------');
    console.log('🤖 SCAN THIS QR CODE WITH YOUR WHATSAPP APP TO LOG IN:');
    console.log('------------------------------------------------------------------');
    qrcode.generate(qr, { small: true });
    console.log('------------------------------------------------------------------');
});

client.on('authenticated', () => {
    console.log('✅ Authenticated successfully!');
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Syncing/Loading Chats: ${percent}% - ${message}`);
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failure:', msg);
    process.exit(1);
});

client.on('ready', async () => {
    console.log('🚀 Client is ready.');
    
    try {
        console.log(`[Test] Checking if number is registered on WhatsApp: ${phone}...`);
        let numberDetails = null;
        try {
            numberDetails = await client.getNumberId(phone);
        } catch (e) {
            console.warn(`⚠️ Warning: getNumberId check failed: ${e.message}`);
        }
        
        let chatId;
        if (numberDetails) {
            chatId = numberDetails._serialized;
            console.log(`[Test] Resolved number JID via getNumberId: ${chatId}`);
        } else {
            chatId = `${phone}@c.us`;
            console.log(`[Test] getNumberId could not resolve. Using direct fallback JID: ${chatId}`);
        }

        console.log(`[Test] Sending message to ${chatId}...`);
        await client.sendMessage(chatId, messageText);
        console.log('🎉 Message sent successfully!');
        
        // Wait a few seconds to let the message deliver before shutting down
        console.log('Waiting 5 seconds to ensure delivery...');
        setTimeout(async () => {
            console.log('Shutting down client...');
            await client.destroy();
            console.log('Done!');
            process.exit(0);
        }, 5000);
        
    } catch (err) {
        console.error('❌ Error sending message:', err);
        await client.destroy();
        process.exit(1);
    }
});

client.initialize();
