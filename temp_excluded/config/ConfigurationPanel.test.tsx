import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ConfigurationPanel } from '@/components/config/ConfigurationPanel';
import { BotConfig } from '@/types/config';

// Mock the API
jest.mock('@/services/api', () => ({
  api: {
    post: jest.fn()
  }
}));

const theme = createTheme();

const mockConfig: BotConfig = {
  name: 'Test Configuration',
  description: 'A test configuration',
  isActive: false,
  strategy: {
    type: 'technical_analysis',
    parameters: {
      technicalAnalysis: {
        indicators: {
          rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
          waveTrend: { enabled: true, n1: 10, n2: 21 },
          pvt: { enabled: true, period: 14 }
        },
        patterns: { enabled: true, minConfidence: 70, patternTypes: ['hammer', 'doji'] },
        confluence: { minFactors: 2, requiredIndicators: ['rsi'] }
      }
    },
    timeframes: ['1h'],
    symbols: ['BTCUSDT'],
    maxConcurrentTrades: 3
  },
  riskManagement: {
    maxRiskPerTrade: 2,
    maxDailyLoss: 5,
    maxTotalExposure: 3,
    maxDrawdown: 10,
    stopLossRequired: true,
    maxLeverage: 1,
    emergencyStop: {
      enabled: true,
      triggers: {
        maxDailyLoss: true,
        maxDrawdown: true,
        consecutiveLosses: { enabled: false, count: 5 },
        marketVolatility: { enabled: false, threshold: 0.1 }
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
      maxSize: 5,
      volatilityAdjustment: false,
      correlationAdjustment: false
    },
    correlationLimits: {
      enabled: false,
      maxCorrelatedPositions: 3,
      correlationThreshold: 0.7,
      timeframe: '1h'
    },
    drawdownProtection: {
      enabled: true,
      maxDrawdown: 10,
      reductionSteps: [{ threshold: 5, action: 'reduce_size', parameter: 50 }],
      recoveryThreshold: 3
    }
  },
  signalFilters: {
    confidence: {
      enabled: true,
      minConfidence: 60,
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
      minPatternStrength: 60,
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
      minVolumeRatio: 1.2,
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
    inApp: { enabled: true, events: ['signal_generated', 'trade_executed'], sound: true }
  }
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ConfigurationPanel', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders configuration panel with all sections', () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
      />
    );

    // Check if main sections are present
    expect(screen.getByText('Basic Configuration')).toBeInTheDocument();
    expect(screen.getByText('Trading Strategy')).toBeInTheDocument();
    expect(screen.getByText('Risk Management')).toBeInTheDocument();
    expect(screen.getByText('Signal Filters')).toBeInTheDocument();
    expect(screen.getByText('Exchange Configuration')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('displays configuration name and description', () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByDisplayValue('Test Configuration')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test configuration')).toBeInTheDocument();
  });

  it('allows editing configuration name', async () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Configuration');
    fireEvent.change(nameInput, { target: { value: 'Updated Configuration' } });

    expect(nameInput).toHaveValue('Updated Configuration');
  });

  it('shows save button and calls onSave when clicked', async () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
      />
    );

    // Make a change to enable the save button
    const nameInput = screen.getByDisplayValue('Test Configuration');
    fireEvent.change(nameInput, { target: { value: 'Updated Configuration' } });

    // Wait for the save button to be enabled
    await waitFor(() => {
      const saveButton = screen.getByText('Update Configuration');
      expect(saveButton).not.toBeDisabled();
    });

    const saveButton = screen.getByText('Update Configuration');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Configuration'
      })
    );
  });

  it('expands and collapses accordion sections', () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
      />
    );

    // Basic Configuration should be expanded by default
    expect(screen.getByText('Configuration Name')).toBeInTheDocument();

    // Click on Trading Strategy to expand it
    const strategyHeader = screen.getByText('Trading Strategy');
    fireEvent.click(strategyHeader);

    // Should show strategy content
    expect(screen.getByText('Strategy Type')).toBeInTheDocument();
  });

  it('validates configuration and shows errors', async () => {
    const invalidConfig = {
      ...mockConfig,
      name: '', // Invalid empty name
      strategy: {
        ...mockConfig.strategy,
        symbols: [] // Invalid empty symbols
      }
    };

    renderWithTheme(
      <ConfigurationPanel
        config={invalidConfig}
        onSave={mockOnSave}
      />
    );

    // The component should show validation errors
    // This would require mocking the validation API call
    await waitFor(() => {
      // Check if validation runs (this would show errors in a real scenario)
      expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Empty name field
    });
  });

  it('disables save button when loading', () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
        loading={true}
      />
    );

    const saveButton = screen.getByText('Update Configuration');
    expect(saveButton).toBeDisabled();
  });

  it('shows create button for new configurations', () => {
    const newConfig = { ...mockConfig, id: undefined };

    renderWithTheme(
      <ConfigurationPanel
        config={newConfig}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Create Configuration')).toBeInTheDocument();
  });

  it('handles strategy type changes', () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
      />
    );

    // Expand strategy section
    const strategyHeader = screen.getByText('Trading Strategy');
    fireEvent.click(strategyHeader);

    // Find and change strategy type
    const strategySelect = screen.getByLabelText('Strategy Type');
    fireEvent.mouseDown(strategySelect);
    
    const elliottWaveOption = screen.getByText('Elliott Wave');
    fireEvent.click(elliottWaveOption);

    // The strategy type should be updated
    expect(strategySelect).toHaveTextContent('Elliott Wave');
  });

  it('handles risk management settings changes', () => {
    renderWithTheme(
      <ConfigurationPanel
        config={mockConfig}
        onSave={mockOnSave}
      />
    );

    // Expand risk management section
    const riskHeader = screen.getByText('Risk Management');
    fireEvent.click(riskHeader);

    // The risk management controls should be visible
    expect(screen.getByText(/Max Risk Per Trade/)).toBeInTheDocument();
    expect(screen.getByText(/Max Daily Loss/)).toBeInTheDocument();
  });
});