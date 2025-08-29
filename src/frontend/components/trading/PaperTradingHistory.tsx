/**
 * Paper Trading History Component
 * Displays detailed paper trading history with filtering and analysis
 */

import React, { useState, useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Alert,
  Tooltip,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';
import {
  Security,
  TrendingUp,
  TrendingDown,
  FilterList,
  ExpandMore,
  ExpandLess,
  Info,
  Schedule,
  AttachMoney,
  ShowChart,
} from '@mui/icons-material';
import { SimulatedTrade } from '../../hooks/useVirtualPortfolio';

interface PaperTradingHistoryProps {
  trades: SimulatedTrade[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface TradeAnalysis {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  averageTradeSize: number;
  totalVolume: number;
  totalFees: number;
}

const PaperTradingHistory: React.FC<PaperTradingHistoryProps> = ({
  trades,
  isLoading = false,
  onRefresh
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  /**
   * Filter trades based on current filters
   */
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      const symbolMatch = !symbolFilter || trade.symbol.toLowerCase().includes(symbolFilter.toLowerCase());
      const sideMatch = !sideFilter || trade.side === sideFilter;
      return symbolMatch && sideMatch;
    });
  }, [trades, symbolFilter, sideFilter]);

  /**
   * Get paginated trades
   */
  const paginatedTrades = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredTrades.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredTrades, page, rowsPerPage]);

  /**
   * Calculate trade analysis
   */
  const tradeAnalysis = useMemo((): TradeAnalysis => {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        averageTradeSize: 0,
        totalVolume: 0,
        totalFees: 0
      };
    }

    // Group trades by symbol to calculate PnL
    const tradesBySymbol: { [symbol: string]: SimulatedTrade[] } = {};
    trades.forEach(trade => {
      if (!tradesBySymbol[trade.symbol]) {
        tradesBySymbol[trade.symbol] = [];
      }
      tradesBySymbol[trade.symbol].push(trade);
    });

    let totalPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let largestWin = 0;
    let largestLoss = 0;
    const tradePnLs: number[] = [];

    // Calculate PnL for each symbol
    Object.values(tradesBySymbol).forEach(symbolTrades => {
      const sortedTrades = symbolTrades.sort((a, b) => 
        new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
      );

      let position = 0;
      let avgPrice = 0;

      sortedTrades.forEach(trade => {
        if (trade.side === 'BUY') {
          if (position <= 0) {
            // Opening long or covering short
            position += trade.quantity;
            avgPrice = trade.price;
          } else {
            // Adding to long position
            const totalValue = position * avgPrice + trade.quantity * trade.price;
            position += trade.quantity;
            avgPrice = totalValue / position;
          }
        } else {
          // SELL
          if (position > 0) {
            // Closing long position
            const pnl = (trade.price - avgPrice) * Math.min(trade.quantity, position) - trade.fee;
            totalPnL += pnl;
            tradePnLs.push(pnl);

            if (pnl > 0) {
              winningTrades++;
              totalWins += pnl;
              largestWin = Math.max(largestWin, pnl);
            } else {
              losingTrades++;
              totalLosses += Math.abs(pnl);
              largestLoss = Math.min(largestLoss, pnl);
            }

            position -= Math.min(trade.quantity, position);
          } else {
            // Opening short position
            position -= trade.quantity;
            avgPrice = trade.price;
          }
        }
      });
    });

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const averageWin = winningTrades > 0 ? totalWins / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    const averageTradeSize = trades.reduce((sum, trade) => sum + (trade.quantity * trade.price), 0) / trades.length;
    const totalVolume = trades.reduce((sum, trade) => sum + (trade.quantity * trade.price), 0);
    const totalFees = trades.reduce((sum, trade) => sum + trade.fee, 0);

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnL,
      averageWin,
      averageLoss,
      profitFactor,
      largestWin,
      largestLoss,
      averageTradeSize,
      totalVolume,
      totalFees
    };
  }, [trades]);

  /**
   * Get unique symbols for filter
   */
  const uniqueSymbols = useMemo(() => {
    return Array.from(new Set(trades.map(trade => trade.symbol))).sort();
  }, [trades]);

  /**
   * Format currency
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  /**
   * Format date
   */
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
  };

  /**
   * Get trade row color based on side
   */
  const getTradeRowColor = (side: string) => {
    return side === 'BUY' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)';
  };

  /**
   * Handle page change
   */
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  /**
   * Handle rows per page change
   */
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  /**
   * Toggle trade details
   */
  const toggleTradeDetails = (tradeId: string) => {
    setExpandedTrade(expandedTrade === tradeId ? null : tradeId);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <Schedule color="primary" />
        <Typography variant="h6">Paper Trading History</Typography>
        <Chip
          label="PAPER"
          color="warning"
          size="small"
          icon={<Security />}
        />
        <Box flexGrow={1} />
        <IconButton onClick={() => setShowAnalysis(!showAnalysis)}>
          <ShowChart />
        </IconButton>
      </Box>

      {/* Paper Trading Alert */}
      <Alert 
        severity="info" 
        sx={{ mb: 2, backgroundColor: 'rgba(33, 150, 243, 0.1)' }}
      >
        <Typography variant="body2">
          <strong>Simulated Trading History:</strong> All trades are virtual and for educational purposes only
        </Typography>
      </Alert>

      {/* Trade Analysis */}
      <Collapse in={showAnalysis}>
        <Card sx={{ mb: 2, backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Trading Performance Analysis
            </Typography>
            
            <Box display="flex" flexWrap="wrap" gap={2}>
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Total Trades
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  {tradeAnalysis.totalTrades}
                </Typography>
              </Box>
              
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Win Rate
                </Typography>
                <Typography 
                  variant="h6" 
                  fontWeight="bold"
                  color={tradeAnalysis.winRate >= 50 ? 'success.main' : 'error.main'}
                >
                  {tradeAnalysis.winRate.toFixed(1)}%
                </Typography>
              </Box>
              
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Total P&L
                </Typography>
                <Typography 
                  variant="h6" 
                  fontWeight="bold"
                  color={tradeAnalysis.totalPnL >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(tradeAnalysis.totalPnL)}
                </Typography>
              </Box>
              
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Profit Factor
                </Typography>
                <Typography 
                  variant="h6" 
                  fontWeight="bold"
                  color={tradeAnalysis.profitFactor >= 1 ? 'success.main' : 'error.main'}
                >
                  {tradeAnalysis.profitFactor.toFixed(2)}
                </Typography>
              </Box>
              
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Average Win
                </Typography>
                <Typography variant="body1" color="success.main">
                  {formatCurrency(tradeAnalysis.averageWin)}
                </Typography>
              </Box>
              
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Average Loss
                </Typography>
                <Typography variant="body1" color="error.main">
                  {formatCurrency(tradeAnalysis.averageLoss)}
                </Typography>
              </Box>
              
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Total Volume
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(tradeAnalysis.totalVolume)}
                </Typography>
              </Box>
              
              <Box flex="1 1 200px">
                <Typography variant="body2" color="text.secondary">
                  Total Fees
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(tradeAnalysis.totalFees)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Collapse>

      {/* Filters */}
      <Box display="flex" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
        <Box flex="1 1 250px">
          <TextField
            fullWidth
            size="small"
            label="Filter by Symbol"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            InputProps={{
              startAdornment: <FilterList sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
        </Box>
        
        <Box flex="1 1 250px">
          <TextField
            fullWidth
            size="small"
            select
            label="Filter by Side"
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
          >
            <MenuItem value="">All Sides</MenuItem>
            <MenuItem value="BUY">Buy Orders</MenuItem>
            <MenuItem value="SELL">Sell Orders</MenuItem>
          </TextField>
        </Box>
        
        <Box flex="1 1 250px" display="flex" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Showing {filteredTrades.length} of {trades.length} trades
          </Typography>
        </Box>
      </Box>

      {/* Trades Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Symbol</TableCell>
              <TableCell>Side</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">Fee</TableCell>
              <TableCell align="right">Slippage</TableCell>
              <TableCell align="center">Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>
                    No trades found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTrades.map((trade) => (
                <React.Fragment key={trade.id}>
                  <TableRow 
                    sx={{ 
                      backgroundColor: getTradeRowColor(trade.side),
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(trade.executedAt)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {trade.symbol.replace('USDT', '/USDT')}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        label={trade.side}
                        color={trade.side === 'BUY' ? 'success' : 'error'}
                        size="small"
                        icon={trade.side === 'BUY' ? <TrendingUp /> : <TrendingDown />}
                      />
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2">
                        {trade.quantity.toFixed(6)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatCurrency(trade.price)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(trade.quantity * trade.price)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">
                        {formatCurrency(trade.fee)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2" color="warning.main">
                        {formatCurrency(trade.slippage)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <IconButton 
                        size="small"
                        onClick={() => toggleTradeDetails(trade.id)}
                      >
                        {expandedTrade === trade.id ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded Trade Details */}
                  <TableRow>
                    <TableCell colSpan={9} sx={{ p: 0 }}>
                      <Collapse in={expandedTrade === trade.id}>
                        <Box sx={{ p: 2, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                          <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2}>
                            <Box flex="1">
                              <Typography variant="subtitle2" gutterBottom>
                                Trade Details
                              </Typography>
                              <Typography variant="body2">
                                <strong>Trade ID:</strong> {trade.id}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Order ID:</strong> {trade.orderId || 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Signal ID:</strong> {trade.signalId || 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Execution Time:</strong> {formatDate(trade.executedAt)}
                              </Typography>
                            </Box>
                            
                            <Box flex="1">
                              <Typography variant="subtitle2" gutterBottom>
                                Cost Breakdown
                              </Typography>
                              <Typography variant="body2">
                                <strong>Base Value:</strong> {formatCurrency(trade.quantity * trade.price)}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Trading Fee:</strong> {formatCurrency(trade.fee)}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Slippage Cost:</strong> {formatCurrency(trade.slippage)}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                <strong>Total Cost:</strong> {formatCurrency(trade.quantity * trade.price + trade.fee + Math.abs(trade.slippage))}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography variant="caption">
                              <Security fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                              This is a simulated trade - No real money was involved
                            </Typography>
                          </Alert>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredTrades.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      {/* Safety Footer */}
      <Alert 
        severity="warning" 
        sx={{ mt: 2, backgroundColor: 'rgba(255, 152, 0, 0.05)' }}
      >
        <Typography variant="caption">
          <Security fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
          All trading history is simulated - Performance metrics are for educational purposes only
        </Typography>
      </Alert>
    </Paper>
  );
};

export default PaperTradingHistory;