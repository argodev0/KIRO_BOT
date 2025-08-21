import { PrismaClient } from '@prisma/client';
import { EncryptionService, EncryptedData } from './EncryptionService';
import { logger } from '@/utils/logger';

export interface ApiKeyData {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  sandbox?: boolean;
}

export interface SecureUserData {
  userId: string;
  apiKeys: ApiKeyData[];
  encryptedAt: Date;
  lastAccessed: Date;
}

export class SecureStorageService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Store encrypted API keys for a user
   */
  async storeApiKeys(userId: string, apiKeys: ApiKeyData[]): Promise<void> {
    try {
      // Encrypt the API keys
      const encryptedData = EncryptionService.encryptApiKeys(
        apiKeys.reduce((acc, key) => ({
          ...acc,
          [`${key.exchange}_key`]: key.apiKey,
          [`${key.exchange}_secret`]: key.apiSecret,
          ...(key.passphrase && { [`${key.exchange}_passphrase`]: key.passphrase })
        }), {})
      );

      // Store in database
      await this.prisma.userApiKeys.upsert({
        where: { userId },
        update: {
          encryptedData: JSON.stringify(encryptedData),
          updatedAt: new Date(),
          lastAccessed: new Date()
        },
        create: {
          userId,
          encryptedData: JSON.stringify(encryptedData),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date()
        }
      });

      logger.info(`API keys stored securely for user ${userId}`);
    } catch (error) {
      logger.error('Failed to store API keys:', error);
      throw new Error('Failed to store API keys securely');
    }
  }

  /**
   * Retrieve and decrypt API keys for a user
   */
  async getApiKeys(userId: string): Promise<ApiKeyData[]> {
    try {
      const record = await this.prisma.userApiKeys.findUnique({
        where: { userId }
      });

      if (!record) {
        return [];
      }

      // Update last accessed time
      await this.prisma.userApiKeys.update({
        where: { userId },
        data: { lastAccessed: new Date() }
      });

      // Decrypt the data
      const encryptedData: EncryptedData = JSON.parse(record.encryptedData);
      const decryptedKeys = EncryptionService.decryptApiKeys(encryptedData);

      // Convert back to ApiKeyData format
      const apiKeys: ApiKeyData[] = [];
      const exchanges = new Set<string>();

      Object.keys(decryptedKeys).forEach(key => {
        const [exchange] = key.split('_');
        exchanges.add(exchange);
      });

      exchanges.forEach(exchange => {
        const apiKey = decryptedKeys[`${exchange}_key`];
        const apiSecret = decryptedKeys[`${exchange}_secret`];
        const passphrase = decryptedKeys[`${exchange}_passphrase`];

        if (apiKey && apiSecret) {
          apiKeys.push({
            exchange,
            apiKey,
            apiSecret,
            ...(passphrase && { passphrase })
          });
        }
      });

      return apiKeys;
    } catch (error) {
      logger.error('Failed to retrieve API keys:', error);
      throw new Error('Failed to retrieve API keys');
    }
  }

  /**
   * Delete API keys for a user
   */
  async deleteApiKeys(userId: string): Promise<void> {
    try {
      await this.prisma.userApiKeys.delete({
        where: { userId }
      });

      logger.info(`API keys deleted for user ${userId}`);
    } catch (error) {
      logger.error('Failed to delete API keys:', error);
      throw new Error('Failed to delete API keys');
    }
  }

  /**
   * Store encrypted user settings
   */
  async storeUserSettings(userId: string, settings: Record<string, any>): Promise<void> {
    try {
      const encryptedData = EncryptionService.encrypt(JSON.stringify(settings));

      await this.prisma.userSettings.upsert({
        where: { userId },
        update: {
          encryptedSettings: JSON.stringify(encryptedData),
          updatedAt: new Date()
        },
        create: {
          userId,
          encryptedSettings: JSON.stringify(encryptedData),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info(`Settings stored securely for user ${userId}`);
    } catch (error) {
      logger.error('Failed to store user settings:', error);
      throw new Error('Failed to store user settings securely');
    }
  }

  /**
   * Retrieve and decrypt user settings
   */
  async getUserSettings(userId: string): Promise<Record<string, any>> {
    try {
      const record = await this.prisma.userSettings.findUnique({
        where: { userId }
      });

      if (!record) {
        return {};
      }

      const encryptedData: EncryptedData = JSON.parse(record.encryptedSettings);
      const decryptedSettings = EncryptionService.decrypt(encryptedData);

      return JSON.parse(decryptedSettings);
    } catch (error) {
      logger.error('Failed to retrieve user settings:', error);
      throw new Error('Failed to retrieve user settings');
    }
  }

  /**
   * Rotate encryption keys (for key rotation procedures)
   */
  async rotateEncryptionKeys(userId: string): Promise<void> {
    try {
      // Get current data
      const apiKeys = await this.getApiKeys(userId);
      const settings = await this.getUserSettings(userId);

      // Re-encrypt with new key
      await this.storeApiKeys(userId, apiKeys);
      await this.storeUserSettings(userId, settings);

      logger.info(`Encryption keys rotated for user ${userId}`);
    } catch (error) {
      logger.error('Failed to rotate encryption keys:', error);
      throw new Error('Failed to rotate encryption keys');
    }
  }

  /**
   * Clean up old encrypted data
   */
  async cleanupOldData(daysOld: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Delete old API key records that haven't been accessed
      const deletedApiKeys = await this.prisma.userApiKeys.deleteMany({
        where: {
          lastAccessed: {
            lt: cutoffDate
          }
        }
      });

      // Delete old settings
      const deletedSettings = await this.prisma.userSettings.deleteMany({
        where: {
          updatedAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`Cleaned up ${deletedApiKeys.count} API key records and ${deletedSettings.count} settings records`);
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
      throw new Error('Failed to cleanup old encrypted data');
    }
  }
}