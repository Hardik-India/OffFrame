import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
console.log('DNS override applied')

import { MongoClient } from 'mongodb';
let pending;
export async function db() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_NOT_CONFIGURED');
  if (!pending) pending = connect().catch(e => { pending = undefined; throw e; });
  return pending;
}
async function connect() {
  const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
  await client.connect();
  const database = client.db(process.env.MONGODB_DB || 'offframe');
  await Promise.all([
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
    database.collection('eligibleEmails').createIndex({ email: 1 }, { unique: true }),
    database.collection('rateLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('submissions').createIndex({ final: 1, finalizedAt: -1 })
  ]);
  return database;
}
export async function settings(database) {
  return await database.collection('settings').findOne({ _id: 'event' }) || {
    opensAt: process.env.SUBMISSION_OPENS_AT || null,
    closesAt: process.env.SUBMISSION_CLOSES_AT || null,
    timezone: process.env.EVENT_TIMEZONE || 'Asia/Kolkata'
  };
}
