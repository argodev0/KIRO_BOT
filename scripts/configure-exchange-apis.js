#!/usr/bin/env node

/**
 * Exchange API Configuration Script
 * 
 * This script helps users securely configure read-only exchange API keys
 * for paper trading with live market data.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ExchangeAPIConfigurator {
    constructor() {
        this.envFile = path.join(__dirname, '..', '.env.production');
        this.config = {};
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * Main configuration process
     */
    async configure() {
        console.log('🔑 Exchange API Configuration');
        console.log('=============================');
        console.log('');
        console.log('⚠️  CRITICAL SAFETY NOTICE:');
        console.log('   - Only use READ-ONLY API keys');
        console.log('   - Never use API keys with trading permissions');
        console.log('   - This system is for PAPER TRADING ONLY');
        console.log('   - Real trading is blocked at multiple levels');
        console.log('');

        try {
            // Load current configuration
            await this.loadConfiguration();
            
            // Configure exchanges
            await this.configureBinance();
            await this.configureKuCoin();
            
            // Save configuration
            await this.saveConfiguration();
            
            // Validate configuration
            await this.validateConfiguration();
            
            console.log('\n✅ Exchange API configuration completed successfully!');
            console.log('\n🔒 REMINDER: This system enforces paper trading mode.');
            console.log('   All trades are simulated - no real money is at risk.');
            
        } catch (error) {
            console.error('\n❌ Configuration failed:', error.message);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    /**
     * Load current configuration
     */
    async loadConfiguration() {
        console.log('\n📖 Loading current configuration...');
        
        if (!fs.existsSync(this.envFile)) {
            throw new Error(`Production environment file not found: ${this.envFile}`);
        }
        
        const envContent = fs.readFileSync(this.envFile, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    this.config[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
        
        console.log('✅ Configuration loaded');
    }

    /**
     * Configure Binance API
     */
    async configureBinance() {
        console.log('\n🟡 Binance API Configuration');
        console.log('============================');
        console.log('');
        console.log('To get READ-ONLY Binance API keys:');
        console.log('1. Go to https://www.binance.com/en/my/settings/api-management');
        console.log('2. Create a new API key');
        console.log('3. IMPORTANT: Only enable "Enable Reading" permission');
        console.log('4. DO NOT enable "Enable Spot & Margin Trading"');
        console.log('5. DO NOT enable "Enable Futures"');
        console.log('');

        const configureBinance = await this.askQuestion('Do you want to configure Binance API? (y/N): ');
        
        if (configureBinance.toLowerCase() === 'y' || configureBinance.toLowerCase() === 'yes') {
            const apiKey = await this.askQuestion('Enter Binance API Key (READ-ONLY): ');
            const apiSecret = await this.askQuestion('Enter Binance API Secret: ');
            
            if (apiKey && apiSecret) {
                // Validate API key format
                if (apiKey.length < 20 || apiSecret.length < 20) {
                    console.log('⚠️  Warning: API key or secret seems too short. Please verify.');
                }
                
                this.config.BINANCE_API_KEY = apiKey.trim();
                this.config.BINANCE_API_SECRET = apiSecret.trim();
                
                console.log('✅ Binance API configured');
                console.log('⚠️  Remember: This API key will only be used for reading market data');
            } else {
                console.log('ℹ️  Binance API configuration skipped');
            }
        } else {
            console.log('ℹ️  Binance API configuration skipped');
        }
    }

    /**
     * Configure KuCoin API
     */
    async configureKuCoin() {
        console.log('\n🟢 KuCoin API Configuration');
        console.log('===========================');
        console.log('');
        console.log('To get READ-ONLY KuCoin API keys:');
        console.log('1. Go to https://www.kucoin.com/account/api');
        console.log('2. Create a new API key');
        console.log('3. IMPORTANT: Only enable "General" permission');
        console.log('4. DO NOT enable "Trade" permission');
        console.log('5. DO NOT enable "Margin" permission');
        console.log('6. DO NOT enable "Futures" permission');
        console.log('');

        const configureKuCoin = await this.askQuestion('Do you want to configure KuCoin API? (y/N): ');
        
        if (configureKuCoin.toLowerCase() === 'y' || configureKuCoin.toLowerCase() === 'yes') {
            const apiKey = await this.askQuestion('Enter KuCoin API Key (READ-ONLY): ');
            const apiSecret = await this.askQuestion('Enter KuCoin API Secret: ');
            const passphrase = await this.askQuestion('Enter KuCoin API Passphrase: ');
            
            if (apiKey && apiSecret && passphrase) {
                // Validate API key format
                if (apiKey.length < 20 || apiSecret.length < 20) {
                    console.log('⚠️  Warning: API key or secret seems too short. Please verify.');
                }
                
                this.config.KUCOIN_API_KEY = apiKey.trim();
                this.config.KUCOIN_API_SECRET = apiSecret.trim();
                this.config.KUCOIN_PASSPHRASE = passphrase.trim();
                
                console.log('✅ KuCoin API configured');
                console.log('⚠️  Remember: This API key will only be used for reading market data');
            } else {
                console.log('ℹ️  KuCoin API configuration skipped (all fields required)');
            }
        } else {
            console.log('ℹ️  KuCoin API configuration skipped');
        }
    }

    /**
     * Save configuration to file
     */
    async saveConfiguration() {
        console.log('\n💾 Saving configuration...');
        
        // Read current file content
        const envContent = fs.readFileSync(this.envFile, 'utf8');
        let lines = envContent.split('\n');
        
        // Update API key lines
        const apiKeys = [
            'BINANCE_API_KEY',
            'BINANCE_API_SECRET',
            'KUCOIN_API_KEY',
            'KUCOIN_API_SECRET',
            'KUCOIN_PASSPHRASE'
        ];
        
        for (const key of apiKeys) {
            if (this.config[key] !== undefined) {
                const lineIndex = lines.findIndex(line => line.startsWith(`${key}=`));
                if (lineIndex !== -1) {
                    lines[lineIndex] = `${key}=${this.config[key]}`;
                }
            }
        }
        
        // Write updated content
        fs.writeFileSync(this.envFile, lines.join('\n'));
        console.log('✅ Configuration saved');
    }

    /**
     * Validate configuration
     */
    async validateConfiguration() {
        console.log('\n🔍 Validating configuration...');
        
        let hasValidExchange = false;
        
        // Check Binance configuration
        if (this.config.BINANCE_API_KEY && this.config.BINANCE_API_SECRET) {
            console.log('✅ Binance API configured');
            hasValidExchange = true;
        }
        
        // Check KuCoin configuration
        if (this.config.KUCOIN_API_KEY && this.config.KUCOIN_API_SECRET && this.config.KUCOIN_PASSPHRASE) {
            console.log('✅ KuCoin API configured');
            hasValidExchange = true;
        }
        
        if (!hasValidExchange) {
            console.log('⚠️  Warning: No exchange APIs configured');
            console.log('   The system will work but market data will be limited');
            console.log('   You can configure APIs later by running this script again');
        }
        
        // Verify paper trading enforcement
        const paperTradingChecks = [
            { key: 'BINANCE_READ_ONLY', expected: 'true' },
            { key: 'BINANCE_SANDBOX', expected: 'false' },
            { key: 'BINANCE_MAINNET', expected: 'true' },
            { key: 'KUCOIN_READ_ONLY', expected: 'true' },
            { key: 'KUCOIN_SANDBOX', expected: 'false' },
            { key: 'KUCOIN_MAINNET', expected: 'true' }
        ];
        
        let paperTradingSafe = true;
        for (const check of paperTradingChecks) {
            if (this.config[check.key] !== check.expected) {
                console.log(`❌ ${check.key} should be ${check.expected} for paper trading safety`);
                paperTradingSafe = false;
            }
        }
        
        if (paperTradingSafe) {
            console.log('✅ Paper trading safety verified');
        } else {
            throw new Error('Paper trading safety validation failed');
        }
    }

    /**
     * Ask user a question
     */
    askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer);
            });
        });
    }
}

// Main execution
if (require.main === module) {
    const configurator = new ExchangeAPIConfigurator();
    configurator.configure().catch(error => {
        console.error('Configuration failed:', error);
        process.exit(1);
    });
}

module.exports = ExchangeAPIConfigurator;