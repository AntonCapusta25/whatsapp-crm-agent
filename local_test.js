const { Client, LocalAuth } = require('whatsapp-web.js');

console.log('Initializing WhatsApp client locally for test message...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'tenant-default',
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED - Your local session expired. Please scan it to link again, or run this on the VPS.');
    require('qrcode-terminal').generate(qr, {small: true});
});

client.on('ready', async () => {
    console.log('✅ Local Client is READY! Sending test message...');
    const message = `Hey, this is Oleksandr from Homemade.

We just updated our new marketing system for chefs and we’re testing it first with a small group of our most active chefs.

The system can help you create marketing creatives, captions, engaging posts, storytelling content, and even upload videos directly to your Instagram. The goal is to make your marketing easier and help you attract more customers with less effort.

Could you please test it here and let us know how it goes?

https://marketing.homemadechefs.com

Your feedback will really help us improve it and make it more useful for you. Also, if you have any questions, even very small ones, just message me or call me anytime and I’ll help you.

Thanks, and please let me know once you’ve tried it.`;

    try {
        await client.sendMessage('31687196711@c.us', message);
        console.log('🚀 Test message sent successfully to +31687196711!');
        setTimeout(() => process.exit(0), 3000);
    } catch (e) {
        console.error('❌ Failed to send message:', e);
        process.exit(1);
    }
});

client.on('auth_failure', msg => {
    console.error('Authentication failure', msg);
    process.exit(1);
});

client.initialize();
