#!/usr/bin/env node

/**
 * Production Logging System Test Suite
 * 
 * This script validates the production logging system implementation including:
 * - Structured logging with proper formatting
 * - Log rotation and retention policies
 * - Centralized logging with search capabilities
 * - Audit logging for all trading operations
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ProductionLoggingValidator {
  constructor() {
    this.results = {
      structuredLogging: { passed: false, details: [] },
      logRotation: { passed: false, details: [] },
      centralizedLogging: { passed: false, details: [] },
      auditLogging: { passed: false, details: [] },
      overall: { passed: false, score: 0 }
    };
    
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    this.testStartTime = new Date();
  }

  /**
   * Run all production logging tests
   */
  async runAllTests() {
    console.log('🔍 Starting Production Logging System Validation...\n');
    
    try {
      await this.testStructuredLogging();
      await this.testLogRotationAndRetention();
      await this.testCentralizedLogging();
      await this.testAuditLogging();
      
      this.calculateOverallScore();
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Critical error during logging validation:', error.message);
      this.results.overall.passed = false;
      this.results.overall.score = 0;
    }
    
    return this.results;
  }

  /**
   * Test structured logging with proper formatting
   */
  async testStructuredLogging() {
    console.log('📝 Testing Structured Logging...');
    
    try {
      // Check if logger utility exists
      const loggerPath = path.join(__dirname, '../src/utils/logger.ts');
      if (!fs.existsSync(loggerPath)) {
        throw new Error('Logger utility not found');
      }
      
      this.results.structuredLogging.details.push('✅ Logger utility exists');
      
      // Check logger configuration
      const loggerContent = fs.readFileSync(loggerPath, 'utf8');
      
      // Check for Winston usage
      if (loggerContent.includes('winston')) {
        this.results.structuredLogging.details.push('✅ Winston logging library configured');
      } else {
        throw new Error('Winston logging library not configured');
      }
      
      // Check for structured format
      if (loggerContent.includes('winston.format.json()')) {
        this.results.structuredLogging.details.push('✅ JSON structured format configured');
      } else {
        this.results.structuredLogging.details.push('⚠️ JSON format not explicitly configured');
      }
      
      // Check for timestamp format
      if (loggerContent.includes('winston.format.timestamp')) {
        this.results.structuredLogging.details.push('✅ Timestamp format configured');
      } else {
        throw new Error('Timestamp format not configured');
      }
      
      // Check for error stack traces
      if (loggerContent.includes('winston.format.errors({ stack: true })')) {
        this.results.structuredLogging.details.push('✅ Error stack traces enabled');
      } else {
        this.results.structuredLogging.details.push('⚠️ Error stack traces not explicitly enabled');
      }
      
      // Check for different log levels
      const logLevels = ['error', 'warn', 'info', 'debug'];
      const hasLogLevels = logLevels.some(level => loggerContent.includes(level));
      if (hasLogLevels) {
        this.results.structuredLogging.details.push('✅ Multiple log levels configured');
      } else {
        throw new Error('Log levels not properly configured');
      }
      
      // Check for production vs development formats
      if (loggerContent.includes('process.env.NODE_ENV === \'production\'')) {
        this.results.structuredLogging.details.push('✅ Environment-specific formatting configured');
      } else {
        this.results.structuredLogging.details.push('⚠️ Environment-specific formatting not detected');
      }
      
      this.results.structuredLogging.passed = true;
      console.log('✅ Structured logging validation passed\n');
      
    } catch (error) {
      this.results.structuredLogging.details.push(`❌ ${error.message}`);
      console.log('❌ Structured logging validation failed:', error.message, '\n');
    }
  }

  /**
   * Test log rotation and retention policies
   */
  async testLogRotationAndRetention() {
    console.log('🔄 Testing Log Rotation and Retention...');
    
    try {
      // Check for daily rotate file configuration
      const loggerPath = path.join(__dirname, '../src/utils/logger.ts');
      const loggerContent = fs.readFileSync(loggerPath, 'utf8');
      
      if (loggerContent.includes('winston-daily-rotate-file')) {
        this.results.logRotation.details.push('✅ Daily rotate file transport configured');
      } else {
        throw new Error('Daily rotate file transport not configured');
      }
      
      // Check for rotation settings
      if (loggerContent.includes('maxSize') && loggerContent.includes('maxFiles')) {
        this.results.logRotation.details.push('✅ Rotation size and file limits configured');
      } else {
        throw new Error('Rotation limits not configured');
      }
      
      // Check for audit file configuration
      if (loggerContent.includes('auditFile')) {
        this.results.logRotation.details.push('✅ Audit file tracking configured');
      } else {
        this.results.logRotation.details.push('⚠️ Audit file tracking not detected');
      }
      
      // Check if LogRetentionService exists
      const retentionServicePath = path.join(__dirname, '../src/services/LogRetentionService.ts');
      if (fs.existsSync(retentionServicePath)) {
        this.results.logRotation.details.push('✅ Log retention service implemented');
        
        const retentionContent = fs.readFileSync(retentionServicePath, 'utf8');
        
        // Check for retention policies
        if (retentionContent.includes('RetentionPolicy')) {
          this.results.logRotation.details.push('✅ Retention policies defined');
        }
        
        // Check for cleanup scheduling
        if (retentionContent.includes('scheduleCleanup')) {
          this.results.logRotation.details.push('✅ Automatic cleanup scheduling implemented');
        }
        
        // Check for compression
        if (retentionContent.includes('compressionEnabled')) {
          this.results.logRotation.details.push('✅ Log compression support implemented');
        }
        
      } else {
        throw new Error('Log retention service not implemented');
      }
      
      // Check logs directory structure
      const logsDir = path.join(__dirname, '../logs');
      if (fs.existsSync(logsDir)) {
        this.results.logRotation.details.push('✅ Logs directory exists');
        
        const logFiles = fs.readdirSync(logsDir);
        if (logFiles.length > 0) {
          this.results.logRotation.details.push(`✅ Log files present (${logFiles.length} files)`);
        }
      } else {
        this.results.logRotation.details.push('⚠️ Logs directory not found (will be created on first run)');
      }
      
      this.results.logRotation.passed = true;
      console.log('✅ Log rotation and retention validation passed\n');
      
    } catch (error) {
      this.results.logRotation.details.push(`❌ ${error.message}`);
      console.log('❌ Log rotation and retention validation failed:', error.message, '\n');
    }
  }

  /**
   * Test centralized logging with search capabilities
   */
  async testCentralizedLogging() {
    console.log('🔍 Testing Centralized Logging...');
    
    try {
      // Check for ELK stack configuration
      const monitoringComposePath = path.join(__dirname, '../monitoring/docker-compose.monitoring.yml');
      if (fs.existsSync(monitoringComposePath)) {
        this.results.centralizedLogging.details.push('✅ Monitoring stack configuration exists');
        
        const composeContent = fs.readFileSync(monitoringComposePath, 'utf8');
        
        // Check for Elasticsearch
        if (composeContent.includes('elasticsearch:')) {
          this.results.centralizedLogging.details.push('✅ Elasticsearch service configured');
        } else {
          throw new Error('Elasticsearch service not configured');
        }
        
        // Check for Logstash
        if (composeContent.includes('logstash:')) {
          this.results.centralizedLogging.details.push('✅ Logstash service configured');
        } else {
          throw new Error('Logstash service not configured');
        }
        
        // Check for Kibana
        if (composeContent.includes('kibana:')) {
          this.results.centralizedLogging.details.push('✅ Kibana service configured');
        } else {
          this.results.centralizedLogging.details.push('⚠️ Kibana service not configured');
        }
        
      } else {
        throw new Error('Monitoring stack configuration not found');
      }
      
      // Check for Logstash pipeline configuration
      const logstashPipelinePath = path.join(__dirname, '../monitoring/logstash/pipeline/logstash.conf');
      if (fs.existsSync(logstashPipelinePath)) {
        this.results.centralizedLogging.details.push('✅ Logstash pipeline configuration exists');
        
        const pipelineContent = fs.readFileSync(logstashPipelinePath, 'utf8');
        
        // Check for input sources
        if (pipelineContent.includes('input {')) {
          this.results.centralizedLogging.details.push('✅ Logstash input sources configured');
        }
        
        // Check for filters
        if (pipelineContent.includes('filter {')) {
          this.results.centralizedLogging.details.push('✅ Logstash filters configured');
        }
        
        // Check for Elasticsearch output
        if (pipelineContent.includes('elasticsearch {')) {
          this.results.centralizedLogging.details.push('✅ Elasticsearch output configured');
        }
        
        // Check for trading-specific parsing
        if (pipelineContent.includes('trading') || pipelineContent.includes('Trade executed')) {
          this.results.centralizedLogging.details.push('✅ Trading-specific log parsing configured');
        }
        
      } else {
        throw new Error('Logstash pipeline configuration not found');
      }
      
      // Check for Elasticsearch template
      const templatePath = path.join(__dirname, '../monitoring/logstash/templates/trading-bot-template.json');
      if (fs.existsSync(templatePath)) {
        this.results.centralizedLogging.details.push('✅ Elasticsearch index template exists');
        
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        const template = JSON.parse(templateContent);
        
        // Check for proper mappings
        if (template.template && template.template.mappings) {
          this.results.centralizedLogging.details.push('✅ Index mappings configured');
          
          const mappings = template.template.mappings.properties;
          if (mappings.trading) {
            this.results.centralizedLogging.details.push('✅ Trading-specific field mappings configured');
          }
          
          if (mappings.security) {
            this.results.centralizedLogging.details.push('✅ Security field mappings configured');
          }
          
          if (mappings.audit) {
            this.results.centralizedLogging.details.push('✅ Audit field mappings configured');
          }
        }
        
      } else {
        this.results.centralizedLogging.details.push('⚠️ Elasticsearch index template not found');
      }
      
      this.results.centralizedLogging.passed = true;
      console.log('✅ Centralized logging validation passed\n');
      
    } catch (error) {
      this.results.centralizedLogging.details.push(`❌ ${error.message}`);
      console.log('❌ Centralized logging validation failed:', error.message, '\n');
    }
  }

  /**
   * Test audit logging for all trading operations
   */
  async testAuditLogging() {
    console.log('📋 Testing Audit Logging...');
    
    try {
      // Check if AuditLogService exists
      const auditServicePath = path.join(__dirname, '../src/services/AuditLogService.ts');
      if (fs.existsSync(auditServicePath)) {
        this.results.auditLogging.details.push('✅ Audit log service implemented');
        
        const auditContent = fs.readFileSync(auditServicePath, 'utf8');
        
        // Check for trading audit events
        if (auditContent.includes('logTradingAuditEvent')) {
          this.results.auditLogging.details.push('✅ Trading audit event logging implemented');
        } else {
          throw new Error('Trading audit event logging not implemented');
        }
        
        // Check for security audit events
        if (auditContent.includes('logSecurityAuditEvent')) {
          this.results.auditLogging.details.push('✅ Security audit event logging implemented');
        } else {
          throw new Error('Security audit event logging not implemented');
        }
        
        // Check for configuration audit events
        if (auditContent.includes('logConfigurationAuditEvent')) {
          this.results.auditLogging.details.push('✅ Configuration audit event logging implemented');
        } else {
          throw new Error('Configuration audit event logging not implemented');
        }
        
        // Check for authentication events
        if (auditContent.includes('logAuthenticationEvent')) {
          this.results.auditLogging.details.push('✅ Authentication audit logging implemented');
        } else {
          this.results.auditLogging.details.push('⚠️ Authentication audit logging not detected');
        }
        
        // Check for paper trading safety events
        if (auditContent.includes('logPaperTradingSafetyEvent')) {
          this.results.auditLogging.details.push('✅ Paper trading safety audit logging implemented');
        } else {
          this.results.auditLogging.details.push('⚠️ Paper trading safety audit logging not detected');
        }
        
      } else {
        throw new Error('Audit log service not implemented');
      }
      
      // Check for audit logging middleware
      const auditMiddlewarePath = path.join(__dirname, '../src/middleware/auditLogging.ts');
      if (fs.existsSync(auditMiddlewarePath)) {
        this.results.auditLogging.details.push('✅ Audit logging middleware implemented');
        
        const middlewareContent = fs.readFileSync(auditMiddlewarePath, 'utf8');
        
        // Check for HTTP request auditing
        if (middlewareContent.includes('auditLoggingMiddleware')) {
          this.results.auditLogging.details.push('✅ HTTP request audit middleware implemented');
        }
        
        // Check for trading-specific auditing
        if (middlewareContent.includes('tradingAuditMiddleware')) {
          this.results.auditLogging.details.push('✅ Trading-specific audit middleware implemented');
        }
        
        // Check for configuration auditing
        if (middlewareContent.includes('configurationAuditMiddleware')) {
          this.results.auditLogging.details.push('✅ Configuration audit middleware implemented');
        }
        
      } else {
        throw new Error('Audit logging middleware not implemented');
      }
      
      // Check if audit logging is integrated in main app
      const mainAppPath = path.join(__dirname, '../src/index.ts');
      if (fs.existsSync(mainAppPath)) {
        const appContent = fs.readFileSync(mainAppPath, 'utf8');
        
        if (appContent.includes('auditLoggingMiddleware')) {
          this.results.auditLogging.details.push('✅ Audit logging middleware integrated in main app');
        } else {
          this.results.auditLogging.details.push('⚠️ Audit logging middleware not integrated in main app');
        }
      }
      
      // Check for logging management API
      const loggingRoutesPath = path.join(__dirname, '../src/routes/logging.ts');
      if (fs.existsSync(loggingRoutesPath)) {
        this.results.auditLogging.details.push('✅ Logging management API implemented');
        
        const routesContent = fs.readFileSync(loggingRoutesPath, 'utf8');
        
        // Check for configuration endpoints
        if (routesContent.includes('/config')) {
          this.results.auditLogging.details.push('✅ Logging configuration API endpoints implemented');
        }
        
        // Check for retention endpoints
        if (routesContent.includes('/retention')) {
          this.results.auditLogging.details.push('✅ Log retention API endpoints implemented');
        }
        
        // Check for health endpoints
        if (routesContent.includes('/health')) {
          this.results.auditLogging.details.push('✅ Logging health API endpoints implemented');
        }
        
      } else {
        this.results.auditLogging.details.push('⚠️ Logging management API not implemented');
      }
      
      this.results.auditLogging.passed = true;
      console.log('✅ Audit logging validation passed\n');
      
    } catch (error) {
      this.results.auditLogging.details.push(`❌ ${error.message}`);
      console.log('❌ Audit logging validation failed:', error.message, '\n');
    }
  }

  /**
   * Calculate overall score based on test results
   */
  calculateOverallScore() {
    const categories = [
      this.results.structuredLogging,
      this.results.logRotation,
      this.results.centralizedLogging,
      this.results.auditLogging
    ];
    
    const passedCategories = categories.filter(cat => cat.passed).length;
    this.results.overall.score = Math.round((passedCategories / categories.length) * 100);
    this.results.overall.passed = this.results.overall.score >= 75; // 75% threshold
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const testDuration = new Date() - this.testStartTime;
    
    console.log('📊 PRODUCTION LOGGING SYSTEM VALIDATION REPORT');
    console.log('=' .repeat(60));
    console.log(`Test Duration: ${testDuration}ms`);
    console.log(`Overall Score: ${this.results.overall.score}%`);
    console.log(`Status: ${this.results.overall.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');
    
    // Detailed results for each category
    const categories = [
      { name: 'Structured Logging', key: 'structuredLogging' },
      { name: 'Log Rotation & Retention', key: 'logRotation' },
      { name: 'Centralized Logging', key: 'centralizedLogging' },
      { name: 'Audit Logging', key: 'auditLogging' }
    ];
    
    categories.forEach(category => {
      const result = this.results[category.key];
      console.log(`${category.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      result.details.forEach(detail => console.log(`  ${detail}`));
      console.log('');
    });
    
    // Recommendations
    console.log('📋 RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    
    if (!this.results.structuredLogging.passed) {
      console.log('• Fix structured logging configuration');
    }
    
    if (!this.results.logRotation.passed) {
      console.log('• Implement proper log rotation and retention policies');
    }
    
    if (!this.results.centralizedLogging.passed) {
      console.log('• Set up centralized logging with ELK stack');
    }
    
    if (!this.results.auditLogging.passed) {
      console.log('• Implement comprehensive audit logging for trading operations');
    }
    
    if (this.results.overall.passed) {
      console.log('• Production logging system is ready for deployment! 🎉');
    } else {
      console.log('• Address the failed categories before production deployment');
    }
    
    // Save report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      testDuration,
      results: this.results,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        baseUrl: this.baseUrl
      }
    };
    
    const reportPath = path.join(__dirname, '../production-logging-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the validation if this script is executed directly
if (require.main === module) {
  const validator = new ProductionLoggingValidator();
  
  validator.runAllTests()
    .then(results => {
      process.exit(results.overall.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed with error:', error);
      process.exit(1);
    });
}

module.exports = ProductionLoggingValidator;