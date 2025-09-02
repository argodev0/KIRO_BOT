/**
 * Neural Kolmogorov-Arnold Network (NKN)
 * Advanced neural network implementation for pattern recognition and probability analysis
 */

import { CandleData } from '../../types/market';

export interface NKNPrediction {
  timestamp: number;
  predictedPrice: number;
  probability: number;
  confidence: number;
  horizon: number;
}

export interface NKNPatternResult {
  pattern: string;
  probability: number;
  confidence: number;
  description: string;
  timeframe: number;
}

export interface NKNConfig {
  enabled: boolean;
  networkDepth: number;
  trainingPeriod: number;
  predictionHorizon: number;
  confidenceThreshold: number;
}

export interface NeuralLayer {
  weights: number[][];
  biases: number[];
  activationFunction: 'sigmoid' | 'tanh' | 'relu' | 'kolmogorov';
}

export interface TrainingData {
  inputs: number[][];
  outputs: number[][];
  validation: {
    inputs: number[][];
    outputs: number[][];
  };
}

export interface NetworkState {
  layers: NeuralLayer[];
  trainingEpochs: number;
  lastTrainingError: number;
  convergenceRate: number;
}

export class NeuralKolmogorovArnoldNetwork {
  private config: NKNConfig;
  private networkState: NetworkState | null = null;
  private trainingHistory: number[] = [];
  private featureScalers: { mean: number; std: number }[] = [];

  constructor(config: NKNConfig) {
    this.config = config;
    
    if (this.config.enabled) {
      this.initializeNetwork();
    }
  }

  /**
   * Generate price predictions using the trained network
   */
  async generatePredictions(candles: CandleData[]): Promise<NKNPrediction[]> {
    if (!this.config.enabled || !this.networkState) {
      return [];
    }

    if (candles.length < this.config.trainingPeriod) {
      throw new Error(`Insufficient data for NKN predictions. Need at least ${this.config.trainingPeriod} candles`);
    }

    // Prepare input features
    const features = this.extractFeatures(candles);
    const normalizedFeatures = this.normalizeFeatures(features);

    const predictions: NKNPrediction[] = [];
    const currentTime = candles[candles.length - 1].timestamp;
    const timeStep = candles[1]?.timestamp - candles[0]?.timestamp || 3600000; // Default 1 hour

    // Generate predictions for multiple time horizons
    for (let i = 1; i <= this.config.predictionHorizon; i++) {
      const inputVector = normalizedFeatures.slice(-this.getInputSize()).flat();
      const prediction = this.forwardPass(inputVector);
      
      const predictedPrice = this.denormalizePrice(prediction[0], candles);
      const probability = this.calculatePredictionProbability(prediction, candles);
      const confidence = this.calculatePredictionConfidence(prediction, i);

      predictions.push({
        timestamp: currentTime + (i * timeStep),
        predictedPrice,
        probability,
        confidence,
        horizon: i,
      });
    }

    return predictions;
  }

