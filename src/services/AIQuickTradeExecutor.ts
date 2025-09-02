import { EventEmitter } from 'events';
import { NKNProbabilityAnalyzer } from './NKNProbabilityAnalyzer';
import { LinearRegressionAnalyzer } from './LinearRegressionAnalyzer';
import {
    QuickTradePosition,
    QuickTradeConfig,
    QuickTradeSignal,
    MarketConditions,
    ExecutionResult,
    RiskMetrics,
    HedgeModeConfig
} from '../types/quickTrade';

export class AIQuickTradeExecutor extends EventEmitter {
    private nknAnalyzer: NKNProbabilityAnalyzer;
    private regressionAnalyzer: LinearRegressionAnalyzer;
    private activePositions: Map<string, QuickTradePosition> = new Map();
    private config: QuickTradeConfig;
    private isRunning: boolean = false;
    private executionQueue: QuickTradeSignal[] = [];
    private riskMetrics: RiskMetrics;
    private lastMarketConditions: MarketConditions | null = null;

    constructor(config: QuickTradeConfig) {
        super();
        this.config = config;
        this.nknAnalyzer = new NKNProbabilityAnalyzer();
        this.regressionAnalyzer = new LinearRegressionAnalyzer();
        this.riskMetrics = this.initializeRiskMetrics();
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error('AI Quick Trade Executor is already running');
        }

        this.isRunning = true;
        this.emit('started');

        // Start execution loop
        this.startExecutionLoop();

