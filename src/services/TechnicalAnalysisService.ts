/**
 * Technical Analysis Service
 * Main service for calculating technical indicators and performing market analysis
 */

import { CandleData } from '../types/market';
import {
  TechnicalIndicators,
  WaveTrendData,
  MarketRegime,
  SupportResistanceLevel,
  MultiTimeframeAnalysis,
  AnalysisConfig,
  WaveStructure,
} from '../types/analysis';
import { RSICalculator } from './indicators/RSICalculator';
import { WaveTrendCalculator } from './indicators/WaveTrendCalculator';
import { PVTCalculator } from './indicators/PVTCalculator';
import { SupportResistanceDetector } from './indicators/SupportResistanceDetector';
import { MarketRegimeClassifier } from './indicators/MarketRegimeClassifier';
import { ElliottWaveService } from './ElliottWaveService';
import { EnhancedSupportResistanceDetector, EnhancedSRLevel, LiquidityGrab } from './indicators/EnhancedSupportResistanceDetector';
import { TechnicalIndicatorScoringMatrix, IndicatorMatrix, IndicatorScore } from './indicators/TechnicalIndicatorScoringMatrix';
import { AdaptiveThresholdManager, AdaptiveThresholds, MarketConditions } from './indicators/AdaptiveThresholdManager';
import { ConfidenceWeightingSystem, WeightedConfidence } from './indicators/ConfidenceWeightingSystem';
import { validateCandleData } from '../validation/market.validation';

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
};

export interface IndicatorResults {
  rsi: number[];
  waveTrend: WaveTrendData[];
  pvt: number[];
  supportLevels: SupportResistanceLevel[];
  resistanceLevels: SupportResistanceLevel[];
}

export interface EnhancedAnalysisResults {
  basic: IndicatorResults;
  enhanced: {
    supportResistance: EnhancedSRLevel[];
    liquidityGrabs: LiquidityGrab[];
    indicatorMatrix: IndicatorMatrix;
    adaptiveThresholds: AdaptiveThresholds;
    weightedConfidence: WeightedConfidence;
  };
}

export class TechnicalAnalysisService {
  private config: AnalysisConfig;
  private rsiCalculator: RSICalculator;
  private waveTrendCalculator: WaveTrendCalculator;
  private pvtCalculator: PVTCalculator;
  private srDetector: SupportResistanceDetector;
  private regimeClassifier: MarketRegimeClassifier;
  private elliottWaveService: ElliottWaveService;
  
  // Enhanced components
  private enhancedSRDetector: EnhancedSupportResistanceDetector;
  private scoringMatrix: TechnicalIndicatorScoringMatrix;
  private thresholdManager: AdaptiveThresholdManager;
  private confidenceSystem: ConfidenceWeightingSystem;
  private historicalIndicators: TechnicalIndicators[] = [];

  constructor(config?: Partial<AnalysisConfig>) {
    this.config = this.getDefaultConfig(config);
    this.rsiCalculator = new RSICalculator(this.config.indicators.rsi);
    this.waveTrendCalculator = new WaveTrendCalculator(this.config.indicators.waveTrend);
    this.pvtCalculator = new PVTCalculator(this.config.indicators.pvt);
    this.srDetector = new SupportResistanceDetector();
    this.regimeClassifier = new MarketRegimeClassifier();
    this.elliottWaveService = new ElliottWaveService(this.config.elliottWave);
    
    // Initialize enhanced components
    this.enhancedSRDetector = new EnhancedSupportResistanceDetector();
    this.scoringMatrix = new TechnicalIndicatorScoringMatrix();
    
    // Initialize adaptive thresholds with default values
    const defaultThresholds: AdaptiveThresholds = {
      rsi: { oversold: 30, overbought: 70, neutral: [40, 60] },
      waveTrend: { buyThreshold: -60, sellThreshold: 60, extremeLevel: 80 },
      volume: { spikeThreshold: 2.0, lowVolumeThreshold: 0.5 },
      volatility: { lowVolatility: 0.1, highVolatility: 0.4 },
      confidence: { minConfidence: 0.3, strongConfidence: 0.8 },
    };
    
    this.thresholdManager = new AdaptiveThresholdManager(defaultThresholds);
    this.confidenceSystem = new ConfidenceWeightingSystem();
  }

