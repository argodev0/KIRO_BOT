import { EventEmitter } from 'events';
import { HBInstance, HBStrategy } from '../types/hummingbot';
import { TechnicalAnalysisService } from './TechnicalAnalysisService';
import { RiskManagementService } from './RiskManagementService';
import { HummingbotBridgeService } from './HummingbotBridgeService';

export interface GridLevel {
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  orderId?: string;
  filled: boolean;
  probability: number;
  elliottWaveLevel?: string;
  fibonacciLevel?: number;
}

export interface GridConfiguration {
  symbol: string;
  basePrice: number;
  gridSpacing: number;
  gridLevels: number;
  positionSize: number;
  maxPosition: number;
  leverage: number;
  hedgeMode: boolean;
  hedgeTrigger: {
    priceDeviation: number;
    volumeThreshold: number;
    probabilityThreshold: number;
  };
  elliottWaveEnabled: boolean;
  nknEnabled: boolean;
  dynamicAdjustment: boolean;
}

export interface HedgePosition {
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  hedgeRatio: number;
  active: boolean;
}

export interface GridBotStatus {
  active: boolean;
  totalPnl: number;
  unrealizedPnl: number;
  filledOrders: number;
  activeOrders: number;
  currentPosition: number;
  hedgePosition?: HedgePosition;
  lastUpdate: Date;
}

export class PerpetualFuturesGridBot extends EventEmitter {
  private config: GridConfiguration;
  private gridLevels: GridLevel[] = [];
  private status: GridBotStatus;
  private hedgePosition?: HedgePosition;
  private technicalAnalysis: TechnicalAnalysisService;
  private riskManagement: RiskManagementService;
  private hummingbotBridge: HummingbotBridgeService;
  private instance?: HBInstance;
  private updateInterval?: NodeJS.Timeout;
  private lastPriceUpdate: number = 0;

  constructor(
    config: GridConfiguration,
    technicalAnalysis: TechnicalAnalysisService,
    riskManagement: RiskManagementService,
    hummingbotBridge: HummingbotBridgeService
  ) {
    super();
    this.config = config;
    this.technicalAnalysis = technicalAnalysis;
    this.riskManagement = riskManagement;
    this.hummingbotBridge = hummingbotBridge;
    
    this.status = {
      active: false,
      totalPnl: 0,
      unrealizedPnl: 0,
      filledOrders: 0,
      activeOrders: 0,
      currentPosition: 0,
      lastUpdate: new Date()
    };
  }

  async initialize(): Promise<void> {
    try {
      // Create or get Hummingbot instance for grid trading
      this.instance = await this.hummingbotBridge.createInstance({
        name: `grid-bot-${this.config.symbol}`,
        strategy: 'perpetual_market_making',
        config: this.buildHummingbotConfig()
      });

      // Initialize grid levels
      await this.calculateGridLevels();
      
      // Start monitoring
      this.startMonitoring();
      
      this.emit('initialized', { config: this.config, instance: this.instance });
    } catch (error) {
      this.emit('error', { type: 'initialization', error });
      throw error;
    }
  }

  private buildHummingbotConfig(): any {
    return {
      strategy: 'perpetual_market_making',
      exchange: 'binance_perpetual',
      market: this.config.symbol,
      leverage: this.config.leverage,
      position_mode: this.config.hedgeMode ? 'hedge' : 'one_way',
      bid_spread: this.config.gridSpacing / 2,
      ask_spread: this.config.gridSpacing / 2,
      order_amount: this.config.positionSize,
      order_levels: this.config.gridLevels,
      order_level_spread: this.config.gridSpacing,
      inventory_skew_enabled: true,
      inventory_target_base_pct: 50,
      inventory_range_multiplier: 1.0,
      filled_order_delay: 60,
      order_refresh_time: 30,
      max_order_age: 1800,
      order_refresh_tolerance_pct: 0.2,
      minimum_spread: 0.1,
      price_ceiling: -1,
      price_floor: -1,
      ping_pong_enabled: true
    };
  }

