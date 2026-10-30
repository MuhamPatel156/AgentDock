import {randomBytes, createHash, timingSafeEqual, scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';

const scrypt = promisify(scryptCallback);

export class RateLimiter {
 constructor({maxAttempts = 10, windowMs = 60000} = {}) {
  this.maxAttempts = maxAttempts;
  this.windowMs = windowMs;
  this.records = new Map();
 }

 check(key) {
  const now = Date.now();
  let record = this.records.get(key);
  if (!record || now - record.since > this.windowMs) {
   record = {since: now, count: 0};
   this.records.set(key, record);
  }
  record.count++;
  if (record.count > this.maxAttempts) {
   return {
    allowed: false,
    retryAfter: Math.ceil((record.since + this.windowMs - now) / 1000)
   };
  }
  return {allowed: true, remaining: this.maxAttempts - record.count};
 }

 reset(key) {
  this.records.delete(key);
 }

 sweep() {
  const now = Date.now();
  for (const [key, record] of this.records.entries()) {
   if (now - record.since > this.windowMs) {
    this.records.delete(key);
   }
  }
 }
}

export function generateRecoveryKey() {
 const raw = randomBytes(16).toString('hex').toUpperCase();
 return `AD-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export async function hashRecoveryKey(recoveryKey) {
 const clean = String(recoveryKey).trim().toUpperCase();
 const salt = randomBytes(16).toString('hex');
 const derived = await scrypt(clean, salt, 64);
 return `${salt}:${derived.toString('hex')}`;
}

export async function verifyRecoveryKey(candidate, storedHash) {
 if (!candidate || !storedHash || typeof candidate !== 'string' || typeof storedHash !== 'string') return false;
 const clean = candidate.trim().toUpperCase();
 const [salt, hashStr] = storedHash.split(':');
 if (!salt || !hashStr) return false;
 const actual = await scrypt(clean, salt, 64);
 return timingSafeEqual(actual, Buffer.from(hashStr, 'hex'));
}

export function securityHeaders({isHttps = false, isPreview = false} = {}) {
 const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
 };
 if (isHttps) {
  headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
 }
 if (!isPreview) {
  headers['X-Frame-Options'] = 'DENY';
 }
 return headers;
}
