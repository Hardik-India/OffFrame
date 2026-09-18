import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { isAllowedOrigin } from './origin.mjs';
export class HttpError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
function key() { const secret = process.env.SESSION_SECRET; if (!secret || secret.length < 32) throw new Error('SESSION_SECRET_NOT_CONFIGURED'); return new TextEncoder().encode(secret); }
export async function issueSession(id, role) {
  const token = await new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime('12h').setIssuer('offframe').setAudience('offframe-web').sign(key());
  (await cookies()).set('offframe_session', token, { httpOnly: true, secure: process.env.APP_ORIGIN?.startsWith('https://') || process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 43200, path: '/' });
}
export async function clearSession() { (await cookies()).delete('offframe_session'); }
export async function session(database, role) {
  const token = (await cookies()).get('offframe_session')?.value;
  if (!token) throw new HttpError(401, 'Please sign in to continue.');
  let claims;
  try { claims = (await jwtVerify(token, key(), { issuer: 'offframe', audience: 'offframe-web', algorithms: ['HS256'] })).payload; }
  catch { throw new HttpError(401, 'Your session has expired. Please sign in again.'); }
  if (role && claims.role !== role) throw new HttpError(403, 'You do not have access to this action.');
  if (claims.role === 'admin') return { role: 'admin', id: 'admin' };
  if (claims.role !== 'student' || !ObjectId.isValid(claims.sub)) throw new HttpError(401, 'Please sign in again.');
  const user = await database.collection('users').findOne({ _id: new ObjectId(claims.sub) });
  if (!user) throw new HttpError(401, 'Please register to continue.');
  return { role: 'student', id: String(user._id), user };
}
export function sameSecret(a, b) { return timingSafeEqual(createHash('sha256').update(String(a || '')).digest(), createHash('sha256').update(String(b || '')).digest()); }
export function checkOrigin(request) {
  if (!isAllowedOrigin(request, { appOrigin: process.env.APP_ORIGIN || '', production: process.env.NODE_ENV === 'production' })) {
    throw new HttpError(403, 'This request must come from the OffFrame website.');
  }
}
export async function rateLimit(database, scope, identifier, max = 12) {
  const bucket = Math.floor(Date.now() / 900000);
  const hash = createHash('sha256').update(identifier).digest('hex');
  const doc = await database.collection('rateLimits').findOneAndUpdate({ _id: `${scope}:${hash}:${bucket}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * 900000) } }, { upsert: true, returnDocument: 'after' });
  if (doc.count > max) throw new HttpError(429, 'Too many attempts. Please try again in 15 minutes.');
}
