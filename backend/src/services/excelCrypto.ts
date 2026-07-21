import crypto from 'node:crypto';
import { getSecret } from './secretManager.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_SECRET_ID = process.env.EXCEL_ENCRYPTION_KEY_SECRET_ID || 'bridge-portal-excel-encryption-key';

function normalizeKey(rawKey: string) {
  const key = Buffer.from(rawKey, 'base64');
  if (key.length !== 32) {
    throw new Error('Excel encryption key must be a 32-byte base64 value for AES-256-GCM.');
  }
  return key;
}

export async function encryptExcelBuffer(plainBuffer: Buffer, keyVersion = 'latest') {
  const key = normalizeKey(await getSecret(KEY_SECRET_ID, keyVersion));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    metadata: {
      algorithm: ALGORITHM,
      keySecretId: KEY_SECRET_ID,
      keyVersion,
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    }
  };
}

export async function decryptExcelBuffer(encryptedBuffer: Buffer, metadata: {
  keyVersion: string;
  iv: string;
  tag: string;
}) {
  const key = normalizeKey(await getSecret(KEY_SECRET_ID, metadata.keyVersion));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(metadata.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(metadata.tag, 'base64'));
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}
