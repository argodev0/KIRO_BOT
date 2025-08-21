/**
 * Security Audit and Penetration Testing E2E Suite
 * Comprehensive security testing for the AI Crypto Trading Bot
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

interface SecurityTestResult {
  testName: string;
  passed: boolean;
  vulnerabilities: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}

class SecurityTester {
  private baseUrl: string;
  private validToken: string;
  private testResults: SecurityTestResult[] = [];

  constructor(baseUrl: string, validToken: string) {
    this.baseUrl = baseUrl;
    this.validToken = validToken;
  }

  async runSecurityTest(
    testName: string,
    testFunction: () => Promise<any>,
    expectedBehavior: string
  ): Promise<SecurityTestResult> {
    try {
      const result = await testFunction();
      
      const testResult: SecurityTestResult = {
        testName,
        passed: this.evaluateSecurityResult(result, expectedBehavior),
        vulnerabilities: this.extractVulnerabilities(result),
        riskLevel: this.assessRiskLevel(result),
        details: result
      };

      this.testResults.push(testResult);
      return testResult;
    } catch (error) {
      const testResult: SecurityTestResult = {
        testName,
        passed: false,
        vulnerabilities: [`Test execution failed: ${error}`],
        riskLevel: 'high',
        details: { error: error.message }
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  private evaluateSecurityResult(result: any, expectedBehavior: string): boolean {
    switch (expectedBehavior) {
      case 'reject_unauthorized':
        return result.status === 401 || result.status === 403;
      case 'reject_malformed':
        return result.status === 400;
      case 'rate_limited':
        return result.status === 429;
      case 'secure_response':
        return result.status === 200 && this.hasSecurityHeaders(result.headers);
      default:
        return result.status === 200;
    }
  }

  private extractVulnerabilities(result: any): string[] {
    const vulnerabilities: string[] = [];

    // Check for common security issues
    if (result.headers) {
      if (!result.headers['x-frame-options']) {
        vulnerabilities.push('Missing X-Frame-Options header');
      }
      if (!result.headers['x-content-type-options']) {
        vulnerabilities.push('Missing X-Content-Type-Options header');
      }
      if (!result.headers['strict-transport-security']) {
        vulnerabilities.push('Missing HSTS header');
      }
      if (result.headers['server']) {
        vulnerabilities.push('Server header exposes server information');
      }
    }

    if (result.body && typeof result.body === 'string') {
      if (result.body.includes('Error:') && result.body.includes('at ')) {
        vulnerabilities.push('Stack trace exposed in response');
      }
      if (result.body.includes('password') || result.body.includes('secret')) {
        vulnerabilities.push('Sensitive information exposed in response');
      }
    }

    return vulnerabilities;
  }

  private assessRiskLevel(result: any): 'low' | 'medium' | 'high' | 'critical' {
    const vulnerabilities = this.extractVulnerabilities(result);
    
    if (vulnerabilities.some(v => v.includes('Stack trace') || v.includes('Sensitive information'))) {
      return 'critical';
    }
    if (vulnerabilities.some(v => v.includes('HSTS') || v.includes('X-Frame-Options'))) {
      return 'high';
    }
    if (vulnerabilities.length > 0) {
      return 'medium';
    }
    return 'low';
  }

  private hasSecurityHeaders(headers: any): boolean {
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security'
    ];
    
    return requiredHeaders.every(header => headers[header]);
  }

  async testSQLInjection(endpoint: string, parameter: string): Promise<any> {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --",
      "'; WAITFOR DELAY '00:00:05' --"
    ];

    const results = [];
    
    for (const payload of sqlPayloads) {
      const response = await fetch(`${this.baseUrl}${endpoint}?${parameter}=${encodeURIComponent(payload)}`, {
        headers: { 'Authorization': `Bearer ${this.validToken}` }
      });
      
      const body = await response.text();
      
      results.push({
        payload,
        status: response.status,
        body,
        responseTime: performance.now(),
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    return { endpoint, parameter, results };
  }

  async testXSS(endpoint: string): Promise<any> {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      "javascript:alert('XSS')",
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>'
    ];

    const results = [];
    
    for (const payload of xssPayloads) {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: payload })
      });
      
      const body = await response.text();
      
      results.push({
        payload,
        status: response.status,
        body,
        reflected: body.includes(payload),
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    return { endpoint, results };
  }

  async testAuthenticationBypass(): Promise<any> {
    const bypassAttempts = [
      { method: 'no_token', headers: {} },
      { method: 'invalid_token', headers: { 'Authorization': 'Bearer invalid_token' } },
      { method: 'malformed_token', headers: { 'Authorization': 'Bearer ' } },
      { method: 'expired_token', headers: { 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid' } },
      { method: 'wrong_algorithm', headers: { 'Authorization': 'Bearer none' } }
    ];

    const results = [];
    const protectedEndpoints = [
      '/api/trading/execute',
      '/api/signals/generate',
      '/api/account/balance',
      '/api/positions'
    ];

    for (const endpoint of protectedEndpoints) {
      for (const attempt of bypassAttempts) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: attempt.headers
        });
        
        results.push({
          endpoint,
          method: attempt.method,
          status: response.status,
          body: await response.text()
        });
      }
    }

    return results;
  }

  async testRateLimiting(): Promise<any> {
    const endpoint = '/api/auth/login';
    const requests = [];
    const startTime = performance.now();

    // Send 100 rapid requests
    for (let i = 0; i < 100; i++) {
      requests.push(
        fetch(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'wrong_password'
          })
        })
      );
    }

    const responses = await Promise.all(requests);
    const endTime = performance.now();

    const statusCounts = responses.reduce((acc, response) => {
      acc[response.status] = (acc[response.status] || 0) + 1;
      return acc;
    }, {} as { [key: number]: number });

    return {
      totalRequests: requests.length,
      duration: endTime - startTime,
      statusCounts,
      rateLimited: statusCounts[429] > 0,
      rateLimitedCount: statusCounts[429] || 0
    };
  }

  async testInputValidation(): Promise<any> {
    const maliciousInputs = [
      { type: 'oversized', value: 'A'.repeat(10000) },
      { type: 'null_bytes', value: 'test\x00admin' },
      { type: 'unicode_bypass', value: 'admin\u202etest' },
      { type: 'path_traversal', value: '../../../etc/passwd' },
      { type: 'command_injection', value: '; cat /etc/passwd' },
      { type: 'ldap_injection', value: '*)(uid=*))(|(uid=*' },
      { type: 'xml_bomb', value: '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><lolz>&lol2;</lolz>' }
    ];

    const endpoints = [
      { path: '/api/signals/generate', field: 'symbol' },
      { path: '/api/trading/execute', field: 'symbol' },
      { path: '/api/market-data/ticker', field: 'symbol' }
    ];

    const results = [];

    for (const endpoint of endpoints) {
      for (const input of maliciousInputs) {
        const body = { [endpoint.field]: input.value };
        
        const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.validToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        results.push({
          endpoint: endpoint.path,
          field: endpoint.field,
          inputType: input.type,
          status: response.status,
          body: await response.text()
        });
      }
    }

    return results;
  }

  async testCryptographicSecurity(): Promise<any> {
    const results = {
      jwtSecurity: await this.testJWTSecurity(),
      passwordHashing: await this.testPasswordHashing(),
      apiKeyEncryption: await this.testAPIKeyEncryption(),
      tlsSecurity: await this.testTLSSecurity()
    };

    return results;
  }

  private async testJWTSecurity(): Promise<any> {
    // Test JWT algorithm confusion
    const weakTokens = [
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJ1c2VyIjoiYWRtaW4ifQ.',
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4iLCJleHAiOjk5OTk5OTk5OTl9.invalid'
    ];

    const results = [];
    
    for (const token of weakTokens) {
      const response = await fetch(`${this.baseUrl}/api/account/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      results.push({
        token: token.substring(0, 50) + '...',
        status: response.status,
        accepted: response.status === 200
      });
    }

    return results;
  }

  private async testPasswordHashing(): Promise<any> {
    // Test password policy and hashing
    const weakPasswords = [
      '123456',
      'password',
      'admin',
      'test',
      '12345678'
    ];

    const results = [];
    
    for (const password of weakPasswords) {
      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test${Date.now()}@example.com`,
          password
        })
      });
      
      results.push({
        password,
        status: response.status,
        accepted: response.status === 200,
        body: await response.text()
      });
    }

    return results;
  }

  private async testAPIKeyEncryption(): Promise<any> {
    // Test API key storage security
    const response = await fetch(`${this.baseUrl}/api/test/security/api-keys`, {
      headers: { 'Authorization': `Bearer ${this.validToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        encrypted: data.encrypted,
        algorithm: data.algorithm,
        keyRotation: data.keyRotation
      };
    }

    return { error: 'Could not test API key encryption' };
  }

  private async testTLSSecurity(): Promise<any> {
    // Test TLS configuration
    try {
      const response = await fetch(this.baseUrl.replace('http://', 'https://'));
      return {
        httpsSupported: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      return {
        httpsSupported: false,
        error: error.message
      };
    }
  }

  async testBusinessLogicFlaws(): Promise<any> {
    const results = {
      priceManipulation: await this.testPriceManipulation(),
      orderSizeBypass: await this.testOrderSizeBypass(),
      riskLimitBypass: await this.testRiskLimitBypass(),
      accountBalanceManipulation: await this.testAccountBalanceManipulation()
    };

    return results;
  }

  private async testPriceManipulation(): Promise<any> {
    // Test if system can be tricked with manipulated price data
    const manipulatedPrices = [
      { symbol: 'BTCUSDT', price: -1000 },      // Negative price
      { symbol: 'BTCUSDT', price: 0 },          // Zero price
      { symbol: 'BTCUSDT', price: 999999999 },  // Extremely high price
      { symbol: 'BTCUSDT', price: 0.000001 }    // Extremely low price
    ];

    const results = [];
    
    for (const priceData of manipulatedPrices) {
      const response = await fetch(`${this.baseUrl}/api/test/market-data/inject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(priceData)
      });
      
      results.push({
        priceData,
        status: response.status,
        accepted: response.status === 200
      });
    }

    return results;
  }

  private async testOrderSizeBypass(): Promise<any> {
    // Test order size validation bypass attempts
    const invalidSizes = [
      { size: -1, type: 'negative' },
      { size: 0, type: 'zero' },
      { size: Infinity, type: 'infinity' },
      { size: NaN, type: 'nan' },
      { size: '1000000', type: 'string' }
    ];

    const results = [];
    
    for (const sizeTest of invalidSizes) {
      const response = await fetch(`${this.baseUrl}/api/trading/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          side: 'buy',
          size: sizeTest.size,
          exchange: 'binance'
        })
      });
      
      results.push({
        sizeTest,
        status: response.status,
        accepted: response.status === 200
      });
    }

    return results;
  }

  private async testRiskLimitBypass(): Promise<any> {
    // Test risk limit bypass attempts
    const bypassAttempts = [
      { method: 'concurrent_orders', description: 'Multiple simultaneous orders' },
      { method: 'fractional_sizes', description: 'Very small fractional sizes' },
      { method: 'different_symbols', description: 'Spread across different symbols' }
    ];

    const results = [];
    
    for (const attempt of bypassAttempts) {
      let success = false;
      
      if (attempt.method === 'concurrent_orders') {
        // Try to place multiple orders simultaneously
        const promises = Array(10).fill(0).map(() =>
          fetch(`${this.baseUrl}/api/trading/execute`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.validToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              symbol: 'BTCUSDT',
              side: 'buy',
              size: 0.01,
              exchange: 'binance'
            })
          })
        );
        
        const responses = await Promise.all(promises);
        const successCount = responses.filter(r => r.status === 200).length;
        success = successCount > 1; // Should only allow one if risk limits are working
      }
      
      results.push({
        method: attempt.method,
        description: attempt.description,
        bypassSuccessful: success
      });
    }

    return results;
  }

  private async testAccountBalanceManipulation(): Promise<any> {
    // Test account balance manipulation attempts
    const manipulationAttempts = [
      { balance: -1000, type: 'negative_balance' },
      { balance: 999999999, type: 'excessive_balance' },
      { balance: 'unlimited', type: 'string_balance' }
    ];

    const results = [];
    
    for (const attempt of manipulationAttempts) {
      const response = await fetch(`${this.baseUrl}/api/test/account/set-balance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ balance: attempt.balance })
      });
      
      results.push({
        attempt,
        status: response.status,
        accepted: response.status === 200
      });
    }

    return results;
  }

  getSecurityReport(): any {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const riskLevels = this.testResults.reduce((acc, result) => {
      acc[result.riskLevel] = (acc[result.riskLevel] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const allVulnerabilities = this.testResults.flatMap(r => r.vulnerabilities);
    const uniqueVulnerabilities = [...new Set(allVulnerabilities)];

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        passRate: (passedTests / totalTests) * 100
      },
      riskDistribution: riskLevels,
      vulnerabilities: uniqueVulnerabilities,
      detailedResults: this.testResults,
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const vulnerabilities = this.testResults.flatMap(r => r.vulnerabilities);

    if (vulnerabilities.some(v => v.includes('HSTS'))) {
      recommendations.push('Implement HTTP Strict Transport Security (HSTS) headers');
    }
    if (vulnerabilities.some(v => v.includes('X-Frame-Options'))) {
      recommendations.push('Add X-Frame-Options header to prevent clickjacking');
    }
    if (vulnerabilities.some(v => v.includes('Stack trace'))) {
      recommendations.push('Disable stack trace exposure in production');
    }
    if (vulnerabilities.some(v => v.includes('Server header'))) {
      recommendations.push('Remove or obfuscate server identification headers');
    }

    const criticalTests = this.testResults.filter(r => r.riskLevel === 'critical');
    if (criticalTests.length > 0) {
      recommendations.push('Address critical security vulnerabilities immediately');
    }

    return recommendations;
  }
}

describe('Security Audit and Penetration Testing', () => {
  let securityTester: SecurityTester;
  const baseUrl = 'http://localhost:3001';
  let authToken: string;

  beforeAll(async () => {
    // Get auth token
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!'
      })
    });
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    
    securityTester = new SecurityTester(baseUrl, authToken);
  }, 30000);

  describe('Input Validation Security Tests', () => {
    test('should prevent SQL injection attacks', async () => {
      const result = await securityTester.runSecurityTest(
        'SQL Injection Prevention',
        () => securityTester.testSQLInjection('/api/market-data/ticker', 'symbol'),
        'reject_malformed'
      );

      expect(result.passed).toBe(true);
      expect(result.riskLevel).not.toBe('critical');
      
      // Verify no SQL injection succeeded
      result.details.results.forEach((testResult: any) => {
        expect(testResult.status).not.toBe(200);
        expect(testResult.body).not.toContain('users');
        expect(testResult.body).not.toContain('password');
      });
    });

    test('should prevent XSS attacks', async () => {
      const result = await securityTester.runSecurityTest(
        'XSS Prevention',
        () => securityTester.testXSS('/api/signals/generate'),
        'reject_malformed'
      );

      expect(result.passed).toBe(true);
      
      // Verify XSS payloads are not reflected
      result.details.results.forEach((testResult: any) => {
        expect(testResult.reflected).toBe(false);
        expect(testResult.body).not.toContain('<script>');
        expect(testResult.body).not.toContain('javascript:');
      });
    });

    test('should validate input sizes and formats', async () => {
      const result = await securityTester.runSecurityTest(
        'Input Validation',
        () => securityTester.testInputValidation(),
        'reject_malformed'
      );

      expect(result.passed).toBe(true);
      
      // Verify malicious inputs are rejected
      result.details.forEach((testResult: any) => {
        if (testResult.inputType === 'oversized' || 
            testResult.inputType === 'command_injection' ||
            testResult.inputType === 'path_traversal') {
          expect(testResult.status).toBe(400);
        }
      });
    });
  });

  describe('Authentication and Authorization Security Tests', () => {
    test('should prevent authentication bypass', async () => {
      const result = await securityTester.runSecurityTest(
        'Authentication Bypass Prevention',
        () => securityTester.testAuthenticationBypass(),
        'reject_unauthorized'
      );

      expect(result.passed).toBe(true);
      
      // Verify all bypass attempts are rejected
      result.details.forEach((attempt: any) => {
        expect(attempt.status).toBeOneOf([401, 403]);
      });
    });

    test('should implement proper rate limiting', async () => {
      const result = await securityTester.runSecurityTest(
        'Rate Limiting',
        () => securityTester.testRateLimiting(),
        'rate_limited'
      );

      expect(result.passed).toBe(true);
      expect(result.details.rateLimited).toBe(true);
      expect(result.details.rateLimitedCount).toBeGreaterThan(0);
    });

    test('should have secure cryptographic implementation', async () => {
      const result = await securityTester.runSecurityTest(
        'Cryptographic Security',
        () => securityTester.testCryptographicSecurity(),
        'secure_response'
      );

      expect(result.passed).toBe(true);
      
      // Verify JWT security
      expect(result.details.jwtSecurity.every((test: any) => !test.accepted)).toBe(true);
      
      // Verify password policy
      expect(result.details.passwordHashing.every((test: any) => !test.accepted)).toBe(true);
    });
  });

  describe('Business Logic Security Tests', () => {
    test('should prevent business logic manipulation', async () => {
      const result = await securityTester.runSecurityTest(
        'Business Logic Security',
        () => securityTester.testBusinessLogicFlaws(),
        'reject_malformed'
      );

      expect(result.passed).toBe(true);
      
      // Verify price manipulation is prevented
      result.details.priceManipulation.forEach((test: any) => {
        expect(test.accepted).toBe(false);
      });
      
      // Verify order size validation
      result.details.orderSizeBypass.forEach((test: any) => {
        expect(test.accepted).toBe(false);
      });
      
      // Verify risk limit enforcement
      result.details.riskLimitBypass.forEach((test: any) => {
        expect(test.bypassSuccessful).toBe(false);
      });
    });

    test('should prevent financial manipulation attacks', async () => {
      // Test specific financial security scenarios
      const financialTests = [
        {
          name: 'Negative balance injection',
          test: async () => {
            const response = await fetch(`${baseUrl}/api/test/account/set-balance`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ balance: -1000000 })
            });
            return { status: response.status };
          }
        },
        {
          name: 'Order size overflow',
          test: async () => {
            const response = await fetch(`${baseUrl}/api/trading/execute`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                symbol: 'BTCUSDT',
                side: 'buy',
                size: Number.MAX_SAFE_INTEGER,
                exchange: 'binance'
              })
            });
            return { status: response.status };
          }
        }
      ];

      for (const financialTest of financialTests) {
        const result = await financialTest.test();
        expect(result.status).not.toBe(200);
      }
    });
  });

  describe('Infrastructure Security Tests', () => {
    test('should have proper security headers', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      const headers = Object.fromEntries(response.headers.entries());

      // Check for security headers
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-xss-protection']).toBeDefined();
      
      // Should not expose server information
      expect(headers['server']).toBeUndefined();
      expect(headers['x-powered-by']).toBeUndefined();
    });

    test('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        {
          name: 'Invalid JSON',
          body: '{"invalid": json}',
          contentType: 'application/json'
        },
        {
          name: 'XML in JSON endpoint',
          body: '<?xml version="1.0"?><root>test</root>',
          contentType: 'application/json'
        },
        {
          name: 'Extremely large payload',
          body: JSON.stringify({ data: 'A'.repeat(1000000) }),
          contentType: 'application/json'
        }
      ];

      for (const request of malformedRequests) {
        const response = await fetch(`${baseUrl}/api/signals/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': request.contentType
          },
          body: request.body
        });

        // Should reject malformed requests
        expect(response.status).toBeOneOf([400, 413, 415]);
      }
    });
  });

  describe('API Security Tests', () => {
    test('should validate API key permissions', async () => {
      // Test with different permission levels
      const permissionTests = [
        {
          endpoint: '/api/trading/execute',
          requiredPermission: 'trading',
          method: 'POST'
        },
        {
          endpoint: '/api/account/balance',
          requiredPermission: 'read',
          method: 'GET'
        },
        {
          endpoint: '/api/config/risk',
          requiredPermission: 'admin',
          method: 'PUT'
        }
      ];

      for (const test of permissionTests) {
        // Test with insufficient permissions
        const response = await fetch(`${baseUrl}${test.endpoint}`, {
          method: test.method,
          headers: {
            'Authorization': `Bearer ${authToken}`, // Regular user token
            'Content-Type': 'application/json'
          },
          body: test.method === 'POST' || test.method === 'PUT' ? 
            JSON.stringify({ test: 'data' }) : undefined
        });

        if (test.requiredPermission === 'admin') {
          expect(response.status).toBeOneOf([401, 403]);
        }
      }
    });

    test('should prevent API abuse patterns', async () => {
      // Test for common API abuse patterns
      const abuseTests = [
        {
          name: 'Rapid sequential requests',
          test: async () => {
            const promises = Array(50).fill(0).map(() =>
              fetch(`${baseUrl}/api/market-data/ticker/BTCUSDT`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
              })
            );
            const responses = await Promise.all(promises);
            return responses.filter(r => r.status === 429).length > 0;
          }
        },
        {
          name: 'Resource enumeration',
          test: async () => {
            const responses = [];
            for (let i = 1; i <= 10; i++) {
              const response = await fetch(`${baseUrl}/api/signals/${i}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
              });
              responses.push(response.status);
            }
            // Should not reveal which resources exist
            return responses.every(status => status === 404 || status === 403);
          }
        }
      ];

      for (const abuseTest of abuseTests) {
        const result = await abuseTest.test();
        expect(result).toBe(true);
      }
    });
  });

  afterAll(async () => {
    // Generate comprehensive security report
    const securityReport = securityTester.getSecurityReport();
    
    console.log('\n=== SECURITY AUDIT REPORT ===');
    console.log(`Total Tests: ${securityReport.summary.totalTests}`);
    console.log(`Passed: ${securityReport.summary.passedTests}`);
    console.log(`Failed: ${securityReport.summary.failedTests}`);
    console.log(`Pass Rate: ${securityReport.summary.passRate.toFixed(2)}%`);
    
    console.log('\nRisk Distribution:');
    Object.entries(securityReport.riskDistribution).forEach(([risk, count]) => {
      console.log(`  ${risk}: ${count}`);
    });
    
    if (securityReport.vulnerabilities.length > 0) {
      console.log('\nVulnerabilities Found:');
      securityReport.vulnerabilities.forEach(vuln => {
        console.log(`  - ${vuln}`);
      });
    }
    
    if (securityReport.recommendations.length > 0) {
      console.log('\nRecommendations:');
      securityReport.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
    // Security audit should pass with minimal critical issues
    expect(securityReport.summary.passRate).toBeGreaterThan(80);
    expect(securityReport.riskDistribution.critical || 0).toBeLessThan(3);
  });
});