  /**
   * Calculate all technical indicators for given candle data
   */
  async calculateIndicators(
    candles: CandleData[],
    indicators?: string[]
  ): Promise<IndicatorResults> {
    try {
      // Validate input data
      this.validateCandleData(candles);

      const results: IndicatorResults = {
        rsi: [],
        waveTrend: [],
        pvt: [],
        supportLevels: [],
        resistanceLevels: [],
      };

      // Calculate RSI if requested or no specific indicators specified
      if (!indicators || indicators.includes('rsi')) {
        results.rsi = await this.rsiCalculator.calculate(candles);
      }

      // Calculate Wave Trend if requested
      if (!indicators || indicators.includes('waveTrend')) {
        results.waveTrend = await this.waveTrendCalculator.calculate(candles);
      }

      // Calculate PVT if requested
      if (!indicators || indicators.includes('pvt')) {
        results.pvt = await this.pvtCalculator.calculate(candles);
      }

      // Detect support and resistance levels
      if (!indicators || indicators.includes('supportResistance')) {
        const srLevels = await this.srDetector.detectLevels(candles);
        results.supportLevels = srLevels.filter(level => level.type === 'support');
        results.resistanceLevels = srLevels.filter(level => level.type === 'resistance');
      }

      logger.debug('Calculated technical indicators', {
        symbol: candles[0]?.symbol,
        candleCount: candles.length,
        indicators: indicators || 'all',
      });

      return results;
    } catch (error) {
      logger.error('Failed to calculate indicators', { error, candleCount: candles.length });
      throw error;
    }
  }

  /**
   * Get current technical indicators for the latest candle
   */
  async getCurrentIndicators(candles: CandleData[]): Promise<TechnicalIndicators> {
    try {
      const results = await this.calculateIndicators(candles);
      const latestIndex = candles.length - 1;

      // Get latest values
      const rsi = results.rsi[latestIndex] || 50;
      const waveTrend = results.waveTrend[latestIndex] || { wt1: 0, wt2: 0, signal: 'neutral' as const };
      const pvt = results.pvt[latestIndex] || 0;

      // Determine trend based on indicators
      const trend = this.determineTrend(rsi, waveTrend, candles.slice(-20));
      const momentum = this.determineMomentum(rsi, waveTrend);
      const volatility = this.calculateVolatility(candles.slice(-20));

      return {
        rsi,
        waveTrend,
        pvt,
        supportLevels: results.supportLevels.map(level => level.price),
        resistanceLevels: results.resistanceLevels.map(level => level.price),
        trend,
        momentum,
        volatility,
      };
    } catch (error) {
      logger.error('Failed to get current indicators', { error });
      throw error;
    }
  }

  /**
   * Detect support and resistance levels
   */
  async detectSupportResistance(candles: CandleData[]): Promise<SupportResistanceLevel[]> {
    try {
      this.validateCandleData(candles);
      return await this.srDetector.detectLevels(candles);
    } catch (error) {
      logger.error('Failed to detect support/resistance levels', { error });
      throw error;
    }
  }

  /**
   * Classify market regime (trending vs ranging)
   */
  async classifyMarketRegime(candles: CandleData[]): Promise<MarketRegime> {
    try {
      this.validateCandleData(candles);
      return await this.regimeClassifier.classify(candles);
    } catch (error) {
      logger.error('Failed to classify market regime', { error });
      throw error;
    }
  }

  /**
   * Get multi-timeframe analysis
   */
  async getMultiTimeframeAnalysis(
    symbol: string,
    candlesByTimeframe: Record<string, CandleData[]>
  ): Promise<MultiTimeframeAnalysis> {
    try {
      const timeframes: Record<string, any> = {};
      const directions: Array<'bullish' | 'bearish' | 'neutral'> = [];
      const strengths: number[] = [];

      // Analyze each timeframe
      for (const [timeframe, candles] of Object.entries(candlesByTimeframe)) {
        if (candles.length === 0) continue;

        const indicators = await this.getCurrentIndicators(candles);
        const regime = await this.classifyMarketRegime(candles);

        timeframes[timeframe] = {
          symbol,
          timeframe,
          timestamp: Date.now(),
          technical: indicators,
          marketRegime: regime,
        };

        // Collect consensus data
        directions.push(indicators.trend === 'bullish' ? 'bullish' : 
                       indicators.trend === 'bearish' ? 'bearish' : 'neutral');
        
        const strength = this.calculateTrendStrength(indicators, regime);
        strengths.push(strength);
      }

      // Calculate consensus
      const consensus = this.calculateConsensus(directions, strengths);

      return {
        symbol,
        timestamp: Date.now(),
        timeframes,
        consensus,
      };
    } catch (error) {
      logger.error('Failed to get multi-timeframe analysis', { error, symbol });
      throw error;
    }
  }

