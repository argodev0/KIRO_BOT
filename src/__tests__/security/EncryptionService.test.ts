import { EncryptionService } from '@/services/EncryptionService';

// Mock environment variable for testing
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('EncryptionService', () => {
  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex key', () => {
      const key = EncryptionService.generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = EncryptionService.generateEncryptionKey();
      const key2 = EncryptionService.generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive data';
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.encryptedData).not.toBe(plaintext);
      expect(encrypted.iv).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should produce different encrypted data for same input', () => {
      const plaintext = 'test data';
      const encrypted1 = EncryptionService.encrypt(plaintext);
      const encrypted2 = EncryptionService.encrypt(plaintext);

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '🔐 Unicode test: αβγδε 中文 العربية';
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error with invalid encrypted data', () => {
      const invalidData = {
        encryptedData: 'invalid',
        iv: 'invalid',
        tag: 'invalid'
      };

      expect(() => EncryptionService.decrypt(invalidData)).toThrow();
    });

    it('should throw error with tampered data', () => {
      const plaintext = 'test data';
      const encrypted = EncryptionService.encrypt(plaintext);
      
      // Tamper with encrypted data
      encrypted.encryptedData = encrypted.encryptedData.slice(0, -2) + '00';

      expect(() => EncryptionService.decrypt(encrypted)).toThrow();
    });
  });

  describe('hash and verifyHash', () => {
    it('should hash and verify data correctly', () => {
      const data = 'password123';
      const { hash, salt } = EncryptionService.hash(data);
      
      expect(hash).toHaveLength(128); // 64 bytes = 128 hex chars
      expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(EncryptionService.verifyHash(data, hash, salt)).toBe(true);
    });

    it('should produce different hashes for same input', () => {
      const data = 'password123';
      const result1 = EncryptionService.hash(data);
      const result2 = EncryptionService.hash(data);

      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should verify hash with provided salt', () => {
      const data = 'password123';
      const salt = 'fixed_salt_for_testing';
      const { hash } = EncryptionService.hash(data, salt);
      
      expect(EncryptionService.verifyHash(data, hash, salt)).toBe(true);
      expect(EncryptionService.verifyHash('wrong_password', hash, salt)).toBe(false);
    });

    it('should be resistant to timing attacks', () => {
      const data = 'password123';
      const { hash, salt } = EncryptionService.hash(data);
      
      const start1 = process.hrtime.bigint();
      EncryptionService.verifyHash(data, hash, salt);
      const time1 = process.hrtime.bigint() - start1;
      
      const start2 = process.hrtime.bigint();
      EncryptionService.verifyHash('wrong_password', hash, salt);
      const time2 = process.hrtime.bigint() - start2;
      
      // Times should be similar (within 50% difference)
      const ratio = Number(time1) / Number(time2);
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate tokens of correct length', () => {
      const token = EncryptionService.generateSecureToken(32);
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = EncryptionService.generateSecureToken();
      const token2 = EncryptionService.generateSecureToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate cryptographically secure tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 1000; i++) {
        tokens.add(EncryptionService.generateSecureToken());
      }
      expect(tokens.size).toBe(1000); // All tokens should be unique
    });
  });

  describe('API key encryption', () => {
    it('should encrypt and decrypt API keys', () => {
      const apiKey = 'test_api_key_12345';
      const encrypted = EncryptionService.encryptApiKey(apiKey);
      const decrypted = EncryptionService.decryptApiKey(encrypted);

      expect(decrypted).toBe(apiKey);
    });

    it('should encrypt and decrypt multiple API keys', () => {
      const apiKeys = {
        binance_key: 'binance_api_key_123',
        binance_secret: 'binance_secret_456',
        kucoin_key: 'kucoin_api_key_789',
        kucoin_secret: 'kucoin_secret_012'
      };

      const encrypted = EncryptionService.encryptApiKeys(apiKeys);
      const decrypted = EncryptionService.decryptApiKeys(encrypted);

      expect(decrypted).toEqual(apiKeys);
    });
  });

  describe('error handling', () => {
    it('should throw error when encryption key is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => EncryptionService.encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should throw error when encryption key is wrong length', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'short_key';

      expect(() => EncryptionService.encrypt('test')).toThrow('ENCRYPTION_KEY must be 64 hex characters');

      process.env.ENCRYPTION_KEY = originalKey;
    });
  });
});