import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import BotConfigurationInterface from '@/frontend/components/config/BotConfigurationInterface';
import { BotConfig, BotControlState } from '@/types/config';
import * as api from '@/frontend/services/api';

// Mock the API
jest.mock('@/frontend/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  configAPI: {
    getConfig: jest.fn(),
    getBotStatus: jest.fn(),
    validateConfig: jest.fn(),
    updateConfig: jest.fn(),
    controlBot: jest.fn(),
  }
}));

const mockedApi = api as jest.Mocked<typeof api>;

// Mock store
const mockStore = configureStore({
  reducer: {
    auth: (state = { isAuthenticated: true, user: { userId: 'test' } }) => state,
  },
});

const theme = createTheme();

const mockConfig: BotConfig = {
  id: 'test-config-1',
  userId: 'test-user',
  name: 'Test Configuration',
  description: 'Test paper trading configuration',
  isActive: true,
  strategy: {
    type: 'technical_analysis',
    parameters: {
      technicalAnalysis: {
        indicators: {
          rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
          waveTrend: { enabled: true, n1: 10, n2: 21 },
          pvt: { enabled: true, period: 14 }
        },
        patterns: { enabled: true, minConfidence: 70, patternTypes: [] },
        confluence: { minFactors: 2, requiredIndicators: [] }
      }
    },
    timeframes: ['1h', '4h'],
    symbols: ['BTCUSDT'],
    maxConcurrentTrades: 3
  },
  riskManagement: {
    maxRiskPerTrade: 2,
    maxDailyLoss: 5,
    maxTotalExposure: 10,
    maxDrawdown: 10,
    stopLossRequired: true,
    maxLeverage: 1,
    emergencyStop: {
      enabled: true,
      triggers: {
        maxDailyLoss: true,
        maxDrawdown: true,
        consecutiveLosses: { enabled: true, count: 3 },
        marketVolatility: { enabled: false, threshold: 0.05 }
      },
      actions: {
        closeAllPositions: true,
        pauseTrading: true,
        sendNotification: true
      }
    },
    positionSizing: {
      method: 'percentage',
      baseSize: 1,
      maxSize: 3,
      volatilityAdjustment: false,
      correlationAdjustment: false
    },
    correlationLimits: {
      enabled: false,
      maxCorrelatedPositions: 2,
      correlationThreshold: 0.7,
      timeframe: '1h'
    },
    drawdownProtection: {
      enabled: true,
      maxDrawdown: 10,
      reductionSteps: [],
      recoveryThreshold: 5
    }
  },
  signalFilters: {
    confidence: {
      enabled: true,
      minConfidence: 70,
      maxSignalsPerHour: 5,
      cooldownPeriod: 15
    },
    technical: {
      enabled: true,
      requiredIndicators: [],
      indicatorThresholds: {},
      trendAlignment: false
    },
    patterns: {
      enabled: true,
      allowedPatterns: [],
      minPatternStrength: 70,
      multiTimeframeConfirmation: false
    },
    confluence: {
      enabled: true,
      minConfluenceFactors: 2,
      requiredFactorTypes: [],
      confluenceWeight: 0.7
    },
    timeframe: {
      enabled: false,
      primaryTimeframe: '1h',
      confirmationTimeframes: [],
      alignmentRequired: false
    },
    volume: {
      enabled: false,
      minVolumeRatio: 1.0,
      volumeTrendRequired: false,
      unusualVolumeDetection: false
    }
  },
  exchanges: [
    {
      name: 'binance',
      enabled: true,
      testnet: true,
      rateLimits: { ordersPerSecond: 1, requestsPerMinute: 60 },
      fees: { maker: 0.001, taker: 0.001 },
      symbols: ['BTCUSDT']
    }
  ],
  notifications: {
    email: { enabled: false, events: [] },
    webhook: { enabled: false, events: [] },
    inApp: { enabled: true, events: ['signal_generated', 'trade_executed'], sound: false }
  },
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const mockBotStatus: BotControlState = {
  status: 'stopped',
  runningTime: 0,
  totalTrades: 0,
  activePositions: 0,
  totalProfit: 0,
  currentDrawdown: 0
};

const renderComponent = (props: any = {}) => {
  return render(
    <Provider store={mockStore}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <BotConfigurationInterface
            configId="test-config-1"
            {...props}
          />
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('BotConfigurationInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default API mocks
    (mockedApi.api.get as jest.Mock).mockImplementation((url) => {
      if (url === '/config/test-config-1') {
        return Promise.resolve({ data: { data: mockConfig } });
      }
      if (url === '/config/test-config-1/status') {
        return Promise.resolve({ data: { data: mockBotStatus } });
      }
      return Promise.reject(new Error('Not found'));
    });

    (mockedApi.api.post as jest.Mock).mockImplementation((url, data) => {
      if (url === '/config/validate') {
        return Promise.resolve({
          data: {
            data: {
              isValid: true,
              errors: [],
              warnings: []
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    (mockedApi.api.put as jest.Mock).mockResolvedValue({ data: { data: mockConfig } });
  });

  it('renders paper trading indicator', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('PAPER TRADING MODE ACTIVE')).toBeInTheDocument();
    });
  });

  it('loads and displays configuration', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Configuration')).toBeInTheDocument();
      expect(screen.getByText('Test paper trading configuration')).toBeInTheDocument();
    });
  });

  it('displays paper trading safety features', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('PAPER TRADING')).toBeInTheDocument();
      expect(screen.getByText('All trades are simulated - No real money at risk')).toBeInTheDocument();
    });
  });

  it('shows configuration validation status', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });
  });

  it('displays bot status chip', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('STOPPED')).toBeInTheDocument();
    });
  });

  it('handles configuration saving', async () => {
    const mockOnConfigChange = jest.fn();
    renderComponent({ onConfigChange: mockOnConfigChange });

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockedApi.api.put).toHaveBeenCalled();
    });
  });

  it('shows validation errors when configuration is invalid', async () => {
    (mockedApi.api.post as jest.Mock).mockImplementation((url, data) => {
      if (url === '/config/validate') {
        return Promise.resolve({
          data: {
            data: {
              isValid: false,
              errors: [
                { field: 'strategy.symbols', message: 'At least one symbol required', code: 'REQUIRED' }
              ],
              warnings: [
                { field: 'riskManagement.maxRiskPerTrade', message: 'High risk per trade', suggestion: 'Consider reducing' }
              ]
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Configuration Errors (1):')).toBeInTheDocument();
      expect(screen.getByText('• strategy.symbols: At least one symbol required')).toBeInTheDocument();
      expect(screen.getByText('Configuration Warnings (1):')).toBeInTheDocument();
    });
  });

  it('handles bot control actions', async () => {
    const mockOnStatusChange = jest.fn();
    renderComponent({ onStatusChange: mockOnStatusChange });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Bot Control')).toBeInTheDocument();
    });

    // Click on Bot Control tab
    const botControlTab = screen.getByText('Bot Control');
    fireEvent.click(botControlTab);

    await waitFor(() => {
      expect(screen.getByText('Start Bot')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Bot');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockedApi.api.post).toHaveBeenCalledWith('/config/test-config-1/control', { action: 'start' });
    });
  });

  it('displays paper trading warnings for high risk settings', async () => {
    const highRiskConfig = {
      ...mockConfig,
      riskManagement: {
        ...mockConfig.riskManagement,
        maxRiskPerTrade: 8, // High risk
        maxDailyLoss: 15 // High daily loss
      }
    };

    (mockedApi.api.get as jest.Mock).mockImplementation((url) => {
      if (url === '/config/test-config-1') {
        return Promise.resolve({ data: { data: highRiskConfig } });
      }
      if (url === '/config/test-config-1/status') {
        return Promise.resolve({ data: { data: mockBotStatus } });
      }
      return Promise.reject(new Error('Not found'));
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Paper Trading Recommendations:')).toBeInTheDocument();
    });
  });

  it('shows refresh functionality', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockedApi.api.get).toHaveBeenCalledWith('/config/test-config-1');
      expect(mockedApi.api.get).toHaveBeenCalledWith('/config/test-config-1/status');
    });
  });

  it('handles backup functionality', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Backup')).toBeInTheDocument();
    });

    const backupButton = screen.getByText('Backup');
    fireEvent.click(backupButton);

    await waitFor(() => {
      expect(screen.getByText('Backup Configuration')).toBeInTheDocument();
    });
  });

  it('disables save button when validation fails', async () => {
    (mockedApi.api.post as jest.Mock).mockImplementation((url, data) => {
      if (url === '/config/validate') {
        return Promise.resolve({
          data: {
            data: {
              isValid: false,
              errors: [{ field: 'name', message: 'Name required', code: 'REQUIRED' }],
              warnings: []
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    renderComponent();

    await waitFor(() => {
      const saveButton = screen.getByText('Save Configuration');
      expect(saveButton).toBeDisabled();
    });
  });

  it('shows loading state', () => {
    (mockedApi.api.get as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderComponent();

    expect(screen.getByText('Loading bot configuration...')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    (mockedApi.api.get as jest.Mock).mockRejectedValue(new Error('API Error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No configuration found')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});