import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Validates that the encryption key is in the correct format
 * @throws Error if key format is invalid
 */
export function validateEncryptionKey(key: string): void {
  if (!key) {
    throw new Error('Encryption key is required');
  }

  // Key should be 64 hex characters (32 bytes)
  if (key.length !== KEY_LENGTH * 2) {
    throw new Error(`Encryption key must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`);
  }

  // Validate hex format
  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error('Encryption key must be a valid hexadecimal string');
  }
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext - The string to encrypt
 * @param encryptionKey - Optional encryption key (defaults to config.encryption.key)
 * @returns Object containing encrypted data and IV
 */
export function encrypt(plaintext: string, encryptionKey?: string): { encrypted: string; iv: string } {
  const key = encryptionKey || config.encryption.key;
  validateEncryptionKey(key);

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Convert hex key to buffer
  const keyBuffer = Buffer.from(key, 'hex');

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine encrypted data and auth tag
  const encryptedWithTag = encrypted + authTag.toString('hex');

  return {
    encrypted: encryptedWithTag,
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 * @param encrypted - The encrypted string (includes auth tag)
 * @param iv - The initialization vector used during encryption
 * @param encryptionKey - Optional encryption key (defaults to config.encryption.key)
 * @returns The decrypted plaintext string
 */
export function decrypt(encrypted: string, iv: string, encryptionKey?: string): string {
  const key = encryptionKey || config.encryption.key;
  validateEncryptionKey(key);

  // Validate IV format
  if (!iv || !/^[0-9a-fA-F]+$/.test(iv)) {
    throw new Error(`IV must be ${IV_LENGTH * 2} hex characters (${IV_LENGTH} bytes)`);
  }

  if (iv.length !== IV_LENGTH * 2) {
    throw new Error(`IV must be ${IV_LENGTH * 2} hex characters (${IV_LENGTH} bytes)`);
  }

  // Validate encrypted data format
  if (!encrypted || !/^[0-9a-fA-F]+$/.test(encrypted)) {
    throw new Error('Encrypted data must be a valid hexadecimal string');
  }

  // Extract auth tag from encrypted data (last 16 bytes = 32 hex chars)
  const authTagLength = AUTH_TAG_LENGTH * 2;
  if (encrypted.length < authTagLength) {
    throw new Error('Encrypted data is too short to contain auth tag');
  }

  const encryptedData = encrypted.slice(0, -authTagLength);
  const authTag = encrypted.slice(-authTagLength);

  // Convert hex strings to buffers
  const keyBuffer = Buffer.from(key, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  // Decrypt the data
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypts credentials object for storage
 * @param credentials - The credentials object to encrypt
 * @param encryptionKey - Optional encryption key (defaults to config.encryption.key)
 * @returns Encrypted credentials with IV
 */
export function encryptCredentials(credentials: Record<string, any>, encryptionKey?: string): { encrypted: string; iv: string } {
  const plaintext = JSON.stringify(credentials);
  return encrypt(plaintext, encryptionKey);
}

/**
 * Decrypts credentials from storage
 * @param encrypted - The encrypted credentials string
 * @param iv - The initialization vector
 * @param encryptionKey - Optional encryption key (defaults to config.encryption.key)
 * @returns The decrypted credentials object
 */
export function decryptCredentials(encrypted: string, iv: string, encryptionKey?: string): Record<string, any> {
  const plaintext = decrypt(encrypted, iv, encryptionKey);
  return JSON.parse(plaintext);
}
