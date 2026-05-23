const { Client, LocalAuth } = require('whatsapp-web.js');
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'tenant-tia', dataPath: './.wwebjs_auth' }),
    puppeteer: { headless: true }
});
client.on('ready', async () => {
    const chat = await client.getChatById('173865191919686@lid');
    console.log('Chat:', chat.id, chat.name);
    const contact = await chat.getContact();
    console.log('Contact number:', contact.number, 'id:', contact.id);
    process.exit(0);
});
client.initialize();
