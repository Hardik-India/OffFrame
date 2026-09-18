const fs = require('fs');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/^MONGODB_URI=(.+)$/m);
const uri = match[1].trim().replace(/^["']|["']$/g, '');

require('mongodb').MongoClient.connect(uri, { serverSelectionTimeoutMS: 8000 })
  .then(() => { console.log('OK'); process.exit(0); })
  .catch(e => {
    console.log('NAME:', e.name);
    console.log('CODE:', e.code);
    console.log('MESSAGE:', e.message);
    if (e.cause) console.log('CAUSE:', e.cause.message || e.cause);
    process.exit(1);
  });