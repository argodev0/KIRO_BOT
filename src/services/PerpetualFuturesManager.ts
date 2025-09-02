import { EventEmitter } from 'events';
import { HBInstance } from '../types/hummingbot';
import { TechnicalAnalysisService } from './TechnicalAnalysisService';
import { RiskManagementService } from './RiskManagementService';
import { HummingbotBridgeService } from './HummingbotBridgeService';

export interface PerpetualFuturesConfig {
  symbol: string;
  leverage: number;
  maxLeverage: number;
  minLeverage: number;
  positionMode: 'one_way' | 'hedge';
  marginType: 'isolated' | 'cross';
  fundingRateThreshold: number; // Percentage threshold for funding rate optimization
  leverageOptimization: {
    enabled: boolean;
    targetVolatility: number;
    riskAdjustment: number;
    rebalanceFrequency: number; // minutes
  };
  riskLimits: {
    maxPositionSize: number;
    maxNotionalValue: number;
    maxDailyLoss: number;
    liquidationBuffer: number; // Percentage buffer from liquidation price
  };
}

export interface PerpetualPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  notionalValue: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  leverage: number;
  margin: number;
  marginRatio: number;
  fundingFee: number;
  lastFundingTime: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FundingRateData {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  predictedRate: number;
  historicalRates: number[];
  averageRate: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface LeverageOptimization {
  currentLeverage: number;
  optimalLeverage: number;
  riskScore: number;
  volatilityAdjustment: number;
  recommendation: 'increase' | 'decrease' | 'maintain';
  reasoning: string;
}

export interface PositionCorrelation {
  symbol1: string;
  symbol2: string;
  correlation: number;
  hedgeRatio: number;
  effectiveness: number;
  confidence: number;
  timeframe: string;
}

export class PerpetualFuturesManager extends EventEmitter {
  private config: PerpetualFuturesConfig;
  private positions: Map<string, PerpetualPosition> = new Map();
  private fundingRates: Map<string, FundingRateData> = new Map();
  private correlations: Map<string, PositionCorrelation> = new Map();
  private technicalAnalysis: TechnicalAnalysisService;
  private riskManagement: RiskManagementService;
  private hummingbotBridge: HummingbotBridgeService;
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private isActive: boolean = false;

  constructor(
    config: PerpetualFuturesConfig,
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
      this.validateConfiguration();
      await this.setupPerpetualFutures();
      this.startMonitoring();
      this.startOptimization();
      
      this.isActive = true;
      this.emit('initialized', { config: this.config });
    } catch (error) {
      this.emit('error', { type: 'initialization', error });
      throw error;
    }
  }

  private validateConfiguration(): void {
    if (this.config.leverage < this.config.minLeverage || this.config.leverage > this.config.maxLeverage) {
      throw new Error(`Leverage must be between ${this.config.minLeverage} and ${this.config.maxLeverage}`);
    }

    if (this.config.riskLimits.liquidationBuffer < 0.05 || this.config.riskLimits.liquidationBuffer > 0.5) {
      throw new Error('Liquidation buffer must be between 5% and 50%');
    }

    if (this.config.fundingRateThreshold < 0.001 || this.config.fundingRateThreshold > 0.01) {
      throw new Error('Funding rate threshold must be between 0.1% and 1%');
    }
  }

  private async setupPerpetualFutures(): Promise<void> {
    // Configure perpetual futures settings
    const instances = await this.hummingbotBridge.getInstances();
    
    for (const instance of instances) {
      await this.configurePerpetualSettings(instance.id);
    }
  }

  private async configurePerpetualSettings(instanceId: string): Promise<void> {
    try {
      // Set leverage
      await this.hummingbotBridge.setLeverage(instanceId, this.config.symbol, this.config.leverage);
      
      // Set position mode
      await this.hummingbotBridge.setPositionMode(instanceId, this.config.positionMode);
      
      // Set margin type
      await this.hummingbotBridge.setMarginType(instanceId, this.config.symbol, this.config.marginType);
      
      this.emit('perpetualConfigured', { instanceId, symbol: this.config.symbol });
    } catch (error) {
      this.emit('error', { type: 'configuration', error, instanceId });
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updatePositions();
        await this.updateFundingRates();
        await this.checkRiskLimits();
        await this.monitorLiquidationRisk();
      } catch (error) {
        this.emit('error', { type: 'monitoring', error });
      }
    }, process.env.NODE_ENV === 'test' ? 50 : 10000); // 50ms in tests, 10s in production
  }

  private startOptimization(): void {
    if (!this.config.leverageOptimization.enabled) return;

    const interval = process.env.NODE_ENV === 'test' ? 100 : this.config.leverageOptimization.rebalanceFrequency * 60 * 1000;
    this.optimizationInterval = setInterval(async () => {
      try {
        await this.optimizeLeverage();
        await this.optimizeFundingRates();
        await this.updateCorrelations();
      } catch (error) {
        this.emit('error', { type: 'optimization', error });
      }
    }, interval);
  }

  private async updatePositions(): Promise<void> {
    const instances = await this.hummingbotBridge.getInstances();
    
    for (const instance of instances) {
      try {
        const positions = await this.hummingbotBridge.getPositions(instance.id, this.config.symbol);
        
        for (const position of positions) {
          const positionData: PerpetualPosition = {
            id: `${instance.id}_${position.symbol}_${position.side}`,
            symbol: position.symbol,
            side: position.side,
            size: position.size,
            notionalValue: position.size * position.markPrice,
            entryPrice: position.entryPrice,
            markPrice: position.markPrice,
            liquidationPrice: position.liquidationPrice,
            unrealizedPnl: position.unrealizedPnl,
            realizedPnl: position.realizedPnl,
            leverage: position.leverage,
            margin: position.margin,
            marginRatio: position.marginRatio,
            fundingFee: position.fundingFee || 0,
            lastFundingTime: position.lastFundingTime || Date.now(),
            createdAt: position.createdAt || new Date(),
            updatedAt: new Date()
          };

          this.positions.set(positionData.id, positionData);
        }
      } catch (error) {
        console.error(`Error updating positions for instance ${instance.id}:`, error);
      }
    }

    this.emit('positionsUpdated', { positions: Array.from(this.positions.values()) });
  }

  private async updateFundingRates(): Promise<void> {
    try {
      const fundingData = await this.hummingbotBridge.getFundingRate(this.config.symbol);
      
      const fundingRateData: FundingRateData = {
        symbol: this.config.symbol,
        fundingRate: fundingData.fundingRate,
        nextFundingTime: fundingData.nextFundingTime,
        predictedRate: fundingData.predictedRate || fundingData.fundingRate,
        historicalRates: fundingData.historicalRates || [],
        averageRate: this.calculateAverageFundingRate(fundingData.historicalRates || []),
        trend: this.analyzeFundingTrend(fundingData.historicalRates || [])
      };

      this.fundingRates.set(this.config.symbol, fundingRateData);
      this.emit('fundingRateUpdated', { fundingData: fundingRateData });
    } catch (error) {
      console.error('Error updating funding rates:', error);
    }
  }

  private calculateAverageFundingRate(rates: number[]): number {
    if (rates.length === 0) return 0;
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }

  private analyzeFundingTrend(rates: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (rates.length < 3) return 'stable';
    
    const recent = rates.slice(-3);
    const trend = recent[2] - recent[0];
    
    if (Math.abs(trend) < 0.0001) return 'stable';
    return trend > 0 ? 'increasing' : 'decreasing';
  }

  private async checkRiskLimits(): Promise<void> {
    for (const position of this.positions.values()) {
      // Check position size limit
      if (Math.abs(position.size) > this.config.riskLimits.maxPositionSize) {
        this.emit('riskViolation', {
          type: 'position_size_exceeded',
          position,
          limit: this.config.riskLimits.maxPositionSize
        });
      }

      // Check notional value limit
      if (position.notionalValue > this.config.riskLimits.maxNotionalValue) {
        this.emit('riskViolation', {
          type: 'notional_value_exceeded',
          position,
          limit: this.config.riskLimits.maxNotionalValue
        });
      }

      // Check margin ratio
      if (position.marginRatio < 0.1) { // 10% minimum margin ratio
        this.emit('riskViolation', {
          type: 'low_margin_ratio',
          position,
          marginRatio: position.marginRatio
        });
      }
    }
  }

  private async monitorLiquidationRisk(): Promise<void> {
    for (const position of this.positions.values()) {
      const liquidationDistance = Math.abs(position.markPrice - position.liquidationPrice) / position.markPrice;
      
      if (liquidationDistance < this.config.riskLimits.liquidationBuffer) {
        this.emit('liquidationRisk', {
          position,
          distance: liquidationDistance,
          buffer: this.config.riskLimits.liquidationBuffer
        });

        // Auto-reduce position if too close to liquidation
        await this.reducePositionSize(position.id, 0.5); // Reduce by 50%
      }
    }
  }

  private async optimizeLeverage(): Promise<void> {
    for (const position of this.positions.values()) {
      const optimization = await this.calculateOptimalLeverage(position);
      
      if (optimization.recommendation !== 'maintain') {
        await this.adjustLeverage(position.id, optimization.optimalLeverage);
        
        this.emit('leverageOptimized', {
          position,
          optimization
        });
      }
    }
  }

  private async calculateOptimalLeverage(position: PerpetualPosition): Promise<LeverageOptimization> {
    try {
      // Get market volatility
      const regression = await this.technicalAnalysis.calculateLinearRegression(
        position.symbol,
        '1h',
        24
      );

      const volatility = regression.volatility || 0.02;
      const targetVolatility = this.config.leverageOptimization.targetVolatility;
      
      // Calculate risk-adjusted optimal leverage
      const volatilityRatio = targetVolatility / volatility;
      const riskAdjustment = this.config.leverageOptimization.riskAdjustment;
      
      let optimalLeverage = position.leverage * volatilityRatio * riskAdjustment;
      
      // Constrain to limits
      optimalLeverage = Math.max(this.config.minLeverage, 
        Math.min(this.config.maxLeverage, optimalLeverage));

      const leverageDifference = Math.abs(optimalLeverage - position.leverage) / position.leverage;
      
      let recommendation: 'increase' | 'decrease' | 'maintain' = 'maintain';
      if (leverageDifference > 0.1) { // 10% threshold
        recommendation = optimalLeverage > position.leverage ? 'increase' : 'decrease';
      }

      return {
        currentLeverage: position.leverage,
        optimalLeverage,
        riskScore: this.calculateRiskScore(position, volatility),
        volatilityAdjustment: volatilityRatio,
        recommendation,
        reasoning: this.generateLeverageReasoning(volatility, targetVolatility, recommendation)
      };
    } catch (error) {
      console.error('Error calculating optimal leverage:', error);
      return {
        currentLeverage: position.leverage,
        optimalLeverage: position.leverage,
        riskScore: 0.5,
        volatilityAdjustment: 1.0,
        recommendation: 'maintain',
        reasoning: 'Error in calculation, maintaining current leverage'
      };
    }
  }

  private calculateRiskScore(position: PerpetualPosition, volatility: number): number {
    // Risk score based on multiple factors
    const leverageRisk = position.leverage / this.config.maxLeverage;
    const volatilityRisk = volatility / 0.1; // Normalize to 10% volatility
    const marginRisk = 1 - position.marginRatio;
    const liquidationRisk = 1 - (Math.abs(position.markPrice - position.liquidationPrice) / position.markPrice);
    
    return Math.min(1.0, (leverageRisk + volatilityRisk + marginRisk + liquidationRisk) / 4);
  }

  private generateLeverageReasoning(volatility: number, targetVolatility: number, recommendation: string): string {
    if (recommendation === 'maintain') {
      return 'Current leverage is optimal for market conditions';
    }
    
    if (volatility > targetVolatility) {
      return `Market volatility (${(volatility * 100).toFixed(2)}%) exceeds target (${(targetVolatility * 100).toFixed(2)}%), reducing leverage for risk management`;
    } else {
      return `Market volatility (${(volatility * 100).toFixed(2)}%) below target (${(targetVolatility * 100).toFixed(2)}%), increasing leverage for efficiency`;
    }
  }

  private async adjustLeverage(positionId: string, newLeverage: number): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) return;

    try {
      const instances = await this.hummingbotBridge.getInstances();
      const instance = instances.find(i => positionId.startsWith(i.id));
      
      if (instance) {
        await this.hummingbotBridge.setLeverage(instance.id, position.symbol, newLeverage);
        position.leverage = newLeverage;
        position.updatedAt = new Date();
        
        this.emit('leverageAdjusted', { position, newLeverage });
      }
    } catch (error) {
      this.emit('error', { type: 'leverage_adjustment', error, positionId });
    }
  }

  private async optimizeFundingRates(): Promise<void> {
    const fundingData = this.fundingRates.get(this.config.symbol);
    if (!fundingData) return;

    // Check if funding rate optimization is needed
    if (Math.abs(fundingData.fundingRate) > this.config.fundingRateThreshold) {
      await this.handleHighFundingRate(fundingData);
    }

    // Predict next funding rate and prepare
    if (fundingData.predictedRate && Math.abs(fundingData.predictedRate) > this.config.fundingRateThreshold) {
      await this.prepareFundingRateChange(fundingData);
    }
  }

  private async handleHighFundingRate(fundingData: FundingRateData): Promise<void> {
    const positions = Array.from(this.positions.values()).filter(p => p.symbol === fundingData.symbol);
    
    for (const position of positions) {
      // If funding rate is high and we're paying it, consider reducing position
      const isPayingFunding = (position.side === 'long' && fundingData.fundingRate > 0) ||
                             (position.side === 'short' && fundingData.fundingRate < 0);
      
      if (isPayingFunding && Math.abs(fundingData.fundingRate) > this.config.fundingRateThreshold) {
        // Reduce position size to minimize funding costs
        const reductionRatio = Math.min(0.3, Math.abs(fundingData.fundingRate) * 10); // Max 30% reduction
        await this.reducePositionSize(position.id, reductionRatio);
        
        this.emit('fundingOptimization', {
          action: 'position_reduced',
          position,
          fundingRate: fundingData.fundingRate,
          reductionRatio
        });
      }
    }
  }

  private async prepareFundingRateChange(fundingData: FundingRateData): Promise<void> {
    const timeToFunding = fundingData.nextFundingTime - Date.now();
    
    // If funding in next 30 minutes, prepare positions
    if (timeToFunding < 30 * 60 * 1000) {
      this.emit('fundingRateAlert', {
        symbol: fundingData.symbol,
        currentRate: fundingData.fundingRate,
        predictedRate: fundingData.predictedRate,
        timeToFunding
      });
    }
  }

  private async updateCorrelations(): Promise<void> {
    // Get all active symbols
    const symbols = Array.from(new Set(Array.from(this.positions.values()).map(p => p.symbol)));
    
    // Calculate correlations between all pairs
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const correlation = await this.calculatePositionCorrelation(symbols[i], symbols[j]);
        if (correlation) {
          this.correlations.set(`${symbols[i]}_${symbols[j]}`, correlation);
        }
      }
    }

    this.emit('correlationsUpdated', { correlations: Array.from(this.correlations.values()) });
  }

  private async calculatePositionCorrelation(symbol1: string, symbol2: string): Promise<PositionCorrelation | null> {
    try {
      // Get price data for both symbols
      const data1 = await this.technicalAnalysis.getPriceHistory(symbol1, '1h', 100);
      const data2 = await this.technicalAnalysis.getPriceHistory(symbol2, '1h', 100);
      
      if (data1.length !== data2.length || data1.length < 20) {
        return null;
      }

      // Calculate returns
      const returns1 = this.calculateReturns(data1);
      const returns2 = this.calculateReturns(data2);
      
      // Calculate correlation
      const correlation = this.calculateCorrelation(returns1, returns2);
      
      // Calculate optimal hedge ratio using linear regression
      const hedgeRatio = this.calculateHedgeRatio(returns1, returns2);
      
      // Calculate hedge effectiveness
      const effectiveness = this.calculateHedgeEffectiveness(returns1, returns2, hedgeRatio);
      
      return {
        symbol1,
        symbol2,
        correlation,
        hedgeRatio,
        effectiveness,
        confidence: Math.abs(correlation),
        timeframe: '1h'
      };
    } catch (error) {
      console.error(`Error calculating correlation between ${symbol1} and ${symbol2}:`, error);
      return null;
    }
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    const n = returns1.length;
    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;
    
    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateHedgeRatio(returns1: number[], returns2: number[]): number {
    // Calculate beta (hedge ratio) using linear regression
    const n = returns1.length;
    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      
      numerator += diff1 * diff2;
      denominator += diff2 * diff2;
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateHedgeEffectiveness(returns1: number[], returns2: number[], hedgeRatio: number): number {
    // Calculate variance reduction from hedging
    const variance1 = this.calculateVariance(returns1);
    const variance2 = this.calculateVariance(returns2);
    const correlation = this.calculateCorrelation(returns1, returns2);
    
    const hedgedVariance = variance1 + (hedgeRatio * hedgeRatio * variance2) - 
                          (2 * hedgeRatio * correlation * Math.sqrt(variance1 * variance2));
    
    return Math.max(0, 1 - (hedgedVariance / variance1));
  }

  private calculateVariance(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const sumSquaredDiffs = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0);
    return sumSquaredDiffs / returns.length;
  }

  private async reducePositionSize(positionId: string, reductionRatio: number): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) return;

    try {
      const instances = await this.hummingbotBridge.getInstances();
      const instance = instances.find(i => positionId.startsWith(i.id));
      
      if (instance) {
        const reductionSize = position.size * reductionRatio;
        const oppositeSide = position.side === 'long' ? 'sell' : 'buy';
        
        await this.hummingbotBridge.placeOrder(instance.id, {
          symbol: position.symbol,
          side: oppositeSide,
          type: 'market',
          quantity: reductionSize
        });
        
        this.emit('positionReduced', { position, reductionSize, reductionRatio });
      }
    } catch (error) {
      this.emit('error', { type: 'position_reduction', error, positionId });
    }
  }

  // Public methods
  async createHedgedPosition(symbol: string, size: number, hedgeSymbol?: string): Promise<string> {
    try {
      const instances = await this.hummingbotBridge.getInstances();
      const instance = instances.find(i => i.status === 'running');
      
      if (!instance) {
        throw new Error('No available Hummingbot instance');
      }

      // Place primary position
      const primaryOrderId = await this.hummingbotBridge.placeOrder(instance.id, {
        symbol,
        side: size > 0 ? 'buy' : 'sell',
        type: 'market',
        quantity: Math.abs(size)
      });

      // If hedge symbol specified, place hedge position
      if (hedgeSymbol) {
        const correlation = this.correlations.get(`${symbol}_${hedgeSymbol}`) || 
                           this.correlations.get(`${hedgeSymbol}_${symbol}`);
        
        if (correlation && Math.abs(correlation.correlation) > 0.5) {
          try {
            const hedgeSize = Math.abs(size) * correlation.hedgeRatio;
            const hedgeSide = correlation.correlation > 0 ? (size > 0 ? 'sell' : 'buy') : (size > 0 ? 'buy' : 'sell');
            
            await this.hummingbotBridge.placeOrder(instance.id, {
              symbol: hedgeSymbol,
              side: hedgeSide,
              type: 'market',
              quantity: hedgeSize
            });
          } catch (hedgeError) {
            // Log hedge error but don't fail the primary position
            console.warn('Hedge position creation failed:', hedgeError);
          }
        }
      }

      return primaryOrderId;
    } catch (error) {
      this.emit('error', { type: 'hedged_position_creation', error });
      throw error;
    }
  }

  getPositions(): PerpetualPosition[] {
    return Array.from(this.positions.values());
  }

  getFundingRates(): FundingRateData[] {
    return Array.from(this.fundingRates.values());
  }

  getCorrelations(): PositionCorrelation[] {
    return Array.from(this.correlations.values());
  }

  async updateConfiguration(newConfig: Partial<PerpetualFuturesConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.validateConfiguration();
    
    // Reconfigure instances if needed
    if (newConfig.leverage || newConfig.positionMode || newConfig.marginType) {
      await this.setupPerpetualFutures();
    }
    
    this.emit('configurationUpdated', { config: this.config });
  }

  async stop(): Promise<void> {
    this.isActive = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = undefined;
    }
    
    this.emit('stopped');
  }
}