  /**
   * Get Elliott Wave analysis for given candle data
   */
  async getElliottWaveAnalysis(candles: CandleData[]): Promise<WaveStructure> {
    try {
      this.validateCandleData(candles);
      return await this.elliottWaveService.analyzeWaveStructure(candles);
    } catch (error) {
      logger.error('Failed to get Elliott Wave analysis', { error });
      throw error;
    }
  }

  /**
   * Perform enhanced technical analysis with all improvements
   */
  async performEnhancedAnalysis(candles: CandleData[]): Promise<EnhancedAnalysisResults> {
    try {
      this.validateCandleData(candles);

      // Get basic analysis results
      const basicResults = await this.calculateIndicators(candles);
      const currentIndicators = await this.getCurrentIndicators(candles);
      
      // Store historical indicators for correlation analysis
      this.historicalIndicators.push(currentIndicators);
      if (this.historicalIndicators.length > 100) {
        this.historicalIndicators = this.historicalIndicators.slice(-100);
      }

      // Determine market conditions
      const marketConditions = await this.determineMarketConditions(candles, currentIndicators);

      // Update adaptive thresholds
      const adaptiveThresholds = await this.thresholdManager.updateThresholds(
        candles,
        this.historicalIndicators,
        marketConditions
      );

      // Enhanced support/resistance detection
      const enhancedSR = await this.enhancedSRDetector.detectEnhancedLevels(candles);
      
      // Liquidity grab detection
      const liquidityGrabs = await this.enhancedSRDetector.detectLiquidityGrabs(candles);

      // Calculate indicator scoring matrix
      const indicatorScores = await this.calculateIndicatorScores(currentIndicators);
      const indicatorMatrix = await this.scoringMatrix.calculateScoringMatrix(
        candles,
        currentIndicators,
        this.historicalIndicators
      );

      // Calculate weighted confidence
      const weightedConfidence = await this.confidenceSystem.calculateWeightedConfidence(
        candles,
        currentIndicators,
        indicatorScores,
        indicatorMatrix.correlationMatrix,
        marketConditions,
        [], // Would pass confluence zones from Fibonacci analysis
        adaptiveThresholds
      );

      logger.info('Enhanced technical analysis completed', {
        symbol: candles[0]?.symbol,
        enhancedSRLevels: enhancedSR.length,
        liquidityGrabs: liquidityGrabs.length,
        overallConfidence: weightedConfidence.overallConfidence,
        dominantSignal: indicatorMatrix.dominantSignal,
      });

      return {
        basic: basicResults,
        enhanced: {
          supportResistance: enhancedSR,
          liquidityGrabs,
          indicatorMatrix,
          adaptiveThresholds,
          weightedConfidence,
        },
      };
    } catch (error) {
      logger.error('Failed to perform enhanced analysis', { error });
      throw error;
    }
  }

  /**
   * Detect liquidity grabs and potential reversals
   */
  async detectLiquidityGrabs(candles: CandleData[]): Promise<LiquidityGrab[]> {
    try {
      this.validateCandleData(candles);
      return await this.enhancedSRDetector.detectLiquidityGrabs(candles);
    } catch (error) {
      logger.error('Failed to detect liquidity grabs', { error });
      throw error;
    }
  }

  /**
   * Get enhanced support and resistance levels with strength scoring
   */
  async getEnhancedSupportResistance(candles: CandleData[]): Promise<EnhancedSRLevel[]> {
    try {
      this.validateCandleData(candles);
      return await this.enhancedSRDetector.detectEnhancedLevels(candles);
    } catch (error) {
      logger.error('Failed to get enhanced support/resistance levels', { error });
      throw error;
    }
  }

  /**
   * Calculate technical indicator scoring matrix
   */
  async calculateIndicatorScoringMatrix(
    candles: CandleData[],
    indicators?: TechnicalIndicators
  ): Promise<IndicatorMatrix> {
    try {
      this.validateCandleData(candles);
      
      const currentIndicators = indicators || await this.getCurrentIndicators(candles);
      
      return await this.scoringMatrix.calculateScoringMatrix(
        candles,
        currentIndicators,
        this.historicalIndicators
      );
    } catch (error) {
      logger.error('Failed to calculate indicator scoring matrix', { error });
      throw error;
    }
  }

