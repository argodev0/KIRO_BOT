import { SecurityMonitoringService, SecurityAction } from '@/services/SecurityMonitoringService';
import { AuditLogService, AuditEventType, AuditSeverity } from '@/services/AuditLogService';
import { NotificationService } from '@/services/NotificationService';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('@/services/AuditLogService');
jest.mock('@/services/NotificationService');
jest.mock('@prisma/client');

describe('SecurityMonitoringService', () => {
  let securityService: SecurityMonitoringService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockAuditService: jest.Mocked<AuditLogService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockRequest: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn()
      },
      accountLocks: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      blockedIPs: {
        create: jest.fn(),
        findMany: jest.fn()
      },
      securityThreats: {
        create: jest.fn(),
        findMany: jest.fn()
      },
      users: {
        update: jest.fn()
      }
    } as any;

    mockAuditService = new AuditLogService(mockPrisma) as jest.Mocked<AuditLogService>;
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>;
    
    securityService = new SecurityMonitoringService(
      mockPrisma,
      mockAuditService,
      mockNotificationService
    );

    mockRequest = {
      headers: { 'x-forwarded-for': '192.168.1.1' },
      connection: { remoteAddress: '192.168.1.1' },
      sessionID: 'test-session-123'
    };

    // Mock notification service methods
    mockNotificationService.sendSecurityAlert = jest.fn().mockResolvedValue(undefined);
  });

  describe('monitorActivity', () => {
    it('should allow normal activity', async () => {
      mockPrisma.accountLocks.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await expect(
        securityService.monitorActivity('user123', AuditEventType.LOGIN, mockRequest)
      ).resolves.not.toThrow();
    });

    it('should block access from blocked IP', async () => {
      mockPrisma.blockedIPs.findMany.mockResolvedValue([
        { ipAddress: '192.168.1.1', reason: 'test', blockedAt: new Date(), expiresAt: null }
      ]);

      // Reinitialize service to load blocked IPs
      securityService = new SecurityMonitoringService(
        mockPrisma,
        mockAuditService,
        mockNotificationService
      );

      await expect(
        securityService.monitorActivity('user123', AuditEventType.LOGIN, mockRequest)
      ).rejects.toThrow('Access denied from blocked IP address');
    });

    it('should block access from locked account', async () => {
      mockPrisma.accountLocks.findUnique.mockResolvedValue({
        userId: 'user123',
        lockedAt: new Date(),
        lockReason: 'test',
        unlockAt: new Date(Date.now() + 60000), // 1 minute from now
        unlocked: false,
        attemptCount: 1
      });

      await expect(
        securityService.monitorActivity('user123', AuditEventType.LOGIN, mockRequest)
      ).rejects.toThrow('Account is locked due to security concerns');
    });
  });

  describe('suspicious activity detection', () => {
    it('should detect multiple failed login attempts', async () => {
      mockPrisma.accountLocks.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockImplementation((query: any) => {
        if (query.where.eventType === AuditEventType.LOGIN_FAILED) {
          return Promise.resolve(6); // Above threshold of 5
        }
        return Promise.resolve(0);
      });

      mockPrisma.securityThreats.create.mockResolvedValue({} as any);
      mockPrisma.accountLocks.upsert.mockResolvedValue({} as any);

      await securityService.monitorActivity('user123', AuditEventType.LOGIN_FAILED, mockRequest);

      expect(mockPrisma.securityThreats.create).toHaveBeenCalled();
      expect(mockPrisma.accountLocks.upsert).toHaveBeenCalled();
      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalled();
    });

    it('should detect rapid API calls', async () => {
      mockPrisma.accountLocks.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(1001); // Above threshold of 1000

      mockPrisma.securityThreats.create.mockResolvedValue({} as any);

      await securityService.monitorActivity('user123', AuditEventType.LOGIN, mockRequest);

      expect(mockPrisma.securityThreats.create).toHaveBeenCalled();
      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalled();
    });

    it('should detect multiple IP access', async () => {
      mockPrisma.accountLocks.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { ipAddress: '192.168.1.1' },
        { ipAddress: '192.168.1.2' },
        { ipAddress: '192.168.1.3' },
        { ipAddress: '192.168.1.4' },
        { ipAddress: '192.168.1.5' },
        { ipAddress: '192.168.1.6' } // 6 IPs, above threshold of 5
      ]);

      mockPrisma.securityThreats.create.mockResolvedValue({} as any);
      mockPrisma.users.update.mockResolvedValue({} as any);

      await securityService.monitorActivity('user123', AuditEventType.LOGIN, mockRequest);

      expect(mockPrisma.securityThreats.create).toHaveBeenCalled();
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: { requireMfaReset: true }
      });
    });
  });

  describe('lockAccount', () => {
    it('should lock account with duration', async () => {
      mockPrisma.accountLocks.upsert.mockResolvedValue({} as any);

      await securityService.lockAccount('user123', 'test reason', 60);

      expect(mockPrisma.accountLocks.upsert).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        update: expect.objectContaining({
          lockReason: 'test reason',
          lockDuration: 60
        }),
        create: expect.objectContaining({
          userId: 'user123',
          lockReason: 'test reason',
          lockDuration: 60
        })
      });

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          type: 'account_locked',
          message: 'Your account has been locked due to: test reason'
        })
      );
    });

    it('should lock account indefinitely', async () => {
      mockPrisma.accountLocks.upsert.mockResolvedValue({} as any);

      await securityService.lockAccount('user123', 'security violation');

      expect(mockPrisma.accountLocks.upsert).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        update: expect.objectContaining({
          lockReason: 'security violation',
          lockDuration: undefined,
          unlockAt: undefined
        }),
        create: expect.objectContaining({
          userId: 'user123',
          lockReason: 'security violation',
          lockDuration: undefined,
          unlockAt: undefined
        })
      });
    });
  });

  describe('unlockAccount', () => {
    it('should unlock account', async () => {
      mockPrisma.accountLocks.update.mockResolvedValue({} as any);

      await securityService.unlockAccount('user123', 'admin');

      expect(mockPrisma.accountLocks.update).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        data: {
          unlocked: true,
          unlockedAt: expect.any(Date),
          unlockedBy: 'admin'
        }
      });

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          type: 'account_unlocked',
          message: 'Your account has been unlocked'
        })
      );
    });
  });

  describe('blockIP', () => {
    it('should block IP address', async () => {
      mockPrisma.blockedIPs.create.mockResolvedValue({} as any);

      await securityService.blockIP('192.168.1.100', 'suspicious activity');

      expect(mockPrisma.blockedIPs.create).toHaveBeenCalledWith({
        data: {
          ipAddress: '192.168.1.100',
          reason: 'suspicious activity',
          blockedAt: expect.any(Date),
          expiresAt: undefined
        }
      });
    });

    it('should block IP address with expiration', async () => {
      mockPrisma.blockedIPs.create.mockResolvedValue({} as any);

      await securityService.blockIP('192.168.1.100', 'temporary block', 60);

      expect(mockPrisma.blockedIPs.create).toHaveBeenCalledWith({
        data: {
          ipAddress: '192.168.1.100',
          reason: 'temporary block',
          blockedAt: expect.any(Date),
          expiresAt: expect.any(Date)
        }
      });
    });
  });

  describe('getSecurityThreats', () => {
    it('should retrieve security threats', async () => {
      const mockThreats = [
        {
          id: 'threat1',
          userId: 'user123',
          ipAddress: '192.168.1.1',
          threatType: 'failed_login_attempts',
          severity: 'HIGH',
          description: 'Multiple failed login attempts',
          detectedAt: new Date(),
          resolved: false,
          resolvedAt: null,
          metadata: '{"count": 6}'
        }
      ];

      mockPrisma.securityThreats.findMany.mockResolvedValue(mockThreats);

      const threats = await securityService.getSecurityThreats('user123', false);

      expect(threats).toHaveLength(1);
      expect(threats[0]).toMatchObject({
        id: 'threat1',
        userId: 'user123',
        threatType: 'failed_login_attempts',
        severity: AuditSeverity.HIGH,
        resolved: false,
        metadata: { count: 6 }
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.accountLocks.findUnique.mockRejectedValue(new Error('Database error'));

      const lockInfo = await securityService.getAccountLockInfo('user123');
      expect(lockInfo).toBeNull();
    });

    it('should continue monitoring even if threat logging fails', async () => {
      mockPrisma.accountLocks.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.securityThreats.create.mockRejectedValue(new Error('Database error'));

      await expect(
        securityService.monitorActivity('user123', AuditEventType.LOGIN, mockRequest)
      ).resolves.not.toThrow();
    });
  });
});