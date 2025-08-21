#!/usr/bin/env node

/**
 * Secrets Management Utility
 * Handles encryption, decryption, and secure storage of sensitive configuration
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class SecretsManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
  }

  /**
   * Generate a secure encryption key
   */
  generateKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * Encrypt a value using AES-256-GCM
   */
  encrypt(text, key) {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, keyBuffer);
      cipher.setAAD(Buffer.from('trading-bot-secrets'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  decrypt(encryptedData, key) {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = crypto.createDecipher(this.algorithm, keyBuffer);
      decipher.setAAD(Buffer.from('trading-bot-secrets'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt environment file
   */
  async encryptEnvFile(inputFile, outputFile, key) {
    try {
      const content = fs.readFileSync(inputFile, 'utf8');
      const lines = content.split('\n');
      const encryptedLines = [];

      for (const line of lines) {
        if (line.trim() && !line.startsWith('#') && line.includes('=')) {
          const [envKey, ...valueParts] = line.split('=');
          const value = valueParts.join('=');
          
          // Only encrypt sensitive values
          if (this.isSensitiveKey(envKey.trim())) {
            const encrypted = this.encrypt(value, key);
            encryptedLines.push(`${envKey}=ENC[${JSON.stringify(encrypted)}]`);
          } else {
            encryptedLines.push(line);
          }
        } else {
          encryptedLines.push(line);
        }
      }

      fs.writeFileSync(outputFile, encryptedLines.join('\n'));
      console.log(`✅ Environment file encrypted: ${outputFile}`);
    } catch (error) {
      throw new Error(`Failed to encrypt environment file: ${error.message}`);
    }
  }

  /**
   * Decrypt environment file
   */
  async decryptEnvFile(inputFile, outputFile, key) {
    try {
      const content = fs.readFileSync(inputFile, 'utf8');
      const lines = content.split('\n');
      const decryptedLines = [];

      for (const line of lines) {
        if (line.includes('ENC[') && line.includes(']')) {
          const [envKey, encryptedPart] = line.split('=ENC[');
          const encryptedData = JSON.parse(encryptedPart.slice(0, -1));
          const decrypted = this.decrypt(encryptedData, key);
          decryptedLines.push(`${envKey}=${decrypted}`);
        } else {
          decryptedLines.push(line);
        }
      }

      fs.writeFileSync(outputFile, decryptedLines.join('\n'));
      console.log(`✅ Environment file decrypted: ${outputFile}`);
    } catch (error) {
      throw new Error(`Failed to decrypt environment file: ${error.message}`);
    }
  }

  /**
   * Check if environment key contains sensitive data
   */
  isSensitiveKey(key) {
    const sensitivePatterns = [
      'PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'PASS', 'PRIVATE',
      'CREDENTIAL', 'AUTH', 'API_KEY', 'WEBHOOK', 'SID'
    ];
    
    return sensitivePatterns.some(pattern => 
      key.toUpperCase().includes(pattern)
    );
  }

  /**
   * Generate secure configuration for production
   */
  generateProductionSecrets() {
    const secrets = {
      ENCRYPTION_KEY: this.generateKey(),
      JWT_SECRET: crypto.randomBytes(64).toString('hex'),
      DATABASE_PASSWORD: this.generatePassword(32),
      REDIS_PASSWORD: this.generatePassword(24),
      RABBITMQ_PASSWORD: this.generatePassword(24),
      BACKUP_ENCRYPTION_KEY: this.generateKey(),
      SESSION_SECRET: crypto.randomBytes(32).toString('hex')
    };

    return secrets;
  }

  /**
   * Generate secure password
   */
  generatePassword(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment(envFile) {
    const content = fs.readFileSync(envFile, 'utf8');
    const lines = content.split('\n');
    const errors = [];
    const warnings = [];

    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        
        // Check for placeholder values
        if (value.includes('your_') || value.includes('CHANGE_ME') || value.includes('example')) {
          errors.push(`❌ Placeholder value detected for ${key}`);
        }
        
        // Check for weak passwords
        if (this.isSensitiveKey(key) && value.length < 16) {
          warnings.push(`⚠️  Weak value for ${key} (less than 16 characters)`);
        }
        
        // Check for unencrypted sensitive data in production
        if (this.isSensitiveKey(key) && !value.startsWith('ENC[')) {
          warnings.push(`⚠️  Unencrypted sensitive value for ${key}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Create secure backup of secrets
   */
  async backupSecrets(secretsFile, backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `secrets-backup-${timestamp}.enc`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const content = fs.readFileSync(secretsFile, 'utf8');
    const backupKey = this.generateKey();
    const encrypted = this.encrypt(content, backupKey);
    
    fs.writeFileSync(backupFile, JSON.stringify(encrypted));
    fs.writeFileSync(`${backupFile}.key`, backupKey);
    
    console.log(`✅ Secrets backed up to: ${backupFile}`);
    console.log(`🔑 Backup key saved to: ${backupFile}.key`);
    
    return { backupFile, keyFile: `${backupFile}.key` };
  }
}

// CLI Interface
async function main() {
  const secretsManager = new SecretsManager();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'generate-key':
        console.log('Generated encryption key:', secretsManager.generateKey());
        break;

      case 'generate-secrets':
        const secrets = secretsManager.generateProductionSecrets();
        console.log('Generated production secrets:');
        console.log(JSON.stringify(secrets, null, 2));
        break;

      case 'encrypt':
        if (args.length < 4) {
          console.error('Usage: encrypt <input-file> <output-file> <key>');
          process.exit(1);
        }
        await secretsManager.encryptEnvFile(args[1], args[2], args[3]);
        break;

      case 'decrypt':
        if (args.length < 4) {
          console.error('Usage: decrypt <input-file> <output-file> <key>');
          process.exit(1);
        }
        await secretsManager.decryptEnvFile(args[1], args[2], args[3]);
        break;

      case 'validate':
        if (args.length < 2) {
          console.error('Usage: validate <env-file>');
          process.exit(1);
        }
        const validation = secretsManager.validateEnvironment(args[1]);
        
        if (validation.errors.length > 0) {
          console.log('❌ Validation Errors:');
          validation.errors.forEach(error => console.log(error));
        }
        
        if (validation.warnings.length > 0) {
          console.log('⚠️  Validation Warnings:');
          validation.warnings.forEach(warning => console.log(warning));
        }
        
        if (validation.errors.length === 0 && validation.warnings.length === 0) {
          console.log('✅ Environment configuration is valid');
        }
        break;

      case 'backup':
        if (args.length < 3) {
          console.error('Usage: backup <secrets-file> <backup-dir>');
          process.exit(1);
        }
        await secretsManager.backupSecrets(args[1], args[2]);
        break;

      case 'interactive':
        await interactiveSetup(secretsManager);
        break;

      default:
        console.log(`
Secrets Management Utility

Usage: node secrets-management.js <command> [options]

Commands:
  generate-key                           Generate a new encryption key
  generate-secrets                       Generate all production secrets
  encrypt <input> <output> <key>         Encrypt environment file
  decrypt <input> <output> <key>         Decrypt environment file
  validate <env-file>                    Validate environment configuration
  backup <secrets-file> <backup-dir>     Create encrypted backup of secrets
  interactive                            Interactive setup wizard

Examples:
  node secrets-management.js generate-key
  node secrets-management.js encrypt .env.production .env.production.enc <key>
  node secrets-management.js validate .env.production
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function interactiveSetup(secretsManager) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('🔐 Interactive Secrets Setup for Production\n');

  try {
    const setupType = await question('Setup type (1: New deployment, 2: Update existing): ');
    
    if (setupType === '1') {
      console.log('\n📝 Generating new production secrets...');
      const secrets = secretsManager.generateProductionSecrets();
      
      const outputFile = await question('Output file path (.env.production): ') || '.env.production';
      
      // Create environment file with generated secrets
      const envContent = Object.entries(secrets)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      fs.writeFileSync(outputFile, envContent);
      console.log(`✅ Secrets written to: ${outputFile}`);
      
      const shouldEncrypt = await question('Encrypt the file? (y/N): ');
      if (shouldEncrypt.toLowerCase() === 'y') {
        const encKey = secretsManager.generateKey();
        await secretsManager.encryptEnvFile(outputFile, `${outputFile}.enc`, encKey);
        console.log(`🔑 Encryption key: ${encKey}`);
        console.log('⚠️  Store this key securely - you\'ll need it to decrypt the file!');
      }
    } else if (setupType === '2') {
      const inputFile = await question('Path to existing environment file: ');
      const validation = secretsManager.validateEnvironment(inputFile);
      
      console.log('\n📊 Validation Results:');
      validation.errors.forEach(error => console.log(error));
      validation.warnings.forEach(warning => console.log(warning));
      
      if (validation.errors.length === 0) {
        const shouldBackup = await question('Create backup? (Y/n): ');
        if (shouldBackup.toLowerCase() !== 'n') {
          await secretsManager.backupSecrets(inputFile, './backups');
        }
      }
    }
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = SecretsManager;