  /**
   * Get adaptive thresholds based on market conditions
   */
  async getAdaptiveThresholds(candles: CandleData[]): Promise<AdaptiveThresholds> {
    try {
      this.validateCandleData(candles);
      
      const currentIndicators = await this.getCurrentIndicators(candles);
      const marketConditions = await this.determineMarketConditions(candles, currentIndicators);
      
      return await this.thresholdManager.updateThresholds(
        candles,
        this.historicalIndicators,
        marketConditions
      );
    } catch (error) {
      logger.error('Failed to get adaptive thresholds', { error });
      throw error;
    }
  }

  /**
   * Calculate weighted confidence for analysis results
   */
  async calculateWeightedConfidence(
    candles: CandleData[],
    indicators?: TechnicalIndicators
  ): Promise<WeightedConfidence> {
    try {
      this.validateCandleData(candles);
      
      const currentIndicators = indicators || await this.getCurrentIndicators(candles);
      const marketConditions = await this.determineMarketConditions(candles, currentIndicators);
      const indicatorScores = await this.calculateIndicatorScores(currentIndicators);
      const indicatorMatrix = await this.scoringMatrix.calculateScoringMatrix(
        candles,
        currentIndicators,
        this.historicalIndicators
      );
      const adaptiveThresholds = await this.thresholdManager.getCurrentThresholds();
      
      return await this.confidenceSystem.calculateWeightedConfidence(
        candles,
        currentIndicators,
        indicatorScores,
        indicatorMatrix.correlationMatrix,
        marketConditions,
        [], // Would pass confluence zones
        adaptiveThresholds
      );
    } catch (error) {
      logger.error('Failed to calculate weighted confidence', { error });
      throw error;
    }
  }

  /**
   * Update analysis configuration
   */
  updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update calculator configurations
    if (newConfig.indicators?.rsi) {
      this.rsiCalculator = new RSICalculator(newConfig.indicators.rsi);
    }
    if (newConfig.indicators?.waveTrend) {
      this.waveTrendCalculator = new WaveTrendCalculator(newConfig.indicators.waveTrend);
    }
    if (newConfig.indicators?.pvt) {
      this.pvtCalculator = new PVTCalculator(newConfig.indicators.pvt);
    }
    if (newConfig.elliottWave) {
      this.elliottWaveService = new ElliottWaveService(newConfig.elliottWave);
    }

