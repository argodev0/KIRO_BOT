import { EventEmitter } from 'events';
import { HBInstance } from '../types/hummingbot';
import { TechnicalAnalysisService } from './TechnicalAnalysisService';
import { RiskManagementService } from './RiskManagementService';
import { HummingbotBridgeService } from './HummingbotBridgeService';

export interface HedgeConfiguration {
  symbol: string;
  hedgeRatio: number; // 0.0 to 1.0
  triggerThreshold: {
    priceDeviation: number; // Percentage
    volumeSpike: number; // Multiplier
    probabilityThreshold: number; // 0.0 to 1.0
    timeWindow: number; // Minutes
  };
  hedgeTypes: {
    oppositePosition: boolean;
    optionsHedge: boolean;
    crossAssetHedge: boolean;
  };
  riskLimits: {
    maxHedgeSize: number;
    maxDrawdown: number;
    stopLoss: number;
  };
  rebalanceFrequency: number; // Minutes
  emergencyExit: {
    enabled: boolean;
    maxLoss: number;
    timeLimit: number; // Minutes
  };
}

export interface HedgePosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  hedgeRatio: number;
  hedgeType: 'opposite' | 'options' | 'cross_asset';
  status: 'active' | 'closed' | 'partial';
  createdAt: Date;
  updatedAt: Date;
  orderId?: string;
}

export interface HedgeTrigger {
  type: 'price_deviation' | 'volume_spike' | 'probability_threshold' | 'manual' | 'emergency';
  timestamp: Date;
  data: any;
  confidence: number;
}

export interface HedgePerformance {
  totalHedges: number;
  successfulHedges: number;
  averageHedgeEffectiveness: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  averageHoldTime: number;
}

export class HedgeModeManager extends EventEmitter {
  private config: HedgeConfiguration;
  private activeHedges: Map<string, HedgePosition> = new Map();
  private hedgeHistory: HedgePosition[] = [];
  private technicalAnalysis: TechnicalAnalysisService;
  private riskManagement: RiskManagementService;
  private hummingbotBridge: HummingbotBridgeService;
  private monitoringInterval?: NodeJS.Timeout;
  private rebalanceInterval?: NodeJS.Timeout;
  private isActive: boolean = false;
  private lastTriggerCheck: Date = new Date();

  constructor(
    config: HedgeConfiguration,
    technicalAnalysis: TechnicalAnalysisService,
    riskManagement: RiskManagementService,
    hummingbotBridge: HummingbotBridgeService
  ) {
    super();
    this.config = config;
    this.technicalAnalysis = technicalAnalysis;
    this.riskManagement = riskManagement;
    this.hummingbotBridge = hummingbotBridge;
  }

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      this.validateConfiguration();
      
      // Start monitoring for hedge triggers
      this.startMonitoring();
      
      // Start rebalancing timer
      this.startRebalancing();
      
