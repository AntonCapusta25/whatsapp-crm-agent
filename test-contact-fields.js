const { Client, LocalAuth } = require('whatsapp-web.js');
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'tenant-default', dataPath: './.wwebjs_auth' }),
    puppeteer: { headless: true }
});
client.on('ready', async () => {
    const chats = await client.getChats();
    for (const chat of chats) {
        if (chat.id._serialized.endsWith('@lid')) {
            const contact = await chat.getContact();
            console.log('LID Contact keys:', Object.keys(contact));
            console.log('LID Contact id:', contact.id);
            console.log('LID Contact number:', contact.number);
            break; // just check one
        }
    }
    process.exit(0);
});
client.initialize();
