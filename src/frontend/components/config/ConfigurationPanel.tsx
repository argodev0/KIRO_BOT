import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Alert,
  Divider,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon, 
  Save as SaveIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { BotConfig, ConfigValidation } from '@/types/config';
import { StrategyConfigPanel } from './StrategyConfigPanel';
import { RiskManagementPanel } from './RiskManagementPanel';
import { SignalFiltersPanel } from './SignalFiltersPanel';
import { ExchangeConfigPanel } from './ExchangeConfigPanel';
import { NotificationConfigPanel } from './NotificationConfigPanel';
import { BasicConfigPanel } from './BasicConfigPanel';
import PaperTradingIndicator from '../common/PaperTradingIndicator';
import { api } from '@/services/api';

interface ConfigurationPanelProps {
  config: BotConfig;
  onSave: (config: BotConfig) => void;
  loading?: boolean;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onSave,
  loading = false
}) => {
  const [localConfig, setLocalConfig] = useState<BotConfig>(config);
  const [validation, setValidation] = useState<ConfigValidation | null>(null);
  const [expandedPanels, setExpandedPanels] = useState<string[]>(['basic']);
  const [validating, setValidating] = useState(false);
  const [paperTradingWarnings, setPaperTradingWarnings] = useState<string[]>([]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    // Validate configuration on changes
    const validateConfig = async () => {
      setValidating(true);
      try {
        const response = await api.post('/config/validate', localConfig);
        const validationResult = response.data.data;
        setValidation(validationResult);
        
        // Check for paper trading specific warnings
        checkPaperTradingWarnings(localConfig);
      } catch (error) {
        console.error('Validation error:', error);
      } finally {
        setValidating(false);
      }
    };

    const debounceTimer = setTimeout(validateConfig, 500);
    return () => clearTimeout(debounceTimer);
  }, [localConfig]);

  const checkPaperTradingWarnings = (config: BotConfig) => {
    const warnings: string[] = [];
    
    // Check for high risk settings in paper trading
    if (config.riskManagement?.maxRiskPerTrade > 5) {
      warnings.push('High risk per trade (>5%) - Consider reducing for safer paper trading practice');
    }
    
    if (config.strategy?.maxConcurrentTrades > 10) {
      warnings.push('High concurrent trades - May impact paper trading simulation performance');
    }
    
    // Check for production-like settings
    if (config.exchanges?.some(ex => !ex.testnet)) {
      warnings.push('Production exchange detected - Ensure API keys are read-only for paper trading');
    }
    
    if (config.riskManagement?.maxDailyLoss > 10) {
      warnings.push('High daily loss limit - Consider lower values for paper trading learning');
    }
    
    setPaperTradingWarnings(warnings);
  };

  const handlePanelChange = (panel: string) => (
    _event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpandedPanels(prev => 
      isExpanded 
        ? [...prev, panel]
        : prev.filter(p => p !== panel)
    );
  };

  const handleConfigChange = (updates: Partial<BotConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    if (validation?.isValid !== false) {
      onSave(localConfig);
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(localConfig);

  return (
    <Box>
      {/* Paper Trading Mode Indicator */}
      <Box sx={{ mb: 3 }}>
        <Alert 
          severity="info" 
          icon={<SecurityIcon />}
          sx={{ 
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            border: '1px solid rgba(255, 152, 0, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" fontWeight="bold">
              PAPER TRADING CONFIGURATION
            </Typography>
            <Chip
              icon={<SecurityIcon />}
              label="SAFE MODE"
              color="warning"
              variant="outlined"
              size="small"
            />
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            This configuration is for paper trading only. All trades will be simulated with virtual funds.
          </Typography>
        </Alert>
      </Box>

      {/* Validation Status */}
      {validating && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Validating configuration...
          </Typography>
        </Box>
      )}

      {/* Paper Trading Specific Warnings */}
      {paperTradingWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Paper Trading Recommendations:
          </Typography>
          {paperTradingWarnings.map((warning, index) => (
            <Typography key={index} variant="body2">
              • {warning}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Validation Results */}
      {validation && (
        <Box sx={{ mb: 3 }}>
          {validation.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ErrorIcon />
                <Typography variant="subtitle2" fontWeight="bold">
                  Configuration Errors ({validation.errors.length}):
                </Typography>
              </Box>
              {validation.errors.map((error, index) => (
                <Typography key={index} variant="body2">
                  • {error.field}: {error.message}
                </Typography>
              ))}
            </Alert>
          )}
          
          {validation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WarningIcon />
                <Typography variant="subtitle2" fontWeight="bold">
                  Configuration Warnings ({validation.warnings.length}):
                </Typography>
              </Box>
              {validation.warnings.map((warning, index) => (
                <Typography key={index} variant="body2">
                  • {warning.field}: {warning.message}
                  {warning.suggestion && (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {` (${warning.suggestion})`}
                    </Typography>
                  )}
                </Typography>
              ))}
            </Alert>
          )}

          {validation.isValid && validation.errors.length === 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckIcon />
                <Typography variant="subtitle2" fontWeight="bold">
                  Configuration is valid and ready for paper trading!
                </Typography>
              </Box>
            </Alert>
          )}
        </Box>
      )}

      {/* Configuration Sections */}
      <Box sx={{ mb: 3 }}>
        {/* Basic Configuration */}
        <Accordion 
          expanded={expandedPanels.includes('basic')}
          onChange={handlePanelChange('basic')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Basic Configuration</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <BasicConfigPanel
              config={localConfig}
              onChange={handleConfigChange}
            />
          </AccordionDetails>
        </Accordion>

        {/* Strategy Configuration */}
        <Accordion 
          expanded={expandedPanels.includes('strategy')}
          onChange={handlePanelChange('strategy')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Trading Strategy</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <StrategyConfigPanel
              strategy={localConfig.strategy}
              onChange={(strategy) => handleConfigChange({ strategy })}
            />
          </AccordionDetails>
        </Accordion>

        {/* Risk Management */}
        <Accordion 
          expanded={expandedPanels.includes('risk')}
          onChange={handlePanelChange('risk')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Risk Management</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <RiskManagementPanel
              riskManagement={localConfig.riskManagement}
              onChange={(riskManagement) => handleConfigChange({ riskManagement })}
            />
          </AccordionDetails>
        </Accordion>

        {/* Signal Filters */}
        <Accordion 
          expanded={expandedPanels.includes('signals')}
          onChange={handlePanelChange('signals')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Signal Filters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SignalFiltersPanel
              signalFilters={localConfig.signalFilters}
              onChange={(signalFilters) => handleConfigChange({ signalFilters })}
            />
          </AccordionDetails>
        </Accordion>

        {/* Exchange Configuration */}
        <Accordion 
          expanded={expandedPanels.includes('exchanges')}
          onChange={handlePanelChange('exchanges')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Exchange Configuration</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ExchangeConfigPanel
              exchanges={localConfig.exchanges}
              onChange={(exchanges) => handleConfigChange({ exchanges })}
            />
          </AccordionDetails>
        </Accordion>

        {/* Notifications */}
        <Accordion 
          expanded={expandedPanels.includes('notifications')}
          onChange={handlePanelChange('notifications')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Notifications</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <NotificationConfigPanel
              notifications={localConfig.notifications}
              onChange={(notifications) => handleConfigChange({ notifications })}
            />
          </AccordionDetails>
        </Accordion>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={loading || (validation && !validation.isValid) || !hasChanges}
        >
          {localConfig.id ? 'Update Configuration' : 'Create Configuration'}
        </Button>
      </Box>
    </Box>
  );
};