      this.isActive = true;
      this.emit('initialized', { config: this.config });
    } catch (error) {
      this.emit('error', { type: 'initialization', error });
      throw error;
    }
  }

  private validateConfiguration(): void {
    if (this.config.hedgeRatio < 0 || this.config.hedgeRatio > 1) {
      throw new Error('Hedge ratio must be between 0 and 1');
    }
    
    if (this.config.triggerThreshold.probabilityThreshold < 0 || 
        this.config.triggerThreshold.probabilityThreshold > 1) {
      throw new Error('Probability threshold must be between 0 and 1');
    }
    
    if (!this.config.hedgeTypes.oppositePosition && 
        !this.config.hedgeTypes.optionsHedge && 
        !this.config.hedgeTypes.crossAssetHedge) {
      throw new Error('At least one hedge type must be enabled');
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkHedgeTriggers();
        await this.updateActiveHedges();
        await this.checkEmergencyExit();
      } catch (error) {
        this.emit('error', { type: 'monitoring', error });
      }
    }, 10000); // Check every 10 seconds
  }

  private startRebalancing(): void {
    this.rebalanceInterval = setInterval(async () => {
      try {
        await this.rebalanceHedges();
      } catch (error) {
        this.emit('error', { type: 'rebalancing', error });
      }
    }, this.config.rebalanceFrequency * 60 * 1000);
  }

  private async checkHedgeTriggers(): Promise<void> {
    const now = new Date();
    const timeSinceLastCheck = (now.getTime() - this.lastTriggerCheck.getTime()) / 1000 / 60;
    
    if (timeSinceLastCheck < 1) return; // Don't check too frequently
    
    this.lastTriggerCheck = now;

    try {
      // Get current market data
      const marketData = await this.technicalAnalysis.getMarketData(this.config.symbol);
      const currentPrice = marketData.price;
      
      // Check price deviation trigger
      const priceDeviation = await this.checkPriceDeviationTrigger(currentPrice);
      if (priceDeviation) {
        await this.triggerHedge(priceDeviation);
      }
      
      // Check volume spike trigger
      const volumeSpike = await this.checkVolumeSpikeTrigger();
      if (volumeSpike) {
        await this.triggerHedge(volumeSpike);
      }
      
      // Check probability threshold trigger
      const probabilityTrigger = await this.checkProbabilityTrigger(currentPrice);
      if (probabilityTrigger) {
        await this.triggerHedge(probabilityTrigger);
      }
      
    } catch (error) {
      console.error('Error checking hedge triggers:', error);
    }
  }

  private async checkPriceDeviationTrigger(currentPrice: number): Promise<HedgeTrigger | null> {
    try {
      // Get baseline price (e.g., moving average)
      const regression = await this.technicalAnalysis.calculateLinearRegression(
        this.config.symbol,
        '1h',
        20
      );
      
      const baselinePrice = regression.predictedValue;
      const deviation = Math.abs(currentPrice - baselinePrice) / baselinePrice;
      
      if (deviation > this.config.triggerThreshold.priceDeviation) {
        return {
          type: 'price_deviation',
          timestamp: new Date(),
          data: {
            currentPrice,
            baselinePrice,
            deviation,
            threshold: this.config.triggerThreshold.priceDeviation
          },
          confidence: Math.min(deviation / this.config.triggerThreshold.priceDeviation, 1.0)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking price deviation trigger:', error);
      return null;
    }
  }

  private async checkVolumeSpikeTrigger(): Promise<HedgeTrigger | null> {
    try {
      const volumeData = await this.technicalAnalysis.getVolumeAnalysis(
        this.config.symbol,
        '5m',
        20
      );
      
      const currentVolume = volumeData.currentVolume;
      const averageVolume = volumeData.averageVolume;
      const volumeRatio = currentVolume / averageVolume;
      
      if (volumeRatio > this.config.triggerThreshold.volumeSpike) {
        return {
          type: 'volume_spike',
          timestamp: new Date(),
          data: {
            currentVolume,
            averageVolume,
            volumeRatio,
            threshold: this.config.triggerThreshold.volumeSpike
          },
          confidence: Math.min(volumeRatio / this.config.triggerThreshold.volumeSpike, 1.0)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking volume spike trigger:', error);
      return null;
    }
  }

  private async checkProbabilityTrigger(currentPrice: number): Promise<HedgeTrigger | null> {
    try {
      // Use NKN or linear regression for probability analysis
      const analysis = await this.technicalAnalysis.analyzeWithNKN(
        this.config.symbol,
        { targetPrice: currentPrice, timeframe: '1h' }
      );
      
      if (analysis.probability > this.config.triggerThreshold.probabilityThreshold) {
        return {
          type: 'probability_threshold',
          timestamp: new Date(),
          data: {
            probability: analysis.probability,
            threshold: this.config.triggerThreshold.probabilityThreshold,
            analysis
          },
          confidence: analysis.probability
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking probability trigger:', error);
      return null;
    }
  }

  private async triggerHedge(trigger: HedgeTrigger): Promise<void> {
    try {
      // Check if we should create a new hedge
      if (this.activeHedges.size >= 3) { // Limit concurrent hedges
        this.emit('hedgeLimitReached', { trigger, activeHedges: this.activeHedges.size });
        return;
      }
      
      // Determine hedge parameters
      const hedgeParams = await this.calculateHedgeParameters(trigger);
      
      // Create hedge position
      const hedgePosition = await this.createHedgePosition(hedgeParams, trigger);
      
      if (hedgePosition) {
        this.activeHedges.set(hedgePosition.id, hedgePosition);
        this.emit('hedgeTriggered', { trigger, hedgePosition });
      }
      
    } catch (error) {
      this.emit('error', { type: 'hedge_trigger', error, trigger });
    }
  }

  private async calculateHedgeParameters(trigger: HedgeTrigger): Promise<any> {
    const marketData = await this.technicalAnalysis.getMarketData(this.config.symbol);
    const currentPrice = marketData.price;
    
    // Calculate hedge size based on trigger confidence and risk limits
    const baseHedgeSize = this.config.riskLimits.maxHedgeSize * this.config.hedgeRatio;
    const confidenceAdjustedSize = baseHedgeSize * trigger.confidence;
    
    // Determine hedge direction
    let hedgeSide: 'long' | 'short' = 'long';
    
    if (trigger.type === 'price_deviation') {
      // Hedge against the deviation direction
      hedgeSide = trigger.data.currentPrice > trigger.data.baselinePrice ? 'short' : 'long';
    } else if (trigger.type === 'probability_threshold') {
      // Hedge based on probability analysis
      hedgeSide = trigger.data.analysis.direction === 'up' ? 'short' : 'long';
    }
    
    return {
      size: confidenceAdjustedSize,
      side: hedgeSide,
      entryPrice: currentPrice,
      hedgeType: this.selectHedgeType(),
      stopLoss: this.calculateStopLoss(currentPrice, hedgeSide),
      takeProfit: this.calculateTakeProfit(currentPrice, hedgeSide)
    };
  }

  private selectHedgeType(): 'opposite' | 'options' | 'cross_asset' {
    // Simple selection logic - can be enhanced with more sophisticated algorithms
    if (this.config.hedgeTypes.oppositePosition) {
      return 'opposite';
    } else if (this.config.hedgeTypes.optionsHedge) {
      return 'options';
    } else {
      return 'cross_asset';
    }
  }

  private calculateStopLoss(entryPrice: number, side: 'long' | 'short'): number {
    const stopLossPercent = this.config.riskLimits.stopLoss;
    
    if (side === 'long') {
      return entryPrice * (1 - stopLossPercent);
    } else {
      return entryPrice * (1 + stopLossPercent);
    }
  }

  private calculateTakeProfit(entryPrice: number, side: 'long' | 'short'): number {
    const takeProfitPercent = this.config.riskLimits.stopLoss * 2; // 2:1 risk/reward
    
    if (side === 'long') {
      return entryPrice * (1 + takeProfitPercent);
    } else {
      return entryPrice * (1 - takeProfitPercent);
    }
  }

  private async createHedgePosition(params: any, trigger: HedgeTrigger): Promise<HedgePosition | null> {
    try {
      const hedgeId = `hedge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Place hedge order based on type
      let orderId: string | undefined;
      
      if (params.hedgeType === 'opposite') {
        orderId = await this.placeOppositePositionHedge(params);
      } else if (params.hedgeType === 'options') {
        orderId = await this.placeOptionsHedge(params);
      } else if (params.hedgeType === 'cross_asset') {
        orderId = await this.placeCrossAssetHedge(params);
      }
      
      if (!orderId) {
        throw new Error('Failed to place hedge order');
      }
      
      const hedgePosition: HedgePosition = {
        id: hedgeId,
        symbol: this.config.symbol,
        side: params.side,
        size: params.size,
        entryPrice: params.entryPrice,
        currentPrice: params.entryPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        hedgeRatio: this.config.hedgeRatio,
        hedgeType: params.hedgeType,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        orderId
      };
      
      return hedgePosition;
      
    } catch (error) {
      console.error('Error creating hedge position:', error);
      return null;
    }
  }

  private async placeOppositePositionHedge(params: any): Promise<string> {
    // Get available Hummingbot instance
    const instances = await this.hummingbotBridge.getInstances();
    const availableInstance = instances.find(i => i.status === 'running');
    
    if (!availableInstance) {
      throw new Error('No available Hummingbot instance for hedge');
    }
    
    // Place opposite position order
    const orderId = await this.hummingbotBridge.placeOrder(availableInstance.id, {
      symbol: this.config.symbol,
      side: params.side === 'long' ? 'buy' : 'sell',
      type: 'market',
      quantity: params.size
    });
    
    return orderId;
  }

  private async placeOptionsHedge(params: any): Promise<string> {
    // Placeholder for options hedge implementation
    // This would integrate with options trading APIs
    throw new Error('Options hedge not implemented yet');
  }

  private async placeCrossAssetHedge(params: any): Promise<string> {
    // Placeholder for cross-asset hedge implementation
    // This would trade correlated assets
    throw new Error('Cross-asset hedge not implemented yet');
  }

  private async updateActiveHedges(): Promise<void> {
    for (const [hedgeId, hedge] of this.activeHedges) {
      try {
        // Get current market price
        const marketData = await this.technicalAnalysis.getMarketData(hedge.symbol);
        const currentPrice = marketData.price;
        
        // Update hedge position
        hedge.currentPrice = currentPrice;
        hedge.updatedAt = new Date();
        
        // Calculate unrealized PnL
        if (hedge.side === 'long') {
          hedge.unrealizedPnl = (currentPrice - hedge.entryPrice) * hedge.size;
        } else {
          hedge.unrealizedPnl = (hedge.entryPrice - currentPrice) * hedge.size;
        }
        
        // Check if hedge should be closed
        const shouldClose = await this.shouldCloseHedge(hedge);
        if (shouldClose) {
          await this.closeHedge(hedgeId, shouldClose.reason);
        }
        
      } catch (error) {
        console.error(`Error updating hedge ${hedgeId}:`, error);
      }
    }
  }

  private async shouldCloseHedge(hedge: HedgePosition): Promise<{ reason: string } | null> {
    // Check stop loss
    if (hedge.side === 'long' && hedge.currentPrice <= this.calculateStopLoss(hedge.entryPrice, 'long')) {
      return { reason: 'stop_loss' };
    }
    
    if (hedge.side === 'short' && hedge.currentPrice >= this.calculateStopLoss(hedge.entryPrice, 'short')) {
      return { reason: 'stop_loss' };
    }
    
    // Check take profit
    if (hedge.side === 'long' && hedge.currentPrice >= this.calculateTakeProfit(hedge.entryPrice, 'long')) {
      return { reason: 'take_profit' };
    }
    
    if (hedge.side === 'short' && hedge.currentPrice <= this.calculateTakeProfit(hedge.entryPrice, 'short')) {
      return { reason: 'take_profit' };
    }
    
    // Check time-based exit
    const holdTime = (new Date().getTime() - hedge.createdAt.getTime()) / 1000 / 60; // minutes
    if (holdTime > 240) { // 4 hours max hold time
      return { reason: 'time_limit' };
    }
    
    return null;
  }

  private async closeHedge(hedgeId: string, reason: string): Promise<void> {
    const hedge = this.activeHedges.get(hedgeId);
    if (!hedge) return;
    
    try {
      // Close the hedge position
      if (hedge.orderId) {
        const instances = await this.hummingbotBridge.getInstances();
        const instance = instances.find(i => i.status === 'running');
        
        if (instance) {
          await this.hummingbotBridge.placeOrder(instance.id, {
            symbol: hedge.symbol,
            side: hedge.side === 'long' ? 'sell' : 'buy',
            type: 'market',
            quantity: hedge.size
          });
        }
      }
      
      // Update hedge status
      hedge.status = 'closed';
      hedge.realizedPnl = hedge.unrealizedPnl;
      hedge.updatedAt = new Date();
      
      // Move to history
      this.hedgeHistory.push(hedge);
      this.activeHedges.delete(hedgeId);
      
      this.emit('hedgeClosed', { hedge, reason });
      
    } catch (error) {
      this.emit('error', { type: 'hedge_close', error, hedgeId });
    }
  }

  private async checkEmergencyExit(): Promise<void> {
    if (!this.config.emergencyExit.enabled) return;
    
    // Calculate total unrealized loss
    let totalUnrealizedLoss = 0;
    for (const hedge of this.activeHedges.values()) {
      if (hedge.unrealizedPnl < 0) {
        totalUnrealizedLoss += Math.abs(hedge.unrealizedPnl);
      }
    }
    
    // Check if emergency exit should be triggered
    if (totalUnrealizedLoss > this.config.emergencyExit.maxLoss) {
      await this.emergencyExit('max_loss_exceeded');
    }
    
    // Check time limit for oldest hedge
    const oldestHedge = Array.from(this.activeHedges.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    
    if (oldestHedge) {
      const holdTime = (new Date().getTime() - oldestHedge.createdAt.getTime()) / 1000 / 60;
      if (holdTime > this.config.emergencyExit.timeLimit) {
        await this.emergencyExit('time_limit_exceeded');
      }
    }
  }

  private async emergencyExit(reason: string): Promise<void> {
    try {
      // Close all active hedges immediately
      const hedgeIds = Array.from(this.activeHedges.keys());
      
      for (const hedgeId of hedgeIds) {
        await this.closeHedge(hedgeId, `emergency_${reason}`);
      }
      
      this.emit('emergencyExit', { reason, closedHedges: hedgeIds.length });
      
    } catch (error) {
      this.emit('error', { type: 'emergency_exit', error, reason });
    }
  }

  private async rebalanceHedges(): Promise<void> {
    if (this.activeHedges.size === 0) return;
    
    try {
      // Analyze current hedge performance
      const performance = this.calculateHedgePerformance();
      
      // Get current market conditions
      const marketData = await this.technicalAnalysis.getMarketData(this.config.symbol);
      const volatility = await this.calculateMarketVolatility();
      
      // Rebalance based on performance and market conditions
      for (const [hedgeId, hedge] of this.activeHedges) {
        const hedgePerformance = hedge.unrealizedPnl / hedge.size;
        const optimalHedgeRatio = await this.calculateOptimalHedgeRatio(hedge, volatility);
        
        // Adjust hedge size if needed
        if (Math.abs(hedgePerformance) > 0.05 || Math.abs(optimalHedgeRatio - hedge.hedgeRatio) > 0.1) {
          await this.adjustHedgeSize(hedgeId, optimalHedgeRatio, hedgePerformance);
        }
      }
      
      this.emit('hedgesRebalanced', { performance, volatility });
      
    } catch (error) {
      this.emit('error', { type: 'rebalancing', error });
    }
  }

  private async calculateMarketVolatility(): Promise<number> {
    try {
      const regression = await this.technicalAnalysis.calculateLinearRegression(
        this.config.symbol,
        '1h',
        24
      );
      return regression.volatility || 0.02;
    } catch (error) {
      console.error('Error calculating market volatility:', error);
      return 0.02; // Default volatility
    }
  }

  private async calculateOptimalHedgeRatio(hedge: HedgePosition, volatility: number): Promise<number> {
    try {
      // Base hedge ratio from configuration
      let optimalRatio = this.config.hedgeRatio;
      
      // Adjust based on volatility
      const volatilityAdjustment = Math.min(1.5, Math.max(0.5, 1 + (volatility - 0.02) * 10));
      optimalRatio *= volatilityAdjustment;
      
      // Adjust based on correlation if available
      const correlation = await this.calculatePositionCorrelation(hedge);
      if (correlation) {
        optimalRatio *= Math.abs(correlation);
      }
      
      // Adjust based on current performance
      const performanceRatio = hedge.unrealizedPnl / (hedge.size * hedge.entryPrice);
      if (performanceRatio < -0.02) { // If losing more than 2%
        optimalRatio *= 1.2; // Increase hedge
      } else if (performanceRatio > 0.02) { // If gaining more than 2%
        optimalRatio *= 0.8; // Decrease hedge
      }
      
      return Math.min(1.0, Math.max(0.1, optimalRatio));
    } catch (error) {
      console.error('Error calculating optimal hedge ratio:', error);
      return hedge.hedgeRatio;
    }
  }

  private async calculatePositionCorrelation(hedge: HedgePosition): Promise<number | null> {
    try {
      // Get price history for the hedged symbol
      const priceHistory = await this.technicalAnalysis.getPriceHistory(hedge.symbol, '1h', 50);
      
      if (priceHistory.length < 20) return null;
      
      // Calculate returns
      const returns: number[] = [];
      for (let i = 1; i < priceHistory.length; i++) {
        returns.push((priceHistory[i] - priceHistory[i - 1]) / priceHistory[i - 1]);
      }
      
      // For now, return a simplified correlation based on volatility
      // In a real implementation, this would compare with the main position
      const volatility = this.calculateVolatility(returns);
      return Math.max(0.3, Math.min(0.9, 1 - volatility * 10));
    } catch (error) {
      console.error('Error calculating position correlation:', error);
      return null;
    }
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private async adjustHedgeSize(hedgeId: string, optimalRatio: number, performance: number): Promise<void> {
    const hedge = this.activeHedges.get(hedgeId);
    if (!hedge) return;

    try {
      const currentRatio = hedge.hedgeRatio;
      const ratioChange = optimalRatio - currentRatio;
      
      if (Math.abs(ratioChange) < 0.05) return; // Less than 5% change, no adjustment needed
      
      // Calculate size adjustment
      const baseSize = hedge.size / currentRatio; // Original position size
      const newHedgeSize = baseSize * optimalRatio;
      const sizeAdjustment = newHedgeSize - hedge.size;
      
      if (Math.abs(sizeAdjustment) < 0.001) return; // Too small adjustment
      
      // Get available Hummingbot instance
      const instances = await this.hummingbotBridge.getInstances();
      const availableInstance = instances.find(i => i.status === 'running');
      
      if (!availableInstance) {
        console.warn('No available Hummingbot instance for hedge adjustment');
        return;
      }
      
      // Place adjustment order
      const adjustmentSide = sizeAdjustment > 0 ? hedge.side : (hedge.side === 'long' ? 'short' : 'long');
      const orderSide = adjustmentSide === 'long' ? 'buy' : 'sell';
      
      await this.hummingbotBridge.placeOrder(availableInstance.id, {
        symbol: hedge.symbol,
        side: orderSide,
        type: 'market',
        quantity: Math.abs(sizeAdjustment)
      });
      
      // Update hedge position
      hedge.size = newHedgeSize;
      hedge.hedgeRatio = optimalRatio;
      hedge.updatedAt = new Date();
      
      this.emit('hedgeAdjusted', {
        hedgeId,
        oldRatio: currentRatio,
        newRatio: optimalRatio,
        sizeAdjustment,
        performance,
        reason: this.getAdjustmentReason(ratioChange, performance)
      });
      
    } catch (error) {
      this.emit('error', { type: 'hedge_adjustment', error, hedgeId });
    }
  }

  private getAdjustmentReason(ratioChange: number, performance: number): string {
    if (Math.abs(performance) > 0.05) {
      return performance > 0 ? 'Reducing hedge due to positive performance' : 'Increasing hedge due to negative performance';
    }
    
    if (ratioChange > 0) {
      return 'Increasing hedge ratio due to market conditions';
    } else {
      return 'Decreasing hedge ratio due to market conditions';
    }
  }

  // Public methods
  async manualHedgeTrigger(data: any): Promise<void> {
    const trigger: HedgeTrigger = {
      type: 'manual',
      timestamp: new Date(),
      data,
      confidence: 1.0
    };
    
    await this.triggerHedge(trigger);
  }

  async closeAllHedges(): Promise<void> {
    const hedgeIds = Array.from(this.activeHedges.keys());
    
    for (const hedgeId of hedgeIds) {
      await this.closeHedge(hedgeId, 'manual_close');
    }
  }

  getActiveHedges(): HedgePosition[] {
    return Array.from(this.activeHedges.values());
  }

  getHedgeHistory(): HedgePosition[] {
    return [...this.hedgeHistory];
  }

  calculateHedgePerformance(): HedgePerformance {
    const allHedges = [...this.hedgeHistory, ...Array.from(this.activeHedges.values())];
    
    if (allHedges.length === 0) {
      return {
        totalHedges: 0,
        successfulHedges: 0,
        averageHedgeEffectiveness: 0,
        totalPnl: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
        averageHoldTime: 0
      };
    }
    
    const successfulHedges = allHedges.filter(h => h.realizedPnl > 0).length;
    const totalPnl = allHedges.reduce((sum, h) => sum + (h.realizedPnl || h.unrealizedPnl), 0);
    const winRate = successfulHedges / allHedges.length;
    
    const holdTimes = allHedges.map(h => {
      const endTime = h.status === 'closed' ? h.updatedAt : new Date();
      return (endTime.getTime() - h.createdAt.getTime()) / 1000 / 60; // minutes
    });
    
    const averageHoldTime = holdTimes.reduce((sum, time) => sum + time, 0) / holdTimes.length;
    
    return {
      totalHedges: allHedges.length,
      successfulHedges,
      averageHedgeEffectiveness: winRate,
      totalPnl,
      maxDrawdown: Math.min(...allHedges.map(h => h.realizedPnl || h.unrealizedPnl)),
      sharpeRatio: this.calculateSharpeRatio(allHedges),
      winRate,
      averageHoldTime
    };
  }

  private calculateSharpeRatio(hedges: HedgePosition[]): number {
    if (hedges.length < 2) return 0;
    
    const returns = hedges.map(h => (h.realizedPnl || h.unrealizedPnl) / h.size);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev === 0 ? 0 : avgReturn / stdDev;
  }

  async updateConfiguration(newConfig: Partial<HedgeConfiguration>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.validateConfiguration();
    this.emit('configurationUpdated', { config: this.config });
  }

  async stop(): Promise<void> {
    this.isActive = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval);
      this.rebalanceInterval = undefined;
    }
    
    // Close all active hedges
    await this.closeAllHedges();
    
    this.emit('stopped');
  }
}