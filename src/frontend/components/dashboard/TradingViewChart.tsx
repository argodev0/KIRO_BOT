import React from 'react';
import EnhancedTradingViewChart from '../charts/EnhancedTradingViewChart';
import { AnalysisResults } from '../../../types/analysis';

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  height?: number;
  analysisData?: AnalysisResults;
  onAnalysisUpdate?: (analysis: AnalysisResults) => void;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

/**
 * TradingView Chart Component
 * Enhanced wrapper with paper trading indicators and live data integration
 */
const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol = 'BTCUSDT',
  interval = '1H',
  height = 500,
  analysisData,
  onAnalysisUpdate,
  onFullscreenToggle
}) => {
  return (
    <EnhancedTradingViewChart
      symbol={symbol}
      interval={interval}
      height={height}
      onFullscreenToggle={onFullscreenToggle}
    />
  );
};

export default TradingViewChart;