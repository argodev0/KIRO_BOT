/**
 * Portfolio Allocation Chart Component
 * Displays portfolio allocation with interactive pie chart and risk metrics
 */

import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Security,
  TrendingUp,
  TrendingDown,
  Info,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { VirtualPosition } from '../../hooks/useVirtualPortfolio';

interface PortfolioAllocationChartProps {
  positions: VirtualPosition[];
  totalBalance: number;
  availableBalance: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
}

interface AllocationData {
  symbol: string;
  value: number;
  percentage: number;
  pnl: number;
  pnlPercentage: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  color: string;
}

interface RiskMetric {
  name: string;
  value: number;
  maxValue: number;
  status: 'SAFE' | 'WARNING' | 'DANGER';
  description: string;
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#ff00ff', '#00ffff', '#ff0000', '#0000ff', '#ffff00'
];

const PortfolioAllocationChart: React.FC<PortfolioAllocationChartProps> = ({
  positions,
  totalBalance,
  availableBalance,
  totalUnrealizedPnl,
  totalRealizedPnl
}) => {
  /**
   * Calculate allocation data
   */
  const allocationData = useMemo((): AllocationData[] => {
    const positionValues = positions.map((position, index) => {
      const value = Math.abs(position.size * position.currentPrice);
      const percentage = totalBalance > 0 ? (value / totalBalance) * 100 : 0;
      const pnlPercentage = position.entryPrice > 0 
        ? ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100 
        : 0;

      // Determine risk level based on position size and PnL
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (percentage > 20 || Math.abs(pnlPercentage) > 15) {
        riskLevel = 'HIGH';
      } else if (percentage > 10 || Math.abs(pnlPercentage) > 8) {
        riskLevel = 'MEDIUM';
      }

      return {
        symbol: position.symbol.replace('USDT', ''),
        value,
        percentage,
        pnl: position.unrealizedPnl,
        pnlPercentage,
        riskLevel,
        color: COLORS[index % COLORS.length]
      };
    });

    // Add cash allocation
    const cashPercentage = totalBalance > 0 ? (availableBalance / totalBalance) * 100 : 100;
    if (cashPercentage > 0) {
      positionValues.push({
        symbol: 'CASH',
        value: availableBalance,
        percentage: cashPercentage,
        pnl: 0,
        pnlPercentage: 0,
        riskLevel: 'LOW',
        color: '#e0e0e0'
      });
    }

    return positionValues.sort((a, b) => b.percentage - a.percentage);
  }, [positions, totalBalance, availableBalance]);

  /**
   * Calculate risk metrics
   */
  const riskMetrics = useMemo((): RiskMetric[] => {
    const totalPositionValue = positions.reduce((sum, pos) => 
      sum + Math.abs(pos.size * pos.currentPrice), 0);
    
    const portfolioUtilization = totalBalance > 0 ? (totalPositionValue / totalBalance) * 100 : 0;
    const maxDrawdown = Math.abs(Math.min(0, totalUnrealizedPnl + totalRealizedPnl));
    const drawdownPercentage = totalBalance > 0 ? (maxDrawdown / totalBalance) * 100 : 0;
    
    const largestPosition = Math.max(...allocationData.map(d => d.percentage));
    const diversificationScore = allocationData.length > 1 ? 
      100 - (largestPosition - (100 / allocationData.length)) : 0;

    const volatilityRisk = positions.reduce((sum, pos) => {
      const priceChange = Math.abs(pos.unrealizedPnl / (pos.size * pos.entryPrice)) * 100;
      return sum + priceChange;
    }, 0) / Math.max(1, positions.length);

    return [
      {
        name: 'Portfolio Utilization',
        value: portfolioUtilization,
        maxValue: 100,
        status: portfolioUtilization > 90 ? 'DANGER' : portfolioUtilization > 70 ? 'WARNING' : 'SAFE',
        description: 'Percentage of portfolio allocated to positions'
      },
      {
        name: 'Maximum Drawdown',
        value: drawdownPercentage,
        maxValue: 20,
        status: drawdownPercentage > 15 ? 'DANGER' : drawdownPercentage > 8 ? 'WARNING' : 'SAFE',
        description: 'Maximum loss from peak portfolio value'
      },
      {
        name: 'Diversification Score',
        value: diversificationScore,
        maxValue: 100,
        status: diversificationScore < 30 ? 'DANGER' : diversificationScore < 60 ? 'WARNING' : 'SAFE',
        description: 'How well diversified the portfolio is'
      },
      {
        name: 'Volatility Risk',
        value: volatilityRisk,
        maxValue: 25,
        status: volatilityRisk > 20 ? 'DANGER' : volatilityRisk > 10 ? 'WARNING' : 'SAFE',
        description: 'Average price volatility of positions'
      }
    ];
  }, [positions, totalBalance, totalUnrealizedPnl, totalRealizedPnl, allocationData]);

  /**
   * Custom tooltip for pie chart
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 1, backgroundColor: 'rgba(0,0,0,0.8)', color: 'white' }}>
          <Typography variant="body2" fontWeight="bold">
            {data.symbol}
          </Typography>
          <Typography variant="caption">
            Value: ${data.value.toFixed(2)}
          </Typography>
          <br />
          <Typography variant="caption">
            Allocation: {data.percentage.toFixed(1)}%
          </Typography>
          {data.pnl !== 0 && (
            <>
              <br />
              <Typography 
                variant="caption" 
                color={data.pnl >= 0 ? 'lightgreen' : 'lightcoral'}
              >
                P&L: ${data.pnl.toFixed(2)} ({data.pnlPercentage.toFixed(1)}%)
              </Typography>
            </>
          )}
        </Paper>
      );
    }
    return null;
  };

  /**
   * Get status color for risk metrics
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SAFE': return 'success';
      case 'WARNING': return 'warning';
      case 'DANGER': return 'error';
      default: return 'primary';
    }
  };

  /**
   * Get status icon for risk metrics
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SAFE': return <CheckCircle />;
      case 'WARNING': return <Warning />;
      case 'DANGER': return <TrendingDown />;
      default: return <Info />;
    }
  };

  const totalPnL = totalUnrealizedPnl + totalRealizedPnl;
  const totalPnLPercentage = totalBalance > 0 ? (totalPnL / totalBalance) * 100 : 0;

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <Security color="primary" />
        <Typography variant="h6">Portfolio Allocation & Risk Analysis</Typography>
        <Chip
          label="PAPER"
          color="warning"
          size="small"
          icon={<Security />}
        />
      </Box>

      {/* Paper Trading Alert */}
      <Alert 
        severity="info" 
        sx={{ mb: 2, backgroundColor: 'rgba(33, 150, 243, 0.1)' }}
      >
        <Typography variant="body2">
          <strong>Simulated Portfolio:</strong> All allocations and risk metrics are virtual
        </Typography>
      </Alert>

      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
        {/* Portfolio Overview */}
        <Box flex="1">
          <Box mb={2}>
            <Typography variant="subtitle1" gutterBottom>
              Portfolio Overview
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
              <Box flex="1 1 45%">
                <Typography variant="body2" color="text.secondary">
                  Total Value
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  ${totalBalance.toFixed(2)}
                </Typography>
              </Box>
              <Box flex="1 1 45%">
                <Typography variant="body2" color="text.secondary">
                  Available Cash
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  ${availableBalance.toFixed(2)}
                </Typography>
              </Box>
              <Box flex="1 1 100%">
                <Box display="flex" alignItems="center" gap={1}>
                  {totalPnL >= 0 ? (
                    <TrendingUp color="success" />
                  ) : (
                    <TrendingDown color="error" />
                  )}
                  <Typography 
                    variant="h6" 
                    color={totalPnL >= 0 ? 'success.main' : 'error.main'}
                    fontWeight="bold"
                  >
                    ${totalPnL.toFixed(2)}
                  </Typography>
                  <Chip
                    label={`${totalPnLPercentage >= 0 ? '+' : ''}${totalPnLPercentage.toFixed(2)}%`}
                    color={totalPnL >= 0 ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Allocation Pie Chart */}
          <Box height={300}>
            <Typography variant="subtitle2" gutterBottom>
              Asset Allocation
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ symbol, percentage }) => 
                    percentage > 5 ? `${symbol} ${percentage.toFixed(1)}%` : ''
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="percentage"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* Risk Metrics */}
        <Box flex="1">
          <Typography variant="subtitle1" gutterBottom>
            Risk Metrics
          </Typography>
          
          {riskMetrics.map((metric, index) => (
            <Box key={index} mb={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  {React.cloneElement(getStatusIcon(metric.status), { 
                    color: getStatusColor(metric.status) as any,
                    fontSize: 'small'
                  })}
                  <Typography variant="body2" fontWeight="bold">
                    {metric.name}
                  </Typography>
                  <Tooltip title={metric.description}>
                    <IconButton size="small">
                      <Info fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {metric.value.toFixed(1)}{metric.name.includes('Score') ? '' : '%'}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min((metric.value / metric.maxValue) * 100, 100)}
                color={getStatusColor(metric.status) as any}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          ))}

          {/* Position Risk Breakdown */}
          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              Position Risk Levels
            </Typography>
            <Box height={200}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allocationData.filter(d => d.symbol !== 'CASH')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`, 
                      name === 'percentage' ? 'Allocation' : name
                    ]}
                  />
                  <Bar 
                    dataKey="percentage" 
                    fill="#8884d8"
                    name="Allocation %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Position Details */}
      <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Position Details
          </Typography>
          
          {allocationData.filter(d => d.symbol !== 'CASH').length === 0 ? (
            <Alert severity="info">
              No active positions. Portfolio is 100% cash.
            </Alert>
          ) : (
            <Box display="flex" flexWrap="wrap" gap={2}>
              {allocationData.filter(d => d.symbol !== 'CASH').map((position, index) => (
                <Box key={index} flex="1 1 300px" minWidth="250px">
                  <Paper sx={{ p: 2, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="h6" fontWeight="bold">
                        {position.symbol}
                      </Typography>
                      <Chip
                        label={position.riskLevel}
                        color={
                          position.riskLevel === 'HIGH' ? 'error' :
                          position.riskLevel === 'MEDIUM' ? 'warning' : 'success'
                        }
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      Allocation: {position.percentage.toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Value: ${position.value.toFixed(2)}
                    </Typography>
                    
                    {position.pnl !== 0 && (
                      <Typography 
                        variant="body2" 
                        color={position.pnl >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        P&L: ${position.pnl.toFixed(2)} ({position.pnlPercentage.toFixed(1)}%)
                      </Typography>
                    )}
                  </Paper>
                </Box>
              ))}
            </Box>
          )}
        </Box>

      {/* Safety Footer */}
      <Alert 
        severity="warning" 
        sx={{ mt: 2, backgroundColor: 'rgba(255, 152, 0, 0.05)' }}
      >
        <Typography variant="caption">
          <Security fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
          All risk metrics are calculated on simulated data - No real money at risk
        </Typography>
      </Alert>
    </Paper>
  );
};

export default PortfolioAllocationChart;