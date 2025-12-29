import { describe, test, expect, beforeAll } from 'bun:test';
import * as fc from 'fast-check';
import { encrypt, decrypt, validateEncryptionKey, encryptCredentials, decryptCredentials } from './encryption';

// Test encryption key (32 bytes = 64 hex characters)
const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Encryption Utility', () => {
  beforeAll(() => {
    // Set test encryption key in environment
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  describe('validateEncryptionKey', () => {
    test('should accept valid 64-character hex key', () => {
      expect(() => validateEncryptionKey(TEST_KEY)).not.toThrow();
    });

    test('should reject empty key', () => {
      expect(() => validateEncryptionKey('')).toThrow('Encryption key is required');
    });

    test('should reject key with wrong length', () => {
      expect(() => validateEncryptionKey('abc123')).toThrow('Encryption key must be 64 hex characters');
    });

    test('should reject non-hex characters', () => {
      const invalidKey = 'g123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(() => validateEncryptionKey(invalidKey)).toThrow('valid hexadecimal string');
    });

    test('should accept uppercase hex characters', () => {
      const upperKey = '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF';
      expect(() => validateEncryptionKey(upperKey)).not.toThrow();
    });
  });

  describe('encrypt and decrypt', () => {
    test('should encrypt and decrypt a simple string', () => {
      const plaintext = 'Hello, World!';
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);

      expect(encrypted).toBeDefined();
      expect(iv).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
      expect(iv.length).toBe(32); // 16 bytes = 32 hex chars

      const decrypted = decrypt(encrypted, iv, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    test('should produce different encrypted values for same plaintext', () => {
      const plaintext = 'test data';
      const result1 = encrypt(plaintext, TEST_KEY);
      const result2 = encrypt(plaintext, TEST_KEY);

      // Different IVs should produce different encrypted values
      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encrypted).not.toBe(result2.encrypted);

      // But both should decrypt to same plaintext
      expect(decrypt(result1.encrypted, result1.iv, TEST_KEY)).toBe(plaintext);
      expect(decrypt(result2.encrypted, result2.iv, TEST_KEY)).toBe(plaintext);
    });

    test('should handle empty string', () => {
      const plaintext = '';
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, iv, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    test('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, iv, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    test('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, iv, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    test('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, iv, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    test('should fail with wrong IV', () => {
      const plaintext = 'secret data';
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);
      const wrongIv = '00000000000000000000000000000000';

      expect(() => decrypt(encrypted, wrongIv, TEST_KEY)).toThrow();
    });

    test('should fail with wrong key', () => {
      const plaintext = 'secret data';
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);
      const wrongKey = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      expect(() => decrypt(encrypted, iv, wrongKey)).toThrow();
    });

    test('should fail with tampered encrypted data', () => {
      const plaintext = 'secret data';
      const { encrypted, iv } = encrypt(plaintext, TEST_KEY);
      
      // Tamper with encrypted data
      const tampered = 'ff' + encrypted.slice(2);

      expect(() => decrypt(tampered, iv, TEST_KEY)).toThrow();
    });

    test('should fail with invalid IV format', () => {
      const { encrypted } = encrypt('test', TEST_KEY);
      
      expect(() => decrypt(encrypted, '123', TEST_KEY)).toThrow('IV must be 32 hex characters');
      expect(() => decrypt(encrypted, 'invalid', TEST_KEY)).toThrow('IV must be 32 hex characters');
    });

    test('should fail with invalid encrypted data format', () => {
      const validIv = '0123456789abcdef0123456789abcdef';
      
      expect(() => decrypt('invalid', validIv, TEST_KEY)).toThrow('valid hexadecimal string');
      expect(() => decrypt('abc', validIv, TEST_KEY)).toThrow('too short');
    });
  });

  describe('encryptCredentials and decryptCredentials', () => {
    test('should encrypt and decrypt credentials object', () => {
      const credentials = {
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        storeUrl: 'https://example.com',
      };

      const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);
      const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

      expect(decrypted).toEqual(credentials);
    });

    test('should handle nested objects', () => {
      const credentials = {
        woocommerce: {
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        },
        shopify: {
          accessToken: 'shpat_test',
          shopDomain: 'test.myshopify.com',
        },
      };

      const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);
      const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

      expect(decrypted).toEqual(credentials);
    });

    test('should handle arrays in credentials', () => {
      const credentials = {
        apiKeys: ['key1', 'key2', 'key3'],
        permissions: ['read', 'write'],
      };

      const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);
      const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

      expect(decrypted).toEqual(credentials);
    });

    test('should handle empty object', () => {
      const credentials = {};

      const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);
      const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

      expect(decrypted).toEqual(credentials);
    });

    test('should preserve data types', () => {
      const credentials = {
        apiKey: 'test',
        port: 443,
        enabled: true,
        timeout: null,
        metadata: undefined,
      };

      const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);
      const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

      expect(decrypted.apiKey).toBe('test');
      expect(decrypted.port).toBe(443);
      expect(decrypted.enabled).toBe(true);
      expect(decrypted.timeout).toBe(null);
      expect(decrypted.metadata).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    test('should handle JSON with special characters', () => {
      const credentials = {
        password: 'p@ssw0rd!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
        description: 'Line 1\nLine 2\tTabbed',
      };

      const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);
      const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

      expect(decrypted).toEqual(credentials);
    });

    test('should handle very large credential objects', () => {
      const credentials: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        credentials[`key${i}`] = `value${i}`.repeat(100);
      }

      const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);
      const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

      expect(decrypted).toEqual(credentials);
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: price-sync-dashboard, Property 17: Credential encryption
    // Validates: Requirements 8.3, 9.3, 10.3
    test('Property 17: For any stored API credentials, encrypted data should be decryptable back to original credentials', () => {
      // Generator for realistic credential objects
      const credentialsArbitrary = fc.record({
        apiKey: fc.string({ minLength: 5, maxLength: 100 }),
        apiSecret: fc.string({ minLength: 5, maxLength: 100 }),
        storeUrl: fc.webUrl(),
        consumerKey: fc.option(fc.string({ minLength: 5, maxLength: 50 })),
        consumerSecret: fc.option(fc.string({ minLength: 5, maxLength: 50 })),
        accessToken: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
        shopDomain: fc.option(fc.domain()),
        port: fc.option(fc.integer({ min: 1, max: 65535 })),
        enabled: fc.option(fc.boolean()),
      });

      fc.assert(
        fc.property(credentialsArbitrary, (credentials) => {
          // Encrypt the credentials
          const { encrypted, iv } = encryptCredentials(credentials, TEST_KEY);

          // Verify encrypted data is hex format (not plaintext)
          expect(/^[0-9a-fA-F]+$/.test(encrypted)).toBe(true);
          expect(/^[0-9a-fA-F]+$/.test(iv)).toBe(true);

          // Verify encrypted data is not the same as plaintext JSON
          const credentialsJson = JSON.stringify(credentials);
          expect(encrypted).not.toBe(credentialsJson);
          
          // Verify encrypted data length is different from plaintext
          // (encrypted data includes auth tag and is hex-encoded)
          expect(encrypted.length).not.toBe(credentialsJson.length);

          // Decrypt and verify round-trip - this is the core property
          const decrypted = decryptCredentials(encrypted, iv, TEST_KEY);

          // Verify all fields match exactly
          expect(decrypted).toEqual(credentials);
        }),
        { numRuns: 100 }
      );
    });

    // Additional property test for string encryption round-trip
    test('Property 17 (strings): For any string, encrypted data should be decryptable back to original', () => {
      const stringArbitrary = fc.string({ minLength: 0, maxLength: 1000 });

      fc.assert(
        fc.property(stringArbitrary, (plaintext) => {
          // Encrypt the string
          const { encrypted, iv } = encrypt(plaintext, TEST_KEY);

          // Verify encrypted data is hex format
          expect(/^[0-9a-fA-F]+$/.test(encrypted)).toBe(true);
          expect(/^[0-9a-fA-F]+$/.test(iv)).toBe(true);

          // Verify IV is correct length (16 bytes = 32 hex chars)
          expect(iv.length).toBe(32);

          // Verify encrypted data is not identical to plaintext
          expect(encrypted).not.toBe(plaintext);

          // Decrypt and verify round-trip - this is the core property
          const decrypted = decrypt(encrypted, iv, TEST_KEY);
          expect(decrypted).toBe(plaintext);
        }),
        { numRuns: 100 }
      );
    });
  });
});
