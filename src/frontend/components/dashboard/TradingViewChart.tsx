import React from 'react';
import AdvancedTradingViewChart from '../charts/AdvancedTradingViewChart';
import { AnalysisResults } from '../../../types/analysis';

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  height?: number;
  analysisData?: AnalysisResults;
  onAnalysisUpdate?: (analysis: AnalysisResults) => void;
}

/**
 * TradingView Chart Component
 * Wrapper around AdvancedTradingViewChart for backward compatibility
 */
const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol = 'BTCUSDT',
  interval = '1H',
  height = 500,
  analysisData,
  onAnalysisUpdate
}) => {
  return (
    <AdvancedTradingViewChart
      symbol={symbol}
      interval={interval}
      height={height}
      analysisData={analysisData}
      onAnalysisUpdate={onAnalysisUpdate}
    />
  );
};

export default TradingViewChart;