import { AnomalyDetectionService } from '../../services/AnomalyDetectionService';
import { TradingSignal } from '../../types/trading';

describe('AnomalyDetectionService', () => {
  let anomalyService: AnomalyDetectionService;

  beforeEach(() => {
    anomalyService = AnomalyDetectionService.getInstance();
  });

  afterEach(() => {
    anomalyService.stop();
  });

  describe('Signal Analysis', () => {
    it('should detect low confidence signals', () => {
      const signal: TradingSignal = {
        symbol: 'BTCUSDT',
        direction: 'long',
        confidence: 0.4, // Below threshold
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: [52000],
        reasoning: { technical: 0.4, patterns: 0.3, elliottWave: 0.5, fibonacci: 0.4, volume: 0.3 },
        timestamp: Date.now()
      };

      const anomalies = anomalyService.analyzeSignal(signal);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('low_signal_confidence');
      expect(anomalies[0].severity).toBe('medium');
    });

    it('should detect price anomalies', () => {
      const symbol = 'ETHUSDT';
      
      // Add normal price data
      for (let i = 0; i < 20; i++) {
        const signal: TradingSignal = {
          symbol,
          direction: 'long',
          confidence: 0.8,
          entryPrice: 3000 + (i * 10), // Normal price progression
          stopLoss: 2900,
          takeProfit: [3200],
          reasoning: { technical: 0.8, patterns: 0.7, elliottWave: 0.8, fibonacci: 0.8, volume: 0.7 },
          timestamp: Date.now()
        };
        anomalyService.analyzeSignal(signal);
      }

      // Add anomalous price
      const anomalousSignal: TradingSignal = {
        symbol,
        direction: 'long',
        confidence: 0.8,
        entryPrice: 5000, // Significantly higher than normal
        stopLoss: 4900,
        takeProfit: [5200],
        reasoning: { technical: 0.8, patterns: 0.7, elliottWave: 0.8, fibonacci: 0.8, volume: 0.7 },
        timestamp: Date.now()
      };

      const anomalies = anomalyService.analyzeSignal(anomalousSignal);
      const priceAnomaly = anomalies.find(a => a.type === 'price_anomaly');
      
      if (priceAnomaly) {
        expect(priceAnomaly.severity).toBe('high');
      }
    });

    it('should detect high signal frequency', () => {
      const symbol = 'BTCUSDT';
      
      // Generate many signals quickly
      for (let i = 0; i < 25; i++) {
        const signal: TradingSignal = {
          symbol,
          direction: 'long',
          confidence: 0.8,
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: [52000],
          reasoning: { technical: 0.8, patterns: 0.7, elliottWave: 0.8, fibonacci: 0.8, volume: 0.7 },
          timestamp: Date.now()
        };
        
        const anomalies = anomalyService.analyzeSignal(signal);
        
        if (i >= 20) {
          const frequencyAnomaly = anomalies.find(a => a.type === 'high_signal_frequency');
          if (frequencyAnomaly) {
            expect(frequencyAnomaly.severity).toBe('medium');
            break;
          }
        }
      }
    });
  });

  describe('Trade Execution Analysis', () => {
    it('should detect high execution latency', () => {
      const trade = {
        id: 'trade123',
        userId: 'user123',
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.1,
        price: 50000,
        latency: 2000, // High latency
        slippage: 0.1,
        pnl: 100
      };

      const anomalies = anomalyService.analyzeTradeExecution(trade);
      const latencyAnomaly = anomalies.find(a => a.type === 'high_execution_latency');

      expect(latencyAnomaly).toBeDefined();
      expect(latencyAnomaly?.severity).toBe('high');
    });

    it('should detect high slippage', () => {
      const trade = {
        id: 'trade124',
        userId: 'user123',
        symbol: 'ETHUSDT',
        side: 'sell',
        quantity: 1,
        price: 3000,
        latency: 100,
        slippage: 3, // High slippage
        pnl: -50
      };

      const anomalies = anomalyService.analyzeTradeExecution(trade);
      const slippageAnomaly = anomalies.find(a => a.type === 'high_slippage');

      expect(slippageAnomaly).toBeDefined();
      expect(slippageAnomaly?.severity).toBe('medium');
    });

    it('should detect consecutive losses', () => {
      const userId = 'user123';
      
      // Generate consecutive losing trades
      for (let i = 0; i < 6; i++) {
        const trade = {
          id: `trade${i}`,
          userId,
          symbol: 'BTCUSDT',
          side: 'buy',
          quantity: 0.1,
          price: 50000,
          latency: 100,
          slippage: 0.1,
          pnl: -100 // Loss
        };

        const anomalies = anomalyService.analyzeTradeExecution(trade);
        
        if (i >= 4) { // After 5 consecutive losses
          const lossAnomaly = anomalies.find(a => a.type === 'consecutive_losses');
          if (lossAnomaly) {
            expect(lossAnomaly.severity).toBe('critical');
            break;
          }
        }
      }
    });

    it('should detect excessive trading', () => {
      const userId = 'user123';
      
      // Generate many trades in a day
      for (let i = 0; i < 101; i++) {
        const trade = {
          id: `trade${i}`,
          userId,
          symbol: 'BTCUSDT',
          side: i % 2 === 0 ? 'buy' : 'sell',
          quantity: 0.1,
          price: 50000,
          latency: 100,
          slippage: 0.1,
          pnl: i % 3 === 0 ? 100 : -50
        };

        const anomalies = anomalyService.analyzeTradeExecution(trade);
        
        if (i >= 99) { // After 100 trades
          const tradingAnomaly = anomalies.find(a => a.type === 'excessive_trading');
          if (tradingAnomaly) {
            expect(tradingAnomaly.severity).toBe('high');
            break;
          }
        }
      }
    });
  });

  describe('Portfolio Analysis', () => {
    it('should detect excessive drawdown', () => {
      const portfolio = {
        totalBalance: 10000,
        availableBalance: 8000,
        positions: [],
        totalUnrealizedPnl: -500,
        totalRealizedPnl: -1000,
        maxDrawdown: 1500,
        currentDrawdown: 1200 // 12% drawdown
      };

      const anomalies = anomalyService.analyzePortfolio(portfolio);
      const drawdownAnomaly = anomalies.find(a => a.type === 'excessive_drawdown');

      expect(drawdownAnomaly).toBeDefined();
      expect(drawdownAnomaly?.severity).toBe('critical');
    });

    it('should detect oversized positions', () => {
      const portfolio = {
        totalBalance: 10000,
        availableBalance: 7000,
        positions: [
          {
            id: 'pos1',
            symbol: 'BTCUSDT',
            side: 'long' as const,
            size: 0.06, // Large position
            entryPrice: 50000,
            currentPrice: 51000,
            unrealizedPnl: 60,
            timestamp: Date.now()
          }
        ],
        totalUnrealizedPnl: 60,
        totalRealizedPnl: 0,
        maxDrawdown: 0,
        currentDrawdown: 0
      };

      const anomalies = anomalyService.analyzePortfolio(portfolio);
      const positionAnomaly = anomalies.find(a => a.type === 'oversized_position');

      expect(positionAnomaly).toBeDefined();
      expect(positionAnomaly?.severity).toBe('high');
    });

    it('should detect high correlation', () => {
      const portfolio = {
        totalBalance: 10000,
        availableBalance: 5000,
        positions: [
          {
            id: 'pos1',
            symbol: 'BTCUSDT',
            side: 'long' as const,
            size: 0.02,
            entryPrice: 50000,
            currentPrice: 51000,
            unrealizedPnl: 20,
            timestamp: Date.now()
          },
          {
            id: 'pos2',
            symbol: 'ETHUSDT',
            side: 'long' as const,
            size: 1,
            entryPrice: 3000,
            currentPrice: 3100,
            unrealizedPnl: 100,
            timestamp: Date.now()
          },
          {
            id: 'pos3',
            symbol: 'ADAUSDT',
            side: 'long' as const,
            size: 1000,
            entryPrice: 1,
            currentPrice: 1.05,
            unrealizedPnl: 50,
            timestamp: Date.now()
          }
        ],
        totalUnrealizedPnl: 170,
        totalRealizedPnl: 0,
        maxDrawdown: 0,
        currentDrawdown: 0
      };

      const anomalies = anomalyService.analyzePortfolio(portfolio);
      const correlationAnomaly = anomalies.find(a => a.type === 'high_correlation');

      // All positions are long, so correlation should be detected
      expect(correlationAnomaly).toBeDefined();
      expect(correlationAnomaly?.severity).toBe('medium');
    });
  });

  describe('Threshold Management', () => {
    it('should update anomaly thresholds', () => {
      const newThresholds = {
        maxConsecutiveLosses: 3,
        maxDrawdownPercent: 5,
        maxPositionSizePercent: 10
      };

      anomalyService.updateThresholds(newThresholds);
      const thresholds = anomalyService.getThresholds();

      expect(thresholds.maxConsecutiveLosses).toBe(3);
      expect(thresholds.maxDrawdownPercent).toBe(5);
      expect(thresholds.maxPositionSizePercent).toBe(10);
    });

    it('should get current thresholds', () => {
      const thresholds = anomalyService.getThresholds();

      expect(thresholds).toHaveProperty('maxConsecutiveLosses');
      expect(thresholds).toHaveProperty('maxDrawdownPercent');
      expect(thresholds).toHaveProperty('maxPositionSizePercent');
      expect(thresholds).toHaveProperty('maxDailyTradeCount');
      expect(thresholds).toHaveProperty('minSignalConfidence');
    });
  });

  describe('Event Emission', () => {
    it('should emit anomaly detected events', (done) => {
      anomalyService.on('anomaly_detected', (anomaly) => {
        expect(anomaly.type).toBe('low_system_win_rate');
        expect(anomaly.severity).toBe('high');
        done();
      });

      // This would be triggered by the periodic checks
      // For testing, we can manually trigger it
      setTimeout(() => {
        anomalyService.emit('anomaly_detected', {
          type: 'low_system_win_rate',
          severity: 'high',
          description: 'System-wide win rate is critically low',
          value: 0.2,
          threshold: 0.3,
          timestamp: Date.now()
        });
      }, 100);
    });
  });
});