    logger.info('Updated technical analysis configuration', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  /**
   * Validate candle data
   */
  private validateCandleData(candles: CandleData[]): void {
    if (!candles || candles.length === 0) {
      throw new Error('No candle data provided');
    }

    if (candles.length < 20) {
      throw new Error('Insufficient candle data for analysis (minimum 20 candles required)');
    }

    // Validate first few candles
    for (let i = 0; i < Math.min(5, candles.length); i++) {
      const { error } = validateCandleData(candles[i]);
      if (error) {
        throw new Error(`Invalid candle data at index ${i}: ${error.message}`);
      }
    }
  }

  /**
   * Determine trend based on indicators
   */
  private determineTrend(
    rsi: number,
    waveTrend: WaveTrendData,
    recentCandles: CandleData[]
  ): 'bullish' | 'bearish' | 'sideways' {
    const signals: Array<'bullish' | 'bearish' | 'sideways'> = [];

    // RSI signal
    if (rsi > 55) signals.push('bullish');
    else if (rsi < 45) signals.push('bearish');
    else signals.push('sideways');

    // Wave Trend signal
    if (waveTrend.signal === 'buy') signals.push('bullish');
    else if (waveTrend.signal === 'sell') signals.push('bearish');
    else signals.push('sideways');

    // Price action signal
    if (recentCandles.length >= 2) {
      const priceChange = (recentCandles[recentCandles.length - 1].close - 
                          recentCandles[0].close) / recentCandles[0].close;
      if (priceChange > 0.02) signals.push('bullish');
      else if (priceChange < -0.02) signals.push('bearish');
      else signals.push('sideways');
    }

    // Determine consensus
    const bullishCount = signals.filter(s => s === 'bullish').length;
    const bearishCount = signals.filter(s => s === 'bearish').length;

    if (bullishCount > bearishCount) return 'bullish';
    if (bearishCount > bullishCount) return 'bearish';
    return 'sideways';
  }

  /**
   * Determine momentum strength
   */
  private determineMomentum(
    rsi: number,
    waveTrend: WaveTrendData
  ): 'strong' | 'weak' | 'neutral' {
    const rsiMomentum = Math.abs(rsi - 50);
    const wtMomentum = Math.abs(waveTrend.wt1 - waveTrend.wt2);

    const avgMomentum = (rsiMomentum + wtMomentum) / 2;

    if (avgMomentum > 25) return 'strong';
    if (avgMomentum < 10) return 'weak';
    return 'neutral';
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 2) return 0;

    const returns = candles.slice(1).map((candle, i) => 
      Math.log(candle.close / candles[i].close)
    );

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(indicators: TechnicalIndicators, regime: MarketRegime): number {
    let strength = 0;

    // RSI contribution
    if (indicators.trend === 'bullish' && indicators.rsi > 60) strength += 0.3;
    else if (indicators.trend === 'bearish' && indicators.rsi < 40) strength += 0.3;

    // Wave Trend contribution
    if (indicators.waveTrend.signal !== 'neutral') strength += 0.3;

    // Momentum contribution
    if (indicators.momentum === 'strong') strength += 0.2;
    else if (indicators.momentum === 'weak') strength -= 0.1;

    // Regime contribution
    if (regime.type === 'trending') strength += 0.2;

    return Math.max(0, Math.min(1, strength));
  }

  /**
   * Calculate consensus across timeframes
   */
  private calculateConsensus(
    directions: Array<'bullish' | 'bearish' | 'neutral'>,
    strengths: number[]
  ): { direction: 'bullish' | 'bearish' | 'neutral'; strength: number; confluence: number } {
    if (directions.length === 0) {
      return { direction: 'neutral', strength: 0, confluence: 0 };
    }

    const bullishCount = directions.filter(d => d === 'bullish').length;
    const bearishCount = directions.filter(d => d === 'bearish').length;
    const neutralCount = directions.filter(d => d === 'neutral').length;

    let direction: 'bullish' | 'bearish' | 'neutral';
    if (bullishCount > bearishCount && bullishCount > neutralCount) {
      direction = 'bullish';
    } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
      direction = 'bearish';
    } else {
      direction = 'neutral';
    }

    const avgStrength = strengths.reduce((sum, s) => sum + s, 0) / strengths.length;
    const confluence = Math.max(bullishCount, bearishCount, neutralCount) / directions.length;

    return {
      direction,
      strength: avgStrength,
      confluence,
    };
  }

  /**
   * Determine market conditions for adaptive analysis
   */
  private async determineMarketConditions(
    candles: CandleData[],
    indicators: TechnicalIndicators
  ): Promise<MarketConditions> {
    const volatility = this.calculateMarketVolatility(candles);
    const regime = await this.classifyMarketRegime(candles);
    const trendStrength = this.calculateTrendStrength(indicators, regime);
    const volumeProfile = this.determineVolumeProfile(candles);
    const timeOfDay = this.determineTimeOfDay();
    const marketSession = this.determineMarketSession(timeOfDay);

    return {
      volatility,
      regime,
      trendStrength,
      volumeProfile,
      timeOfDay,
      marketSession,
    };
  }

  /**
   * Calculate individual indicator scores
   */
  private async calculateIndicatorScores(indicators: TechnicalIndicators): Promise<IndicatorScore[]> {
    const scores: IndicatorScore[] = [];

    // RSI Score
    scores.push({
      indicator: 'RSI',
      score: this.calculateRSIScore(indicators.rsi),
      signal: indicators.rsi < 30 ? 'bullish' : indicators.rsi > 70 ? 'bearish' : 'neutral',
      strength: Math.abs(indicators.rsi - 50) > 20 ? 'strong' : Math.abs(indicators.rsi - 50) > 10 ? 'moderate' : 'weak',
      confidence: Math.min(1, Math.abs(indicators.rsi - 50) / 50),
      reasoning: [`RSI at ${indicators.rsi.toFixed(1)}`],
    });

    // Wave Trend Score
    scores.push({
      indicator: 'WaveTrend',
      score: this.calculateWaveTrendScore(indicators.waveTrend),
      signal: indicators.waveTrend.signal === 'buy' ? 'bullish' : indicators.waveTrend.signal === 'sell' ? 'bearish' : 'neutral',
      strength: Math.abs(indicators.waveTrend.wt1 - indicators.waveTrend.wt2) > 40 ? 'strong' : 'moderate',
      confidence: Math.min(1, Math.abs(indicators.waveTrend.wt1 - indicators.waveTrend.wt2) / 100),
      reasoning: [`Wave Trend signal: ${indicators.waveTrend.signal}`],
    });

    // Add more indicator scores as needed...

    return scores;
  }

