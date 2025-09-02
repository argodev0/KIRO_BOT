import { HummingbotConnectionRecovery } from '../../services/HummingbotConnectionRecovery';
import { ConnectionRecoveryConfig, HBConnection } from '../../types/hummingbot';

describe('HummingbotConnectionRecovery', () => {
  let connectionRecovery: HummingbotConnectionRecovery;

  const config: ConnectionRecoveryConfig = {
    initialBackoffMs: 50,
    maxBackoffMs: 500,
    backoffMultiplier: 2,
    maxRetryAttempts: 3,
    connectionTimeoutMs: 1000,
    jitterMs: 10,
    maxPingAge: 5000
  };

  beforeEach(() => {
    connectionRecovery = new HummingbotConnectionRecovery(config);
  });

  afterEach(() => {
    connectionRecovery.cleanup();
  });

  describe('startRecovery', () => {
    it('should successfully recover connection on first attempt', async () => {
      // Arrange
      const instanceId = 'test-instance-1';
      const mockConnection: HBConnection = {
        instanceId,
        status: 'connected',
        lastPing: Date.now(),
        apiVersion: '1.0.0',
        supportedStrategies: ['pure_market_making'],
        endpoint: 'http://localhost:8080',
        connectionAttempts: 1
      };

      const connectionFactory = jest.fn().mockResolvedValue(mockConnection);
      const successSpy = jest.fn();
      connectionRecovery.on('recovery-successful', successSpy);

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for recovery to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(connectionFactory).toHaveBeenCalledTimes(1);
      expect(successSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId,
        connection: mockConnection
      }));

      const status = connectionRecovery.getRecoveryStatus(instanceId);
      expect(status.isRecovering).toBe(false);
      expect(status.state).toBe('connected');
    });

    it('should retry with exponential backoff on failures', async () => {
      // Arrange
      const instanceId = 'test-instance-2';
      let attemptCount = 0;

      const connectionFactory = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Connection attempt ${attemptCount} failed`);
        }
        return Promise.resolve({
          instanceId,
          status: 'connected',
          lastPing: Date.now(),
          apiVersion: '1.0.0',
          supportedStrategies: ['pure_market_making'],
          endpoint: 'http://localhost:8080',
          connectionAttempts: attemptCount
        });
      });

      const successSpy = jest.fn();
      connectionRecovery.on('recovery-successful', successSpy);

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for recovery to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      expect(connectionFactory).toHaveBeenCalledTimes(3);
      expect(successSpy).toHaveBeenCalled();

      const metrics = connectionRecovery.getMetrics();
      expect(metrics.successfulRecoveries).toBe(1);
      expect(metrics.totalAttempts).toBe(3);
    });

    it('should fail after maximum retry attempts', async () => {
      // Arrange
      const instanceId = 'test-instance-3';
      const connectionFactory = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      const failedSpy = jest.fn();
      connectionRecovery.on('recovery-failed', failedSpy);

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for recovery to fail
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      expect(connectionFactory).toHaveBeenCalledTimes(config.maxRetryAttempts);
      expect(failedSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId,
        attempts: config.maxRetryAttempts
      }));

      const status = connectionRecovery.getRecoveryStatus(instanceId);
      expect(status.isRecovering).toBe(false);
      expect(status.state).toBe('failed');

      const metrics = connectionRecovery.getMetrics();
      expect(metrics.failedRecoveries).toBe(1);
    });

    it('should handle connection timeout', async () => {
      // Arrange
      const instanceId = 'test-instance-4';
      const connectionFactory = jest.fn().mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      const failedSpy = jest.fn();
      connectionRecovery.on('recovery-failed', failedSpy);

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, config.connectionTimeoutMs + 200));

      // Assert
      const status = connectionRecovery.getRecoveryStatus(instanceId);
      expect(status.state).toBe('failed');
    });

    it('should not start recovery if already in progress', async () => {
      // Arrange
      const instanceId = 'test-instance-5';
      const connectionFactory = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);
      await connectionRecovery.startRecovery(instanceId, connectionFactory); // Second call

      // Assert
      expect(connectionFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopRecovery', () => {
    it('should stop ongoing recovery', async () => {
      // Arrange
      const instanceId = 'test-instance-6';
      const connectionFactory = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 1000));
      });

      const stoppedSpy = jest.fn();
      connectionRecovery.on('recovery-stopped', stoppedSpy);

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);
      connectionRecovery.stopRecovery(instanceId);

      // Assert
      expect(stoppedSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId
      }));

      const status = connectionRecovery.getRecoveryStatus(instanceId);
      expect(status.isRecovering).toBe(false);
      expect(status.state).toBe('stopped');
    });
  });

  describe('post-recovery validation', () => {
    it('should validate connection health after successful recovery', async () => {
      // Arrange
      const instanceId = 'test-instance-7';
      const mockConnection: HBConnection = {
        instanceId,
        status: 'connected',
        lastPing: Date.now() - 1000, // 1 second ago
        apiVersion: '1.0.0',
        supportedStrategies: ['pure_market_making'],
        endpoint: 'http://localhost:8080',
        connectionAttempts: 1
      };

      const connectionFactory = jest.fn().mockResolvedValue(mockConnection);
      const validationSuccessSpy = jest.fn();
      connectionRecovery.on('post-recovery-validation-successful', validationSuccessSpy);

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for validation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(validationSuccessSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId
      }));
    });

    it('should detect validation failures', async () => {
      // Arrange
      const instanceId = 'test-instance-8';
      const mockConnection: HBConnection = {
        instanceId,
        status: 'disconnected', // Invalid status
        lastPing: Date.now() - 10000, // Too old
        apiVersion: '', // Invalid version
        supportedStrategies: [],
        endpoint: 'http://localhost:8080',
        connectionAttempts: 1
      };

      const connectionFactory = jest.fn().mockResolvedValue(mockConnection);
      const validationFailedSpy = jest.fn();
      connectionRecovery.on('post-recovery-validation-failed', validationFailedSpy);

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for validation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(validationFailedSpy).toHaveBeenCalledWith(expect.objectContaining({
        instanceId,
        issues: expect.arrayContaining([
          expect.stringContaining('Connection status'),
          expect.stringContaining('Last ping'),
          expect.stringContaining('API version')
        ])
      }));
    });
  });

  describe('metrics tracking', () => {
    it('should track recovery metrics correctly', async () => {
      // Arrange
      const instanceId1 = 'test-instance-9';
      const instanceId2 = 'test-instance-10';

      const successfulFactory = jest.fn().mockResolvedValue({
        instanceId: instanceId1,
        status: 'connected',
        lastPing: Date.now(),
        apiVersion: '1.0.0',
        supportedStrategies: ['pure_market_making'],
        endpoint: 'http://localhost:8080',
        connectionAttempts: 1
      });

      const failedFactory = jest.fn().mockRejectedValue(new Error('Connection failed'));

      // Act
      await connectionRecovery.startRecovery(instanceId1, successfulFactory);
      await connectionRecovery.startRecovery(instanceId2, failedFactory);

      // Wait for operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      const metrics = connectionRecovery.getMetrics();
      expect(metrics.successfulRecoveries).toBe(1);
      expect(metrics.failedRecoveries).toBe(1);
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    it('should calculate average recovery time', async () => {
      // Arrange
      const instanceId = 'test-instance-11';
      const connectionFactory = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              instanceId,
              status: 'connected',
              lastPing: Date.now(),
              apiVersion: '1.0.0',
              supportedStrategies: ['pure_market_making'],
              endpoint: 'http://localhost:8080',
              connectionAttempts: 1
            });
          }, 100);
        });
      });

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      const metrics = connectionRecovery.getMetrics();
      expect(metrics.averageRecoveryTime).toBeGreaterThan(0);
    });
  });

  describe('connection states', () => {
    it('should track connection states correctly', async () => {
      // Arrange
      const instanceId = 'test-instance-12';
      const connectionFactory = jest.fn().mockResolvedValue({
        instanceId,
        status: 'connected',
        lastPing: Date.now(),
        apiVersion: '1.0.0',
        supportedStrategies: ['pure_market_making'],
        endpoint: 'http://localhost:8080',
        connectionAttempts: 1
      });

      // Act
      await connectionRecovery.startRecovery(instanceId, connectionFactory);

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      const states = connectionRecovery.getConnectionStates();
      expect(states.get(instanceId)).toBe('connected');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', () => {
      // Arrange
      const listenerCount = connectionRecovery.listenerCount('recovery-successful');

      // Act
      connectionRecovery.cleanup();

      // Assert
      expect(connectionRecovery.listenerCount('recovery-successful')).toBe(0);
    });
  });
});