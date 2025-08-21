import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Alert,
  Divider
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Save as SaveIcon } from '@mui/icons-material';
import { BotConfig, ConfigValidation } from '@/types/config';
import { StrategyConfigPanel } from './StrategyConfigPanel';
import { RiskManagementPanel } from './RiskManagementPanel';
import { SignalFiltersPanel } from './SignalFiltersPanel';
import { ExchangeConfigPanel } from './ExchangeConfigPanel';
import { NotificationConfigPanel } from './NotificationConfigPanel';
import { BasicConfigPanel } from './BasicConfigPanel';
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

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    // Validate configuration on changes
    const validateConfig = async () => {
      try {
        const response = await api.post('/config/validate', localConfig);
        setValidation(response.data.data);
      } catch (error) {
        console.error('Validation error:', error);
      }
    };

    const debounceTimer = setTimeout(validateConfig, 500);
    return () => clearTimeout(debounceTimer);
  }, [localConfig]);

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
      {/* Validation Results */}
      {validation && (
        <Box sx={{ mb: 3 }}>
          {validation.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Configuration Errors:
              </Typography>
              {validation.errors.map((error, index) => (
                <Typography key={index} variant="body2">
                  • {error.field}: {error.message}
                </Typography>
              ))}
            </Alert>
          )}
          
          {validation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Configuration Warnings:
              </Typography>
              {validation.warnings.map((warning, index) => (
                <Typography key={index} variant="body2">
                  • {warning.field}: {warning.message}
                  {warning.suggestion && ` (${warning.suggestion})`}
                </Typography>
              ))}
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