  /**
   * Calculate RSI score
   */
  private calculateRSIScore(rsi: number): number {
    if (rsi <= 30) return 0.8 + (30 - rsi) / 30 * 0.2;
    if (rsi >= 70) return 0.8 + (rsi - 70) / 30 * 0.2;
    return 0.3 + (1 - Math.abs(rsi - 50) / 20) * 0.2;
  }

  /**
   * Calculate Wave Trend score
   */
  private calculateWaveTrendScore(waveTrend: WaveTrendData): number {
    const difference = Math.abs(waveTrend.wt1 - waveTrend.wt2);
    let score = 0.5;

    if (waveTrend.signal === 'buy' || waveTrend.signal === 'sell') {
      score = 0.7 + Math.min(0.3, difference / 100);
    }

    if (waveTrend.divergence) {
      score *= 1.2;
    }

    return Math.min(1, score);
  }

  /**
   * Determine volume profile
   */
  private determineVolumeProfile(candles: CandleData[]): 'low' | 'medium' | 'high' {
    if (candles.length < 20) return 'medium';

    const recentVolume = candles.slice(-10).reduce((sum, c) => sum + c.volume, 0) / 10;
    const historicalVolume = candles.slice(-30, -10).reduce((sum, c) => sum + c.volume, 0) / 20;

    const ratio = recentVolume / historicalVolume;

    if (ratio > 1.5) return 'high';
    if (ratio < 0.7) return 'low';
    return 'medium';
  }

  /**
   * Determine time of day (simplified - would use actual timezone logic)
   */
  private determineTimeOfDay(): 'asian' | 'london' | 'newyork' | 'overlap' {
    const hour = new Date().getUTCHours();
    
    if (hour >= 0 && hour < 8) return 'asian';
    if (hour >= 8 && hour < 13) return 'london';
    if (hour >= 13 && hour < 21) return 'newyork';
    return 'overlap';
  }

  /**
   * Determine market session activity
   */
  private determineMarketSession(timeOfDay: 'asian' | 'london' | 'newyork' | 'overlap'): 'active' | 'quiet' {
    return timeOfDay === 'overlap' || timeOfDay === 'london' || timeOfDay === 'newyork' ? 'active' : 'quiet';
  }

  /**
   * Calculate market volatility
   */
  private calculateMarketVolatility(candles: CandleData[]): number {
    if (candles.length < 20) return 0.2;

    const returns = candles.slice(1).map((candle, i) => 
      Math.log(candle.close / candles[i].close)
    );

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  /**
   * Get enhanced analysis configuration
   */
  getEnhancedConfig(): {
    thresholds: AdaptiveThresholds;
    scoringConfig: any;
    confidenceConfig: any;
  } {
    return {
      thresholds: this.thresholdManager.getCurrentThresholds(),
      scoringConfig: this.scoringMatrix.getConfig(),
      confidenceConfig: this.confidenceSystem.getConfig(),
    };
  }

  /**
   * Update enhanced analysis configuration
   */
  updateEnhancedConfig(config: {
    thresholds?: Partial<AdaptiveThresholds>;
    scoringConfig?: any;
    confidenceConfig?: any;
  }): void {
    if (config.scoringConfig) {
      this.scoringMatrix.updateConfig(config.scoringConfig);
    }
    if (config.confidenceConfig) {
      this.confidenceSystem.updateConfig(config.confidenceConfig);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(config?: Partial<AnalysisConfig>): AnalysisConfig {
    const defaultConfig: AnalysisConfig = {
      indicators: {
        rsi: { period: 14, overbought: 70, oversold: 30 },
        waveTrend: { n1: 10, n2: 21 },
        pvt: { period: 14 },
      },
      patterns: {
        minBodySize: 0.1,
        minWickRatio: 0.3,
        lookbackPeriod: 50,
      },
      elliottWave: {
        minWaveLength: 5,
        maxWaveLength: 100,
        fibonacciTolerance: 0.05,
      },
      fibonacci: {
        levels: [0.236, 0.382, 0.5, 0.618, 0.786],
        confluenceDistance: 0.01,
      },
    };

    return config ? { ...defaultConfig, ...config } : defaultConfig;
  }
}