  private async calculateGridLevels(): Promise<void> {
    this.gridLevels = [];
    const basePrice = this.config.basePrice;
    const spacing = this.config.gridSpacing;
    const levels = this.config.gridLevels;

    // Get Elliott Wave analysis if enabled
    let elliottWaveData;
    if (this.config.elliottWaveEnabled) {
      try {
        elliottWaveData = await this.technicalAnalysis.analyzeElliottWave(
          this.config.symbol,
          '1h'
        );
      } catch (error) {
        console.warn('Elliott Wave analysis failed, continuing without it:', error);
        elliottWaveData = null;
      }
    }

    // Calculate grid levels with Elliott Wave and probability weighting
    for (let i = 0; i < levels; i++) {
      const buyPrice = basePrice - (spacing * (i + 1));
      const sellPrice = basePrice + (spacing * (i + 1));

      // Calculate probability scores
      const buyProbability = await this.calculateLevelProbability(buyPrice, 'buy');
      const sellProbability = await this.calculateLevelProbability(sellPrice, 'sell');

      // Adjust quantity based on probability and Elliott Wave levels
      const buyQuantity = this.calculateDynamicQuantity(buyProbability, elliottWaveData);
      const sellQuantity = this.calculateDynamicQuantity(sellProbability, elliottWaveData);

      this.gridLevels.push({
        price: buyPrice,
        quantity: buyQuantity,
        side: 'buy',
        filled: false,
        probability: buyProbability,
        elliottWaveLevel: this.getElliottWaveLevel(buyPrice, elliottWaveData),
        fibonacciLevel: this.getFibonacciLevel(buyPrice)
      });

      this.gridLevels.push({
        price: sellPrice,
        quantity: sellQuantity,
        side: 'sell',
        filled: false,
        probability: sellProbability,
        elliottWaveLevel: this.getElliottWaveLevel(sellPrice, elliottWaveData),
        fibonacciLevel: this.getFibonacciLevel(sellPrice)
      });
    }

    // Sort levels by price
    this.gridLevels.sort((a, b) => a.price - b.price);
    
    this.emit('gridLevelsCalculated', { levels: this.gridLevels });
  }

  private async calculateLevelProbability(price: number, side: 'buy' | 'sell'): Promise<number> {
    try {
      // Use NKN for probability analysis if enabled
      if (this.config.nknEnabled) {
        try {
          const nknAnalysis = await this.technicalAnalysis.analyzeWithNKN(
            this.config.symbol,
            { targetPrice: price, side }
          );
          return nknAnalysis.probability;
        } catch (nknError) {
          console.warn('NKN analysis failed, falling back to linear regression:', nknError);
          // Fall through to linear regression
        }
      }

      // Fallback to linear regression analysis
      const regression = await this.technicalAnalysis.calculateLinearRegression(
        this.config.symbol,
        '1h',
        50
      );

      const currentPrice = this.lastPriceUpdate || this.config.basePrice;
      const priceDeviation = Math.abs(price - currentPrice) / currentPrice;
      
      // Calculate probability based on regression trend and price deviation
      let probability = 0.5; // Base probability
      
      if (side === 'buy' && price < currentPrice) {
        probability += regression.trendStrength * 0.3;
      } else if (side === 'sell' && price > currentPrice) {
        probability += regression.trendStrength * 0.3;
      }
      
      // Adjust for price deviation (closer prices have higher probability)
      probability *= Math.exp(-priceDeviation * 2);
      
      return Math.max(0.1, Math.min(0.9, probability));
    } catch (error) {
      console.warn('Error calculating level probability:', error);
      return 0.5; // Default probability
    }
  }

  private calculateDynamicQuantity(probability: number, elliottWaveData?: any): number {
    let baseQuantity = this.config.positionSize;
    
    // Adjust quantity based on probability
    baseQuantity *= (0.5 + probability);
    
    // Adjust based on Elliott Wave levels if available
    if (elliottWaveData && elliottWaveData.currentWave) {
      const waveMultiplier = this.getWaveQuantityMultiplier(elliottWaveData.currentWave);
      baseQuantity *= waveMultiplier;
    }
    
    return Math.max(baseQuantity * 0.1, baseQuantity);
  }

  private getElliottWaveLevel(price: number, elliottWaveData?: any): string | undefined {
    if (!elliottWaveData || !elliottWaveData.waves) return undefined;
    
    // Find the closest Elliott Wave level
    let closestWave = null;
    let minDistance = Infinity;
    
    for (const wave of elliottWaveData.waves) {
      const distance = Math.abs(wave.price - price);
      if (distance < minDistance) {
        minDistance = distance;
        closestWave = wave;
      }
    }
    
    return closestWave ? closestWave.label : undefined;
  }

  private getFibonacciLevel(price: number): number | undefined {
    // This would integrate with the Fibonacci analysis from TechnicalAnalysisService
    // For now, return undefined as placeholder
    return undefined;
  }

  private getWaveQuantityMultiplier(currentWave: string): number {
    // Adjust quantities based on Elliott Wave theory
    switch (currentWave) {
      case 'Wave 1':
      case 'Wave 3':
      case 'Wave 5':
        return 1.2; // Increase quantity for impulse waves
      case 'Wave 2':
      case 'Wave 4':
        return 0.8; // Decrease quantity for corrective waves
      case 'Wave A':
      case 'Wave C':
        return 1.1; // Moderate increase for corrective impulse
      case 'Wave B':
        return 0.7; // Decrease for corrective wave B
      default:
        return 1.0;
    }
  }

