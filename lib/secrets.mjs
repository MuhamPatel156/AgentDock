import {randomBytes, createCipheriv, createDecipheriv, scryptSync} from 'node:crypto';

const SALT = 'agentdock-project-secrets-salt-v1';

function deriveKey(masterPassword){
 return scryptSync(masterPassword, SALT, 32);
}

export function encryptSecret(plaintext, masterPassword){
 if(typeof plaintext !== 'string' || !plaintext) throw Error('Plaintext secret required.');
 const key = deriveKey(masterPassword);
 const iv = randomBytes(12);
 const cipher = createCipheriv('aes-256-gcm', key, iv);
 let encrypted = cipher.update(plaintext, 'utf8', 'hex');
 encrypted += cipher.final('hex');
 const tag = cipher.getAuthTag().toString('hex');
 return {
  ciphertext: encrypted,
  iv: iv.toString('hex'),
  tag
 };
}

export function decryptSecret(ciphertext, masterPassword, ivHex, tagHex){
 const key = deriveKey(masterPassword);
 const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
 decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
 let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
 decrypted += decipher.final('utf8');
 return decrypted;
}

export function maskSecret(value){
 if(!value || typeof value !== 'string') return '••••••••';
 if(value.length <= 4) return '••••' + value;
 return '••••••••' + value.slice(-4);
}