  /**
   * Recognize patterns using the neural network
   */
  async recognizePatterns(candles: CandleData[]): Promise<NKNPatternResult[]> {
    if (!this.config.enabled || !this.networkState) {
      return [];
    }

    const patterns: NKNPatternResult[] = [];
    const features = this.extractFeatures(candles);
    const normalizedFeatures = this.normalizeFeatures(features);

    // Analyze different pattern types
    const patternTypes = [
      'trend_continuation',
      'trend_reversal',
      'breakout',
      'consolidation',
      'momentum_shift',
      'volatility_expansion',
      'volatility_contraction',
    ];

    for (const patternType of patternTypes) {
      const patternVector = this.createPatternVector(normalizedFeatures, patternType);
      const output = this.forwardPass(patternVector);
      
      const probability = this.sigmoid(output[0]);
      const confidence = this.calculatePatternConfidence(output, patternType);

      if (probability > this.config.confidenceThreshold) {
        patterns.push({
          pattern: patternType,
          probability,
          confidence,
          description: this.getPatternDescription(patternType, probability),
          timeframe: this.estimatePatternTimeframe(patternType, candles),
        });
      }
    }

    return patterns.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Calculate overall confidence score for the network's current state
   */
  async calculateConfidenceScore(candles: CandleData[]): Promise<number> {
    if (!this.config.enabled || !this.networkState) {
      return 0;
    }

    let confidenceScore = 0.5; // Base confidence

    // Training quality
    const trainingQuality = this.assessTrainingQuality();
    confidenceScore += trainingQuality * 0.3;

    // Data quality
    const dataQuality = this.assessDataQuality(candles);
    confidenceScore += dataQuality * 0.2;

    // Network stability
    const networkStability = this.assessNetworkStability();
    confidenceScore += networkStability * 0.2;

    // Recent performance
    const recentPerformance = await this.assessRecentPerformance(candles);
    confidenceScore += recentPerformance * 0.3;

    return Math.min(confidenceScore, 1.0);
  }

  /**
   * Train the network with new data
   */
  async trainNetwork(candles: CandleData[]): Promise<{
    epochs: number;
    finalError: number;
    convergenceRate: number;
    trainingTime: number;
  }> {
    if (!this.config.enabled) {
      throw new Error('NKN is disabled');
    }

    const startTime = Date.now();
    
    // Prepare training data
    const trainingData = this.prepareTrainingData(candles);
    
    // Initialize network if not already done
    if (!this.networkState) {
      this.initializeNetwork();
    }

    // Training parameters
    let learningRate = 0.001;
    const maxEpochs = 1000;
    const targetError = 0.001;
    const batchSize = 32;

    let epoch = 0;
    let currentError = Infinity;
    const errorHistory: number[] = [];

    // Training loop
    while (epoch < maxEpochs && currentError > targetError) {
      let epochError = 0;
      const batches = this.createBatches(trainingData.inputs, trainingData.outputs, batchSize);

      for (const batch of batches) {
        const batchError = this.trainBatch(batch.inputs, batch.outputs, learningRate);
        epochError += batchError;
      }

      currentError = epochError / batches.length;
      errorHistory.push(currentError);
      
      // Validate on validation set
      if (epoch % 10 === 0) {
        const validationError = this.validateNetwork(trainingData.validation);
        if (validationError > currentError * 2) {
          // Potential overfitting, reduce learning rate
          learningRate *= 0.9;
        }
      }

      epoch++;
    }

    // Update network state
    this.networkState!.trainingEpochs = epoch;
    this.networkState!.lastTrainingError = currentError;
    this.networkState!.convergenceRate = this.calculateConvergenceRate(errorHistory);
    this.trainingHistory = errorHistory;

    const trainingTime = Date.now() - startTime;

    return {
      epochs: epoch,
      finalError: currentError,
      convergenceRate: this.networkState!.convergenceRate,
      trainingTime,
    };
  }

  // Private methods

  private initializeNetwork(): void {
    const inputSize = this.getInputSize();
    const hiddenSizes = this.getHiddenSizes();
    const outputSize = 1;

    const layers: NeuralLayer[] = [];

    // Input to first hidden layer
    layers.push(this.createLayer(inputSize, hiddenSizes[0], 'kolmogorov'));

    // Hidden layers
    for (let i = 1; i < hiddenSizes.length; i++) {
      layers.push(this.createLayer(hiddenSizes[i - 1], hiddenSizes[i], 'kolmogorov'));
    }

    // Output layer
    layers.push(this.createLayer(hiddenSizes[hiddenSizes.length - 1], outputSize, 'sigmoid'));

    this.networkState = {
      layers,
      trainingEpochs: 0,
      lastTrainingError: Infinity,
      convergenceRate: 0,
    };
  }

  private createLayer(inputSize: number, outputSize: number, activation: NeuralLayer['activationFunction']): NeuralLayer {
    const weights: number[][] = [];
    const biases: number[] = [];

    // Initialize weights using Xavier initialization
    const limit = Math.sqrt(6 / (inputSize + outputSize));

    for (let i = 0; i < outputSize; i++) {
      weights[i] = [];
      for (let j = 0; j < inputSize; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * limit;
      }
      biases[i] = (Math.random() * 2 - 1) * 0.1;
    }

    return {
      weights,
      biases,
      activationFunction: activation,
    };
  }

  private extractFeatures(candles: CandleData[]): number[][] {
    const features: number[][] = [];
    const windowSize = 20;

    for (let i = windowSize; i < candles.length; i++) {
      const window = candles.slice(i - windowSize, i);
      const featureVector = this.calculateFeatureVector(window);
      features.push(featureVector);
    }

    return features;
  }

  private calculateFeatureVector(candles: CandleData[]): number[] {
    const features: number[] = [];

    // Price features
    const prices = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // Basic price statistics
    features.push(prices[prices.length - 1]); // Current price
    features.push(this.calculateMean(prices));
    features.push(this.calculateStandardDeviation(prices));
    features.push(Math.max(...highs));
    features.push(Math.min(...lows));

    // Technical indicators
    features.push(this.calculateRSI(prices));
    features.push(this.calculateMACD(prices));
    features.push(this.calculateBollingerPosition(prices));

    // Volume features
    features.push(this.calculateMean(volumes));
    features.push(this.calculateVolumeRatio(volumes));

    // Price action features
    features.push(this.calculateTrendStrength(prices));
    features.push(this.calculateVolatility(prices));
    features.push(this.calculateMomentum(prices));

    // Pattern features
    features.push(this.calculatePatternScore(candles, 'doji'));
    features.push(this.calculatePatternScore(candles, 'hammer'));
    features.push(this.calculatePatternScore(candles, 'engulfing'));

    return features;
  }

  private normalizeFeatures(features: number[][]): number[][] {
    if (features.length === 0) return [];

    const featureCount = features[0].length;
    
    // Calculate or use existing scalers
    if (this.featureScalers.length === 0) {
      for (let i = 0; i < featureCount; i++) {
        const values = features.map(f => f[i]);
        const mean = this.calculateMean(values);
        const std = this.calculateStandardDeviation(values);
        this.featureScalers.push({ mean, std: std || 1 });
      }
    }

    // Normalize features
    return features.map(featureVector =>
      featureVector.map((value, i) => {
        const scaler = this.featureScalers[i];
        return (value - scaler.mean) / scaler.std;
      })
    );
  }

  private forwardPass(input: number[]): number[] {
    if (!this.networkState) {
      throw new Error('Network not initialized');
    }

    let activation = input;

    for (const layer of this.networkState.layers) {
      activation = this.layerForward(activation, layer);
    }

    return activation;
  }

  private layerForward(input: number[], layer: NeuralLayer): number[] {
    const output: number[] = [];

    for (let i = 0; i < layer.weights.length; i++) {
      let sum = layer.biases[i];
      
      for (let j = 0; j < input.length; j++) {
        sum += input[j] * layer.weights[i][j];
      }

      output[i] = this.applyActivation(sum, layer.activationFunction);
    }

    return output;
  }

  private applyActivation(x: number, activation: NeuralLayer['activationFunction']): number {
    switch (activation) {
      case 'sigmoid':
        return this.sigmoid(x);
      case 'tanh':
        return Math.tanh(x);
      case 'relu':
        return Math.max(0, x);
      case 'kolmogorov':
        return this.kolmogorovActivation(x);
      default:
        return x;
    }
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private kolmogorovActivation(x: number): number {
    // Kolmogorov-Arnold representation using spline-like activation
    const segments = 5;
    const segmentSize = 2 / segments;
    const normalizedX = Math.max(-1, Math.min(1, x));
    
    const segmentIndex = Math.floor((normalizedX + 1) / segmentSize);
    const localX = (normalizedX + 1) % segmentSize;
    
    // Cubic spline approximation
    const t = localX / segmentSize;
    const t2 = t * t;
    const t3 = t2 * t;
    
    return t3 - 2 * t2 + t;
  }

  private prepareTrainingData(candles: CandleData[]): TrainingData {
    const features = this.extractFeatures(candles);
    const normalizedFeatures = this.normalizeFeatures(features);
    
    const inputs: number[][] = [];
    const outputs: number[][] = [];

    // Create input-output pairs for supervised learning
    for (let i = 0; i < normalizedFeatures.length - 1; i++) {
      inputs.push(normalizedFeatures[i]);
      
      // Target is the next price movement (normalized)
      const currentPrice = candles[i + this.getInputSize()].close;
      const nextPrice = candles[i + this.getInputSize() + 1].close;
      const priceChange = (nextPrice - currentPrice) / currentPrice;
      
      outputs.push([this.sigmoid(priceChange * 10)]); // Scale and normalize
    }

    // Split into training and validation sets
    const splitIndex = Math.floor(inputs.length * 0.8);
    
    return {
      inputs: inputs.slice(0, splitIndex),
      outputs: outputs.slice(0, splitIndex),
      validation: {
        inputs: inputs.slice(splitIndex),
        outputs: outputs.slice(splitIndex),
      },
    };
  }

  private trainBatch(inputs: number[][], outputs: number[][], learningRate: number): number {
    let totalError = 0;

    for (let i = 0; i < inputs.length; i++) {
      const predicted = this.forwardPass(inputs[i]);
      const target = outputs[i];
      
      // Calculate error
      const error = this.calculateMeanSquaredError(predicted, target);
      totalError += error;
      
      // Backpropagation (simplified)
      this.backpropagate(inputs[i], predicted, target, learningRate);
    }

    return totalError / inputs.length;
  }

  private backpropagate(input: number[], predicted: number[], target: number[], learningRate: number): void {
    if (!this.networkState) return;

    // Simplified backpropagation for demonstration
    // In a full implementation, this would include proper gradient calculation
    const outputError = predicted.map((p, i) => target[i] - p);
    
    // Update output layer weights (simplified)
    const outputLayer = this.networkState.layers[this.networkState.layers.length - 1];
    for (let i = 0; i < outputLayer.weights.length; i++) {
      for (let j = 0; j < outputLayer.weights[i].length; j++) {
        outputLayer.weights[i][j] += learningRate * outputError[i] * input[j];
      }
      outputLayer.biases[i] += learningRate * outputError[i];
    }
  }

  private validateNetwork(validation: { inputs: number[][]; outputs: number[][] }): number {
    let totalError = 0;

    for (let i = 0; i < validation.inputs.length; i++) {
      const predicted = this.forwardPass(validation.inputs[i]);
      const error = this.calculateMeanSquaredError(predicted, validation.outputs[i]);
      totalError += error;
    }

    return totalError / validation.inputs.length;
  }

  private createBatches(inputs: number[][], outputs: number[][], batchSize: number): Array<{ inputs: number[][]; outputs: number[][] }> {
    const batches = [];
    
    for (let i = 0; i < inputs.length; i += batchSize) {
      batches.push({
        inputs: inputs.slice(i, i + batchSize),
        outputs: outputs.slice(i, i + batchSize),
      });
    }

    return batches;
  }

  private calculateMeanSquaredError(predicted: number[], target: number[]): number {
    let sum = 0;
    for (let i = 0; i < predicted.length; i++) {
      const diff = predicted[i] - target[i];
      sum += diff * diff;
    }
    return sum / predicted.length;
  }

  private calculateConvergenceRate(errorHistory: number[]): number {
    if (errorHistory.length < 10) return 0;

    const recent = errorHistory.slice(-10);
    const older = errorHistory.slice(-20, -10);
    
    const recentAvg = this.calculateMean(recent);
    const olderAvg = this.calculateMean(older);
    
    return Math.max(0, (olderAvg - recentAvg) / olderAvg);
  }

  // Helper methods for feature calculation

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): number {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12 - ema26;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices[prices.length - period];

    for (let i = prices.length - period + 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  private calculateBollingerPosition(prices: number[]): number {
    const period = 20;
    if (prices.length < period) return 0.5;

    const recentPrices = prices.slice(-period);
    const mean = this.calculateMean(recentPrices);
    const std = this.calculateStandardDeviation(recentPrices);
    
    const currentPrice = prices[prices.length - 1];
    const upperBand = mean + (2 * std);
    const lowerBand = mean - (2 * std);
    
    return (currentPrice - lowerBand) / (upperBand - lowerBand);
  }

  private calculateVolumeRatio(volumes: number[]): number {
    if (volumes.length < 10) return 1;

    const recentVolume = this.calculateMean(volumes.slice(-5));
    const historicalVolume = this.calculateMean(volumes.slice(-15, -5));
    
    return recentVolume / historicalVolume;
  }

  private calculateTrendStrength(prices: number[]): number {
    if (prices.length < 10) return 0;

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = (lastPrice - firstPrice) / firstPrice;
    
    return Math.tanh(priceChange * 10); // Normalize to [-1, 1]
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = prices.slice(1).map((price, i) => 
      Math.log(price / prices[i])
    );

    return this.calculateStandardDeviation(returns);
  }

  private calculateMomentum(prices: number[]): number {
    if (prices.length < 10) return 0;

    const period = Math.min(10, prices.length - 1);
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 1 - period];
    
    return (currentPrice - pastPrice) / pastPrice;
  }

  private calculatePatternScore(candles: CandleData[], patternType: string): number {
    // Simplified pattern scoring
    const lastCandle = candles[candles.length - 1];
    const bodySize = Math.abs(lastCandle.close - lastCandle.open);
    const totalRange = lastCandle.high - lastCandle.low;
    
    switch (patternType) {
      case 'doji':
        return totalRange > 0 ? 1 - (bodySize / totalRange) : 0;
      case 'hammer':
        const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
        return totalRange > 0 ? lowerWick / totalRange : 0;
      case 'engulfing':
        if (candles.length < 2) return 0;
        const prevCandle = candles[candles.length - 2];
        const prevBodySize = Math.abs(prevCandle.close - prevCandle.open);
        return bodySize > prevBodySize ? 1 : 0;
      default:
        return 0;
    }
  }

  private getInputSize(): number {
    return 15; // Number of features in feature vector
  }

  private getHiddenSizes(): number[] {
    return [32, 16, 8]; // Hidden layer sizes based on network depth
  }

  private denormalizePrice(normalizedPrice: number, candles: CandleData[]): number {
    const recentPrices = candles.slice(-20).map(c => c.close);
    const mean = this.calculateMean(recentPrices);
    const std = this.calculateStandardDeviation(recentPrices);
    
    return (normalizedPrice * std) + mean;
  }

  private calculatePredictionProbability(prediction: number[], candles: CandleData[]): number {
    // Convert network output to probability
    return Math.min(Math.max(prediction[0], 0), 1);
  }

  private calculatePredictionConfidence(prediction: number[], horizon: number): number {
    let confidence = prediction[0];
    
    // Reduce confidence for longer horizons
    confidence *= Math.exp(-horizon * 0.1);
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  private createPatternVector(features: number[][], patternType: string): number[] {
    if (features.length === 0) return [];

    // Use the most recent feature vector
    const baseVector = features[features.length - 1];
    
    // Add pattern-specific features
    const patternFeatures = this.getPatternSpecificFeatures(patternType);
    
    return [...baseVector, ...patternFeatures];
  }

  private getPatternSpecificFeatures(patternType: string): number[] {
    // Pattern-specific feature encoding
    const features = new Array(7).fill(0);
    
    switch (patternType) {
      case 'trend_continuation':
        features[0] = 1;
        break;
      case 'trend_reversal':
        features[1] = 1;
        break;
      case 'breakout':
        features[2] = 1;
        break;
      case 'consolidation':
        features[3] = 1;
        break;
      case 'momentum_shift':
        features[4] = 1;
        break;
      case 'volatility_expansion':
        features[5] = 1;
        break;
      case 'volatility_contraction':
        features[6] = 1;
        break;
    }
    
    return features;
  }

  private calculatePatternConfidence(output: number[], patternType: string): number {
    let confidence = this.sigmoid(output[0]);
    
    // Adjust confidence based on pattern complexity
    const complexityFactors: Record<string, number> = {
      'trend_continuation': 0.9,
      'trend_reversal': 0.7,
      'breakout': 0.8,
      'consolidation': 0.85,
      'momentum_shift': 0.75,
      'volatility_expansion': 0.8,
      'volatility_contraction': 0.8,
    };
    
    confidence *= complexityFactors[patternType] || 0.7;
    
    return Math.min(confidence, 1.0);
  }

  private getPatternDescription(patternType: string, probability: number): string {
    const strength = probability > 0.8 ? 'Strong' : probability > 0.6 ? 'Moderate' : 'Weak';
    
    const descriptions: Record<string, string> = {
      'trend_continuation': `${strength} trend continuation signal`,
      'trend_reversal': `${strength} trend reversal pattern`,
      'breakout': `${strength} breakout potential`,
      'consolidation': `${strength} consolidation phase`,
      'momentum_shift': `${strength} momentum shift detected`,
      'volatility_expansion': `${strength} volatility expansion expected`,
      'volatility_contraction': `${strength} volatility contraction pattern`,
    };
    
    return descriptions[patternType] || `${strength} pattern detected`;
  }

  private estimatePatternTimeframe(patternType: string, candles: CandleData[]): number {
    const baseTimeframe = candles[1]?.timestamp - candles[0]?.timestamp || 3600000;
    
    const timeframeMultipliers: Record<string, number> = {
      'trend_continuation': 5,
      'trend_reversal': 3,
      'breakout': 2,
      'consolidation': 8,
      'momentum_shift': 3,
      'volatility_expansion': 4,
      'volatility_contraction': 6,
    };
    
    return baseTimeframe * (timeframeMultipliers[patternType] || 3);
  }

  private assessTrainingQuality(): number {
    if (!this.networkState || this.trainingHistory.length === 0) return 0;

    const convergenceRate = this.networkState.convergenceRate;
    const finalError = this.networkState.lastTrainingError;
    
    let quality = 0.5;
    
    // Good convergence increases quality
    quality += Math.min(convergenceRate, 0.3);
    
    // Low final error increases quality
    quality += Math.max(0, 0.2 - finalError);
    
    return Math.min(quality, 1.0);
  }

  private assessDataQuality(candles: CandleData[]): number {
    let quality = 0.5;
    
    // Sufficient data points
    if (candles.length >= this.config.trainingPeriod * 2) {
      quality += 0.2;
    }
    
    // Data consistency (no missing values, reasonable ranges)
    const priceConsistency = this.checkPriceConsistency(candles);
    quality += priceConsistency * 0.3;
    
    return Math.min(quality, 1.0);
  }

  private assessNetworkStability(): number {
    if (!this.networkState || this.trainingHistory.length < 10) return 0.5;

    const recentErrors = this.trainingHistory.slice(-10);
    const errorStability = 1 - this.calculateStandardDeviation(recentErrors);
    
    return Math.min(Math.max(errorStability, 0), 1);
  }

  private async assessRecentPerformance(candles: CandleData[]): Promise<number> {
    // Simplified performance assessment
    // In a real implementation, this would compare predictions with actual outcomes
    return 0.7; // Placeholder
  }

  private checkPriceConsistency(candles: CandleData[]): number {
    let consistentCandles = 0;
    
    for (const candle of candles) {
      if (candle.high >= candle.low && 
          candle.high >= Math.max(candle.open, candle.close) &&
          candle.low <= Math.min(candle.open, candle.close) &&
          candle.volume >= 0) {
        consistentCandles++;
      }
    }
    
    return consistentCandles / candles.length;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<NKNConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enabled !== undefined && newConfig.enabled && !this.networkState) {
      this.initializeNetwork();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): NKNConfig {
    return { ...this.config };
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): {
    isInitialized: boolean;
    trainingEpochs: number;
    lastError: number;
    convergenceRate: number;
    layerCount: number;
  } {
    return {
      isInitialized: !!this.networkState,
      trainingEpochs: this.networkState?.trainingEpochs || 0,
      lastError: this.networkState?.lastTrainingError || 0,
      convergenceRate: this.networkState?.convergenceRate || 0,
      layerCount: this.networkState?.layers.length || 0,
    };
  }
}