  async start(): Promise<void> {
    if (this.status.active) {
      throw new Error('Grid bot is already active');
    }

    try {
      if (!this.instance) {
        await this.initialize();
      }

      // Start the Hummingbot instance
      await this.hummingbotBridge.startInstance(this.instance!.id);
      
      // Place initial grid orders
      await this.placeGridOrders();
      
      this.status.active = true;
      this.status.lastUpdate = new Date();
      
      this.emit('started', { status: this.status });
    } catch (error) {
      this.emit('error', { type: 'start', error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.status.active) {
      return;
    }

    try {
      // Cancel all active orders
      await this.cancelAllOrders();
      
      // Stop the Hummingbot instance
      if (this.instance) {
        await this.hummingbotBridge.stopInstance(this.instance.id);
      }
      
      // Stop monitoring
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = undefined;
      }
      
      this.status.active = false;
      this.status.lastUpdate = new Date();
      
      this.emit('stopped', { status: this.status });
    } catch (error) {
      this.emit('error', { type: 'stop', error });
      throw error;
    }
  }

  private async placeGridOrders(): Promise<void> {
    for (const level of this.gridLevels) {
      if (!level.filled && !level.orderId) {
        try {
          const orderId = await this.hummingbotBridge.placeOrder(this.instance!.id, {
            symbol: this.config.symbol,
            side: level.side,
            type: 'limit',
            quantity: level.quantity,
            price: level.price
          });
          
          level.orderId = orderId;
          this.status.activeOrders++;
        } catch (error) {
          console.error(`Failed to place grid order at ${level.price}:`, error);
        }
      }
    }
  }

  private async cancelAllOrders(): Promise<void> {
    for (const level of this.gridLevels) {
      if (level.orderId && !level.filled) {
        try {
          await this.hummingbotBridge.cancelOrder(this.instance!.id, level.orderId);
          level.orderId = undefined;
          this.status.activeOrders--;
        } catch (error) {
          console.error(`Failed to cancel order ${level.orderId}:`, error);
        }
      }
    }
  }

  private startMonitoring(): void {
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateStatus();
        await this.checkHedgeTriggers();
        await this.adjustGridDynamically();
      } catch (error) {
        this.emit('error', { type: 'monitoring', error });
      }
    }, process.env.NODE_ENV === 'test' ? 100 : 5000); // Update every 100ms in tests, 5s in production
  }

  private async updateStatus(): Promise<void> {
    if (!this.instance) return;

    try {
      const instanceStatus = await this.hummingbotBridge.getInstanceStatus(this.instance.id);
      const orders = await this.hummingbotBridge.getActiveOrders(this.instance.id);
      
      // Update grid levels with order status
      for (const level of this.gridLevels) {
        if (level.orderId) {
          const order = orders.find(o => o.id === level.orderId);
          if (order && order.status === 'filled') {
            level.filled = true;
            this.status.filledOrders++;
            this.status.activeOrders--;
            
            // Place opposite order for ping-pong trading
            await this.placeOppositeOrder(level);
          }
        }
      }
      
      // Update PnL and position
      this.status.totalPnl = instanceStatus.performance?.totalPnl || 0;
      this.status.unrealizedPnl = instanceStatus.performance?.unrealizedPnl || 0;
      this.status.currentPosition = instanceStatus.position?.size || 0;
      this.status.lastUpdate = new Date();
      
      this.emit('statusUpdated', { status: this.status });
    } catch (error) {
      console.error('Error updating grid bot status:', error);
    }
  }

  private async placeOppositeOrder(filledLevel: GridLevel): Promise<void> {
    const oppositePrice = filledLevel.side === 'buy' 
      ? filledLevel.price + this.config.gridSpacing
      : filledLevel.price - this.config.gridSpacing;
    
    const oppositeSide = filledLevel.side === 'buy' ? 'sell' : 'buy';
    
    try {
      const orderId = await this.hummingbotBridge.placeOrder(this.instance!.id, {
        symbol: this.config.symbol,
        side: oppositeSide,
        type: 'limit',
        quantity: filledLevel.quantity,
        price: oppositePrice
      });
      
      // Add new grid level or update existing one
      const existingLevel = this.gridLevels.find(l => 
        Math.abs(l.price - oppositePrice) < 0.01 && l.side === oppositeSide
      );
      
      if (existingLevel) {
        existingLevel.orderId = orderId;
        existingLevel.filled = false;
      } else {
        this.gridLevels.push({
          price: oppositePrice,
          quantity: filledLevel.quantity,
          side: oppositeSide,
          orderId,
          filled: false,
          probability: await this.calculateLevelProbability(oppositePrice, oppositeSide)
        });
      }
      
      this.status.activeOrders++;
    } catch (error) {
      console.error('Failed to place opposite order:', error);
    }
  }

  private async checkHedgeTriggers(): Promise<void> {
    if (!this.config.hedgeMode || this.hedgePosition?.active) {
      return;
    }

    const currentPrice = this.lastPriceUpdate || this.config.basePrice;
    const priceDeviation = Math.abs(currentPrice - this.config.basePrice) / this.config.basePrice;
    
    // Check if hedge should be triggered
    if (priceDeviation > this.config.hedgeTrigger.priceDeviation) {
      const probability = await this.calculateLevelProbability(currentPrice, 
        currentPrice > this.config.basePrice ? 'sell' : 'buy'
      );
      
      if (probability > this.config.hedgeTrigger.probabilityThreshold) {
        await this.activateHedgeMode(currentPrice);
      }
    }
  }

  private async activateHedgeMode(currentPrice: number): Promise<void> {
    try {
      const hedgeSide = this.status.currentPosition > 0 ? 'short' : 'long';
      const hedgeSize = Math.abs(this.status.currentPosition) * 0.8; // 80% hedge ratio
      
      // Place hedge position
      const hedgeOrderId = await this.hummingbotBridge.placeOrder(this.instance!.id, {
        symbol: this.config.symbol,
        side: hedgeSide === 'long' ? 'buy' : 'sell',
        type: 'market',
        quantity: hedgeSize
      });
      
      this.hedgePosition = {
        side: hedgeSide,
        size: hedgeSize,
        entryPrice: currentPrice,
        unrealizedPnl: 0,
        hedgeRatio: 0.8,
        active: true
      };
      
      this.status.hedgePosition = this.hedgePosition;
      
      this.emit('hedgeActivated', { 
        hedgePosition: this.hedgePosition,
        trigger: 'price_deviation'
      });
    } catch (error) {
      this.emit('error', { type: 'hedge_activation', error });
    }
  }

  private async adjustGridDynamically(): Promise<void> {
    if (!this.config.dynamicAdjustment) {
      return;
    }

    try {
      // Get latest market analysis
      const regression = await this.technicalAnalysis.calculateLinearRegression(
        this.config.symbol,
        '1h',
        20
      );
      
      // Adjust grid spacing based on volatility
      const volatility = regression.volatility || 0.02;
      const newSpacing = this.config.gridSpacing * (1 + volatility);
      
      // Recalculate grid levels if significant change
      if (Math.abs(newSpacing - this.config.gridSpacing) / this.config.gridSpacing > 0.1) {
        this.config.gridSpacing = newSpacing;
        await this.cancelAllOrders();
        await this.calculateGridLevels();
        await this.placeGridOrders();
        
        this.emit('gridAdjusted', { 
          newSpacing,
          reason: 'volatility_change',
          volatility
        });
      }
    } catch (error) {
      console.error('Error adjusting grid dynamically:', error);
    }
  }

  // Public methods for external control
  async updateConfiguration(newConfig: Partial<GridConfiguration>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Recalculate grid if significant changes
    const significantChanges = [
      'gridSpacing', 'gridLevels', 'positionSize', 'leverage'
    ].some(key => oldConfig[key as keyof GridConfiguration] !== this.config[key as keyof GridConfiguration]);
    
    if (significantChanges && this.status.active) {
      await this.cancelAllOrders();
      await this.calculateGridLevels();
      await this.placeGridOrders();
    }
    
    this.emit('configurationUpdated', { oldConfig, newConfig: this.config });
  }

  getStatus(): GridBotStatus {
    return { ...this.status };
  }

  getGridLevels(): GridLevel[] {
    return [...this.gridLevels];
  }

  getConfiguration(): GridConfiguration {
    return { ...this.config };
  }

  async getPerformanceMetrics(): Promise<any> {
    if (!this.instance) {
      return null;
    }

    try {
      const performance = await this.hummingbotBridge.getInstancePerformance(this.instance.id);
      
      return {
        ...performance,
        gridEfficiency: this.status.filledOrders / this.gridLevels.length,
        averageSpread: this.config.gridSpacing,
        hedgeEffectiveness: this.hedgePosition ? 
          Math.abs(this.hedgePosition.unrealizedPnl) / this.hedgePosition.size : 0,
        probabilityAccuracy: this.calculateProbabilityAccuracy()
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return null;
    }
  }

  private calculateProbabilityAccuracy(): number {
    const filledLevels = this.gridLevels.filter(l => l.filled);
    if (filledLevels.length === 0) return 0;
    
    const averageProbability = filledLevels.reduce((sum, level) => sum + level.probability, 0) / filledLevels.length;
    return averageProbability;
  }
}