        console.log('AI Quick Trade Executor started');
    }

    async stop(): Promise<void> {
        this.isRunning = false;

        // Close all active positions
        await this.closeAllPositions();

        this.emit('stopped');
        console.log('AI Quick Trade Executor stopped');
    }

    async analyzeMarketConditions(priceData: number[], volumeData: number[]): Promise<MarketConditions> {
        try {
            // Validate input data
            if (priceData.length === 0 || volumeData.length === 0) {
                throw new Error('Price data and volume data cannot be empty');
            }

            // Check for invalid data
            const hasInvalidPrice = priceData.some(p => !isFinite(p) || p <= 0);
            const hasInvalidVolume = volumeData.some(v => !isFinite(v) || v < 0);

            if (hasInvalidPrice || hasInvalidVolume) {
                throw new Error('Invalid price or volume data detected');
            }

            // Prepare market features for NKN analysis
            const marketFeatures = this.extractMarketFeatures(priceData, volumeData);
            const historicalData = this.getHistoricalData();

            // Run parallel analysis
            const [nknAnalysis, regressionAnalysis, volatilityMetrics] = await Promise.all([
                this.nknAnalyzer.analyzeProbability(marketFeatures, historicalData),
                this.regressionAnalyzer.analyzeRegression(priceData),
                Promise.resolve(this.regressionAnalyzer.calculateVolatilityMetrics(priceData))
            ]);

            const currentPrice = priceData[priceData.length - 1];
            const spread = this.calculateSpread(priceData);
            const liquidity = this.calculateLiquidity(volumeData);

            const marketConditions: MarketConditions = {
                volatility: volatilityMetrics,
                trend: regressionAnalysis,
                probability: nknAnalysis,
                liquidity,
                spread,
                volume: volumeData[volumeData.length - 1] || 0,
                timestamp: Date.now()
            };

            this.lastMarketConditions = marketConditions;
            return marketConditions;
        } catch (error) {
            console.error('Market conditions analysis failed:', error);
            throw error;
        }
    }

    async generateQuickTradeSignal(
        symbol: string,
        priceData: number[],
        volumeData: number[]
    ): Promise<QuickTradeSignal | null> {
        try {
            const marketConditions = await this.analyzeMarketConditions(priceData, volumeData);

            // Check if conditions are suitable for quick trading
            if (!this.isMarketSuitableForQuickTrading(marketConditions)) {
                return null;
            }

            const { probability, trend } = marketConditions;

            // Determine trade action based on analysis
            const action = this.determineTradeAction(probability, trend);
            if (!action) return null;

            // Calculate position size based on volatility and probability
            const positionSize = this.calculateDynamicPositionSize(marketConditions);

            // Calculate target and stop loss levels
            const currentPrice = priceData[priceData.length - 1];
            const { targetPrice, stopLoss } = this.calculateLevels(currentPrice, marketConditions, action);

            // Calculate confidence and urgency
            const confidence = this.calculateSignalConfidence(marketConditions);
            const urgency = this.calculateSignalUrgency(marketConditions);

            const signal: QuickTradeSignal = {
                id: this.generateSignalId(),
                symbol,
                action,
                confidence,
                urgency,
                positionSize,
                targetPrice,
                stopLoss,
                timeToLive: this.calculateTimeToLive(marketConditions),
                marketConditions,
                nknAnalysis: probability,
                regressionAnalysis: trend
            };

            return signal;
        } catch (error) {
            console.error('Signal generation failed:', error);
            return null;
        }
    }

    async executeQuickTrade(signal: QuickTradeSignal): Promise<ExecutionResult> {
        try {
            // Pre-execution checks
            if (!this.canExecuteTrade(signal)) {
                return {
                    success: false,
                    executedPrice: 0,
                    executedSize: 0,
                    slippage: 0,
                    latency: 0,
                    error: 'Trade execution not allowed',
                    timestamp: Date.now()
                };
            }

            const startTime = Date.now();

            // Execute the trade
            const executionResult = await this.performTradeExecution(signal);

            if (executionResult.success) {
                // Create position record
                const position = this.createPosition(signal, executionResult);
                this.activePositions.set(position.id, position);

                // Check if hedge mode should be activated
                if (this.config.hedgeMode.enabled) {
                    await this.checkHedgeModeActivation(position);
                }

                // Update risk metrics
                this.updateRiskMetrics(position);

                this.emit('positionOpened', position);
            }

            return executionResult;
        } catch (error) {
            console.error('Trade execution failed:', error);
            return {
                success: false,
                executedPrice: 0,
                executedSize: 0,
                slippage: 0,
                latency: Date.now() - Date.now(),
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    private async performTradeExecution(signal: QuickTradeSignal): Promise<ExecutionResult> {
        // Simulate trade execution (in real implementation, would call exchange API)
        const executionLatency = Math.random() * 100 + 50; // 50-150ms
        const slippage = Math.random() * 0.001; // 0-0.1% slippage

        await new Promise(resolve => setTimeout(resolve, executionLatency));

        const executedPrice = signal.targetPrice * (1 + (Math.random() - 0.5) * slippage);
        const executedSize = signal.positionSize;

        return {
            success: true,
            executedPrice,
            executedSize,
            slippage: Math.abs(executedPrice - signal.targetPrice) / signal.targetPrice,
            latency: executionLatency,
            timestamp: Date.now()
        };
    }

    private async checkHedgeModeActivation(position: QuickTradePosition): Promise<void> {
        try {
            const hedgeConfig = this.config.hedgeMode;

            // Check if hedge activation conditions are met
            if (this.shouldActivateHedge(position, hedgeConfig)) {
                await this.activateHedgeMode(position);
            }
        } catch (error) {
            console.error('Hedge mode activation failed:', error);
        }
    }

    private shouldActivateHedge(position: QuickTradePosition, config: HedgeModeConfig): boolean {
        // Check unrealized P&L threshold
        const pnlThreshold = position.entryPrice * config.activationThreshold;
        if (Math.abs(position.unrealizedPnL) < pnlThreshold) {
            return false;
        }

        // Check maximum hedge positions
        const hedgePositions = Array.from(this.activePositions.values())
            .filter(p => p.hedgePositionId);
        if (hedgePositions.length >= config.maxHedgePositions) {
            return false;
        }

        // Check market conditions
        if (!this.lastMarketConditions) {
            return false;
        }

        const volatility = this.lastMarketConditions.volatility.currentVolatility;
        return volatility > 0.02; // Only hedge in volatile conditions
    }

    private async activateHedgeMode(position: QuickTradePosition): Promise<void> {
        try {
            const hedgeConfig = this.config.hedgeMode;

            // Create hedge signal
            const hedgeSignal: QuickTradeSignal = {
                id: this.generateSignalId(),
                symbol: position.symbol,
                action: position.side === 'long' ? 'enter_short' : 'enter_long',
                confidence: 0.8,
                urgency: 'high',
                positionSize: position.size * hedgeConfig.hedgeRatio,
                targetPrice: position.currentPrice,
                stopLoss: position.side === 'long' ?
                    position.currentPrice * 1.02 :
                    position.currentPrice * 0.98,
                timeToLive: 60000, // 1 minute
                marketConditions: this.lastMarketConditions!,
                nknAnalysis: this.lastMarketConditions!.probability,
                regressionAnalysis: this.lastMarketConditions!.trend
            };

            // Execute hedge with delay
            setTimeout(async () => {
                const hedgeResult = await this.executeQuickTrade(hedgeSignal);
                if (hedgeResult.success) {
                    // Link positions
                    const hedgePosition = Array.from(this.activePositions.values())
                        .find(p => p.id !== position.id && !p.hedgePositionId);

                    if (hedgePosition) {
                        position.hedgePositionId = hedgePosition.id;
                        hedgePosition.hedgePositionId = position.id;
                        this.emit('hedgeActivated', { original: position, hedge: hedgePosition });
                    }
                }
            }, hedgeConfig.hedgeDelayMs);

        } catch (error) {
            console.error('Hedge activation failed:', error);
        }
    }

    private extractMarketFeatures(priceData: number[], volumeData: number[]): number[] {
        const features = [];

        if (priceData.length >= 2) {
            // Price features
            const currentPrice = priceData[priceData.length - 1];
            const previousPrice = priceData[priceData.length - 2];
            const priceChange = (currentPrice - previousPrice) / previousPrice;

            features.push(
                currentPrice,
                priceChange,
                this.calculateSMA(priceData, 5),
                this.calculateSMA(priceData, 20),
                this.calculateRSI(priceData),
                this.calculateMACD(priceData)
            );
        } else {
            features.push(0, 0, 0, 0, 50, 0);
        }

        if (volumeData.length >= 1) {
            // Volume features
            const currentVolume = volumeData[volumeData.length - 1];
            const avgVolume = this.calculateSMA(volumeData, 10);

            features.push(
                currentVolume,
                avgVolume > 0 ? currentVolume / avgVolume : 1,
                this.calculateVolumeOscillator(volumeData)
            );
        } else {
            features.push(0, 1, 0);
        }

        // Market microstructure features
        features.push(
            this.calculateSpread(priceData),
            this.calculateLiquidity(volumeData),
            Date.now() % 86400000 / 86400000 // Time of day normalized
        );

        return features;
    }

    private calculateSMA(data: number[], period: number): number {
        if (data.length < period) return data[data.length - 1] || 0;
        const slice = data.slice(-period);
        return slice.reduce((sum, val) => sum + val, 0) / slice.length;
    }

    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) return 50;

        const gains = [];
        const losses = [];

        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? -change : 0);
        }

        const avgGain = this.calculateSMA(gains.slice(-period), period);
        const avgLoss = this.calculateSMA(losses.slice(-period), period);

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateMACD(prices: number[]): number {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        return ema12 - ema26;
    }

    private calculateEMA(data: number[], period: number): number {
        if (data.length === 0) return 0;
        if (data.length === 1) return data[0];

        const multiplier = 2 / (period + 1);
        let ema = data[0];

        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }

        return ema;
    }

    private calculateVolumeOscillator(volumeData: number[]): number {
        const shortMA = this.calculateSMA(volumeData, 5);
        const longMA = this.calculateSMA(volumeData, 20);
        return longMA > 0 ? (shortMA - longMA) / longMA : 0;
    }

    private calculateSpread(priceData: number[]): number {
        // Simplified spread calculation
        if (priceData.length < 2) return 0;
        const volatility = this.regressionAnalyzer.calculateVolatilityMetrics(priceData);
        return volatility.currentVolatility * 0.1; // Approximate spread
    }

    private calculateLiquidity(volumeData: number[]): number {
        if (volumeData.length === 0) return 0;

        // Filter out invalid volume data
        const validVolumes = volumeData.filter(v => isFinite(v) && v >= 0);
        if (validVolumes.length === 0) return 0;

        const avgVolume = this.calculateSMA(validVolumes, Math.min(20, validVolumes.length));
        const currentVolume = validVolumes[validVolumes.length - 1];
        return avgVolume > 0 ? currentVolume / avgVolume : 1;
    }

    private getHistoricalData(): number[][] {
        // Return historical market data for NKN training
        return []; // Placeholder
    }

    private isMarketSuitableForQuickTrading(conditions: MarketConditions): boolean {
        const { probability, volatility, trend } = conditions;

        // Check minimum probability threshold
        if (probability.confidenceScore < this.config.minProbabilityThreshold) {
            return false;
        }

        // Check volatility is not too high
        if (volatility.currentVolatility > 0.05) {
            return false;
        }

        // Check trend strength
        if (trend.trendStrength < this.config.minTrendStrength) {
            return false;
        }

        return true;
    }

    private determineTradeAction(
        probability: any,
        trend: any
    ): 'enter_long' | 'enter_short' | null {
        const entryThreshold = 0.6;

        if (probability.entryProbability > entryThreshold) {
            return trend.directionalBias === 'bullish' ? 'enter_long' : 'enter_short';
        }

        return null;
    }

    private calculateDynamicPositionSize(conditions: MarketConditions): number {
        const baseSize = this.config.maxPositionSize * 0.1; // Start with 10% of max
        const volatilityAdjustment = 1 / (1 + conditions.volatility.currentVolatility * 10);
        const probabilityAdjustment = conditions.probability.confidenceScore;

        return Math.min(
            this.config.maxPositionSize,
            baseSize * volatilityAdjustment * probabilityAdjustment
        );
    }

    private calculateLevels(
        currentPrice: number,
        conditions: MarketConditions,
        action: 'enter_long' | 'enter_short'
    ): { targetPrice: number; stopLoss: number } {
        const atr = conditions.volatility.atr;
        const multiplier = 2;

        if (action === 'enter_long') {
            return {
                targetPrice: currentPrice + (atr * multiplier),
                stopLoss: currentPrice - (atr * multiplier * 0.5)
            };
        } else {
            return {
                targetPrice: currentPrice - (atr * multiplier),
                stopLoss: currentPrice + (atr * multiplier * 0.5)
            };
        }
    }

    private calculateSignalConfidence(conditions: MarketConditions): number {
        const probabilityWeight = 0.4;
        const trendWeight = 0.3;
        const volatilityWeight = 0.3;

        const probabilityScore = conditions.probability.confidenceScore;
        const trendScore = conditions.trend.trendStrength;
        const volatilityScore = 1 - Math.min(1, conditions.volatility.currentVolatility * 20);

        return (probabilityScore * probabilityWeight) +
            (trendScore * trendWeight) +
            (volatilityScore * volatilityWeight);
    }

    private calculateSignalUrgency(conditions: MarketConditions): 'low' | 'medium' | 'high' {
        const volatility = conditions.volatility.currentVolatility;
        const probability = conditions.probability.entryProbability;

        if (volatility > 0.03 || probability > 0.8) {
            return 'high';
        } else if (volatility > 0.02 || probability > 0.65) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    private calculateTimeToLive(conditions: MarketConditions): number {
        const baseTime = 300000; // 5 minutes
        const volatilityFactor = 1 + conditions.volatility.currentVolatility * 5;
        return Math.floor(baseTime / volatilityFactor);
    }

    private canExecuteTrade(signal: QuickTradeSignal): boolean {
        try {
            // Validate signal
            if (!signal || !signal.symbol || signal.positionSize <= 0) {
                return false;
            }

            // Check maximum concurrent positions
            if (this.activePositions.size >= this.config.maxConcurrentPositions) {
                return false;
            }

            // Check risk limits
            const totalExposure = this.calculateTotalExposure();
            if (totalExposure + signal.positionSize > this.config.maxPositionSize * this.config.maxConcurrentPositions) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking trade execution eligibility:', error);
            return false;
        }
    }

    private createPosition(signal: QuickTradeSignal, execution: ExecutionResult): QuickTradePosition {
        return {
            id: this.generatePositionId(),
            symbol: signal.symbol,
            side: signal.action === 'enter_long' ? 'long' : 'short',
            size: execution.executedSize,
            entryPrice: execution.executedPrice,
            currentPrice: execution.executedPrice,
            unrealizedPnL: 0,
            entryTime: Date.now(),
            probabilityScore: signal.confidence,
            riskScore: signal.marketConditions.probability.riskScore,
            targetPrice: signal.targetPrice,
            stopLoss: signal.stopLoss
        };
    }

    private calculateTotalExposure(): number {
        return Array.from(this.activePositions.values())
            .reduce((total, position) => total + position.size, 0);
    }

    private async startExecutionLoop(): Promise<void> {
        const executionLoop = async () => {
            while (this.isRunning) {
                try {
                    // Process execution queue
                    if (this.executionQueue.length > 0) {
                        const signal = this.executionQueue.shift()!;
                        await this.executeQuickTrade(signal);
                    }

                    // Update positions
                    await this.updatePositions();

                    // Check exit conditions
                    await this.checkExitConditions();

                    // Update risk metrics
                    this.updateRiskMetrics();

                    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms loop
                } catch (error) {
                    console.error('Execution loop error:', error);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay on error
                }
            }
        };

        // Start the loop without blocking
        setImmediate(executionLoop);
    }

    private async updatePositions(): Promise<void> {
        // Update current prices and P&L for all positions
        for (const position of this.activePositions.values()) {
            // In real implementation, would fetch current market price
            const currentPrice = position.entryPrice * (1 + (Math.random() - 0.5) * 0.01);
            position.currentPrice = currentPrice;

            const priceDiff = currentPrice - position.entryPrice;
            position.unrealizedPnL = position.side === 'long' ?
                priceDiff * position.size :
                -priceDiff * position.size;
        }
    }

    private async checkExitConditions(): Promise<void> {
        for (const position of this.activePositions.values()) {
            let shouldExit = false;
            let exitReason = '';

            // Check stop loss
            if (position.stopLoss) {
                const hitStopLoss = position.side === 'long' ?
                    position.currentPrice <= position.stopLoss :
                    position.currentPrice >= position.stopLoss;

                if (hitStopLoss) {
                    shouldExit = true;
                    exitReason = 'stop_loss';
                }
            }

            // Check target price
            if (position.targetPrice && !shouldExit) {
                const hitTarget = position.side === 'long' ?
                    position.currentPrice >= position.targetPrice :
                    position.currentPrice <= position.targetPrice;

                if (hitTarget) {
                    shouldExit = true;
                    exitReason = 'target_reached';
                }
            }

            if (shouldExit) {
                await this.closePosition(position.id, exitReason);
            }
        }
    }

    private async closePosition(positionId: string, reason: string): Promise<void> {
        const position = this.activePositions.get(positionId);
        if (!position) return;

        try {
            // Execute closing trade
            const closeResult = await this.performTradeExecution({
                id: this.generateSignalId(),
                symbol: position.symbol,
                action: position.side === 'long' ? 'enter_short' : 'enter_long',
                confidence: 1,
                urgency: 'high',
                positionSize: position.size,
                targetPrice: position.currentPrice,
                stopLoss: 0,
                timeToLive: 30000,
                marketConditions: this.lastMarketConditions!,
                nknAnalysis: this.lastMarketConditions!.probability,
                regressionAnalysis: this.lastMarketConditions!.trend
            });

            if (closeResult.success) {
                // Calculate final P&L
                const finalPnL = position.side === 'long' ?
                    (closeResult.executedPrice - position.entryPrice) * position.size :
                    (position.entryPrice - closeResult.executedPrice) * position.size;

                this.activePositions.delete(positionId);

                // Close hedge position if exists
                if (position.hedgePositionId) {
                    await this.closePosition(position.hedgePositionId, 'hedge_close');
                }

                this.emit('positionClosed', {
                    position,
                    finalPnL,
                    reason,
                    closePrice: closeResult.executedPrice
                });
            }
        } catch (error) {
            console.error('Position close failed:', error);
        }
    }

    private async closeAllPositions(): Promise<void> {
        const positionIds = Array.from(this.activePositions.keys());
        await Promise.all(
            positionIds.map(id => this.closePosition(id, 'system_shutdown'))
        );
    }

    private updateRiskMetrics(position?: QuickTradePosition): void {
        const positions = Array.from(this.activePositions.values());

        if (positions.length === 0) {
            this.riskMetrics = this.initializeRiskMetrics();
            return;
        }

        const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
        const totalExposure = positions.reduce((sum, p) => sum + p.size * p.currentPrice, 0);

        this.riskMetrics = {
            totalExposure,
            maxDrawdown: Math.min(0, totalPnL),
            sharpeRatio: this.calculateSharpeRatio(positions),
            winRate: this.calculateWinRate(positions),
            averageWin: this.calculateAverageWin(positions),
            averageLoss: this.calculateAverageLoss(positions),
            profitFactor: this.calculateProfitFactor(positions),
            maxConsecutiveLosses: this.calculateMaxConsecutiveLosses(positions)
        };
    }

    private calculateSharpeRatio(positions: QuickTradePosition[]): number {
        // Simplified Sharpe ratio calculation
        const returns = positions.map(p => p.unrealizedPnL / (p.size * p.entryPrice));
        if (returns.length === 0) return 0;

        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        );

        return stdDev > 0 ? avgReturn / stdDev : 0;
    }

    private calculateWinRate(positions: QuickTradePosition[]): number {
        const winners = positions.filter(p => p.unrealizedPnL > 0).length;
        return positions.length > 0 ? winners / positions.length : 0;
    }

    private calculateAverageWin(positions: QuickTradePosition[]): number {
        const winners = positions.filter(p => p.unrealizedPnL > 0);
        return winners.length > 0 ?
            winners.reduce((sum, p) => sum + p.unrealizedPnL, 0) / winners.length : 0;
    }

    private calculateAverageLoss(positions: QuickTradePosition[]): number {
        const losers = positions.filter(p => p.unrealizedPnL < 0);
        return losers.length > 0 ?
            losers.reduce((sum, p) => sum + p.unrealizedPnL, 0) / losers.length : 0;
    }

    private calculateProfitFactor(positions: QuickTradePosition[]): number {
        const totalWins = positions.filter(p => p.unrealizedPnL > 0)
            .reduce((sum, p) => sum + p.unrealizedPnL, 0);
        const totalLosses = Math.abs(positions.filter(p => p.unrealizedPnL < 0)
            .reduce((sum, p) => sum + p.unrealizedPnL, 0));

        return totalLosses > 0 ? totalWins / totalLosses : 0;
    }

    private calculateMaxConsecutiveLosses(positions: QuickTradePosition[]): number {
        // Simplified calculation
        let maxConsecutive = 0;
        let current = 0;

        for (const position of positions) {
            if (position.unrealizedPnL < 0) {
                current++;
                maxConsecutive = Math.max(maxConsecutive, current);
            } else {
                current = 0;
            }
        }

        return maxConsecutive;
    }

    private initializeRiskMetrics(): RiskMetrics {
        return {
            totalExposure: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            winRate: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            maxConsecutiveLosses: 0
        };
    }

    private generateSignalId(): string {
        return `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generatePositionId(): string {
        return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public getters
    getActivePositions(): QuickTradePosition[] {
        return Array.from(this.activePositions.values());
    }

    getRiskMetrics(): RiskMetrics {
        return { ...this.riskMetrics };
    }

    getConfig(): QuickTradeConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<QuickTradeConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.emit('configUpdated', this.config);
    }

    addSignalToQueue(signal: QuickTradeSignal): void {
        this.executionQueue.push(signal);
    }

    getQueueLength(): number {
        return this.executionQueue.length;
    }
}