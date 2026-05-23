require('dotenv').config();
const http = require('http');

// Get command line arguments
const args = process.argv.slice(2);
const phoneArg = args[0];
const nameArg = args[1] || 'Alex';
const templateArg = args[2] || 'welcome';

if (!phoneArg) {
    console.error('❌ Error: Phone number is required.');
    console.log('\nUsage:');
    console.log('  node test-webhook.js <phone_number> [name] [template]');
    console.log('Example:');
    console.log('  node test-webhook.js 1234567890 "John Doe" welcome\n');
    process.exit(1);
}

const PORT = process.env.PORT || 3000;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || 'supabase_secret_token_12345';

// Define different mock payload formats to test compatibility
// Format 1: Direct flat payload
const directPayload = JSON.stringify({
    phone: phoneArg,
    name: nameArg,
    template: templateArg,
    variables: {
        custom_var: 'extra details'
    }
});

// Format 2: Supabase Webhook style payload
const supabasePayload = JSON.stringify({
    type: 'INSERT',
    table: 'profiles',
    schema: 'public',
    record: {
        id: 'mock-uuid-12345',
        phone: phoneArg,
        first_name: nameArg,
        created_at: new Date().toISOString()
    },
    template: templateArg
});

// Let's alternate or use Supabase format by default to simulate Supabase
const payload = supabasePayload;

const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/webhook',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WEBHOOK_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log(`📡 Sending test webhook request to http://localhost:${PORT}/webhook...`);
console.log(`📦 Payload:\n${JSON.stringify(JSON.parse(payload), null, 2)}\n`);

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`🔌 Server Response Code: ${res.statusCode}`);
        try {
            const parsed = JSON.parse(data);
            console.log('🎉 Response Data:', JSON.stringify(parsed, null, 2));
            if (res.statusCode === 202) {
                console.log('\n✅ Success! Webhook accepted. Watch your server terminal to monitor the queue & typing status.');
            } else {
                console.log('\n❌ Failed to trigger webhook.');
            }
        } catch (e) {
            console.log('Response Body:', data);
        }
    });
});

req.on('error', (error) => {
    console.error(`❌ HTTP request error: ${error.message}`);
    console.log('Make sure your server is running with "npm start" or "node index.js" first.');
});

req.write(payload);
req.end();
