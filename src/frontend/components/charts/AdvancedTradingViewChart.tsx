/**
 * Advanced TradingView Chart Component
 * Enhanced chart with Elliott Wave, Fibonacci, and pattern overlays
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Stack,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  ShowChart as ShowChartIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import ChartOverlays from './ChartOverlays';
import MultiTimeframeSync from './MultiTimeframeSync';
import CustomDrawingTools from './CustomDrawingTools';
import { AnalysisResults } from '../../../types/analysis';

interface AdvancedTradingViewChartProps {
  symbol?: string;
  interval?: string;
  height?: number;
  analysisData?: AnalysisResults;
  onAnalysisUpdate?: (analysis: AnalysisResults) => void;
}

interface ChartSettings {
  showElliottWave: boolean;
  showFibonacci: boolean;
  showPatterns: boolean;
  showConfluence: boolean;
  showVolumeProfile: boolean;
  enableDrawingTools: boolean;
  syncTimeframes: boolean;
  autoRefresh: boolean;
}

const AdvancedTradingViewChart: React.FC<AdvancedTradingViewChartProps> = ({
  symbol = 'BTCUSDT',
  interval = '1H',
  height = 600,
  analysisData,
  onAnalysisUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  
  const { selectedSymbol, selectedTimeframe } = useSelector((state: RootState) => state.marketData);
  const dispatch = useDispatch();

  const currentSymbol = symbol || selectedSymbol;
  const currentInterval = interval || selectedTimeframe;

  // Chart settings state
  const [settings, setSettings] = useState<ChartSettings>({
    showElliottWave: true,
    showFibonacci: true,
    showPatterns: true,
    showConfluence: true,
    showVolumeProfile: false,
    enableDrawingTools: true,
    syncTimeframes: false,
    autoRefresh: true
  });

  // Initialize TradingView widget
  const initializeChart = useCallback(() => {
    if (!containerRef.current) return;

    setIsLoading(true);
    setError(null);

    // Clean up previous widget
    if (widgetRef.current) {
      try {
        widgetRef.current.remove();
      } catch (e) {
        console.warn('Failed to remove previous widget:', e);
      }
    }

    // Create TradingView widget
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      try {
        if (window.TradingView) {
          widgetRef.current = new window.TradingView.widget({
            autosize: true,
            symbol: `BINANCE:${currentSymbol}`,
            interval: currentInterval,
            container_id: containerRef.current?.id || 'advanced_tradingview_chart',
            datafeed: new window.Datafeeds.UDFCompatibleDatafeed('https://demo_feed.tradingview.com'),
            library_path: '/charting_library/',
            locale: 'en',
            disabled_features: [
              'use_localstorage_for_settings',
              'volume_force_overlay',
              'create_volume_indicator_by_default'
            ],
            enabled_features: [
              'study_templates',
              'side_toolbar_in_fullscreen_mode',
              'header_in_fullscreen_mode',
              'disable_resolution_rebuild'
            ],
            charts_storage_url: 'https://saveload.tradingview.com',
            charts_storage_api_version: '1.1',
            client_id: 'tradingview.com',
            user_id: 'public_user_id',
            fullscreen: false,
            autosize: true,
            studies_overrides: {},
            theme: 'dark',
            custom_css_url: '/tradingview-chart.css',
            loading_screen: { backgroundColor: '#1a1a1a' },
            overrides: {
              'paneProperties.background': '#1a1a1a',
              'paneProperties.vertGridProperties.color': '#2a2a2a',
              'paneProperties.horzGridProperties.color': '#2a2a2a',
              'symbolWatermarkProperties.transparency': 90,
              'scalesProperties.textColor': '#AAA',
              'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
              'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
              'mainSeriesProperties.candleStyle.upColor': '#26a69a',
              'mainSeriesProperties.candleStyle.downColor': '#ef5350',
              'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
              'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
            },
            // Add custom toolbar
            toolbar_bg: '#1a1a1a',
            studies_access: {
              type: 'black',
              tools: [
                {
                  name: 'Elliott Wave',
                  grayed: false,
                },
                {
                  name: 'Fibonacci Retracement',
                  grayed: false,
                },
                {
                  name: 'Fibonacci Extension',
                  grayed: false,
                }
              ]
            },
            // Chart ready callback
            onChartReady: () => {
              setIsLoading(false);
              console.log('Advanced TradingView chart ready');
              
              // Enable drawing tools if requested
              if (settings.enableDrawingTools) {
                enableDrawingTools();
              }
            }
          });
        }
      } catch (error) {
        console.error('Failed to initialize TradingView widget:', error);
        setError('Failed to load chart. Please refresh the page.');
        setIsLoading(false);
      }
    };

    script.onerror = () => {
      setError('Failed to load TradingView library. Please check your internet connection.');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [currentSymbol, currentInterval, settings.enableDrawingTools]);

  // Enable drawing tools
  const enableDrawingTools = useCallback(() => {
    if (!widgetRef.current) return;

    try {
      const chart = widgetRef.current.chart();
      
      // Add custom drawing tools
      chart.createStudy('Trend Line', false, false);
      chart.createStudy('Horizontal Line', false, false);
      chart.createStudy('Fibonacci Retracement', false, false);
      chart.createStudy('Fibonacci Extension', false, false);
      
    } catch (error) {
      console.warn('Failed to enable drawing tools:', error);
    }
  }, []);

  // Handle settings change
  const handleSettingChange = (setting: keyof ChartSettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  // Handle settings menu
  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  // Initialize chart on mount and when dependencies change
  useEffect(() => {
    const cleanup = initializeChart();
    return cleanup;
  }, [initializeChart]);

  // Auto-refresh analysis data
  useEffect(() => {
    if (!settings.autoRefresh || !onAnalysisUpdate) return;

    const interval = setInterval(() => {
      // Trigger analysis update
      // This would typically call an API to get fresh analysis data
      console.log('Auto-refreshing analysis data...');
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [settings.autoRefresh, onAnalysisUpdate]);

  return (
    <Paper
      elevation={2}
      sx={{
        height,
        backgroundColor: '#1a1a1a',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Chart Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          borderBottom: '1px solid #2a2a2a',
          backgroundColor: '#1e1e1e'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ShowChartIcon sx={{ color: '#4ECDC4' }} />
          <Typography variant="h6" sx={{ color: '#fff' }}>
            {currentSymbol} - {currentInterval}
          </Typography>
          
          {/* Analysis Status Chips */}
          {analysisData && (
            <Stack direction="row" spacing={0.5}>
              {settings.showElliottWave && analysisData.elliottWave && (
                <Chip
                  label={`Wave ${analysisData.elliottWave.currentWave.type.replace('wave_', '')}`}
                  size="small"
                  sx={{
                    backgroundColor: '#4ECDC4',
                    color: '#000',
                    fontSize: '0.7rem'
                  }}
                />
              )}
              
              {settings.showPatterns && analysisData.patterns.length > 0 && (
                <Chip
                  label={`${analysisData.patterns.length} Patterns`}
                  size="small"
                  sx={{
                    backgroundColor: '#FFE66D',
                    color: '#000',
                    fontSize: '0.7rem'
                  }}
                />
              )}
              
              {settings.showConfluence && analysisData.confluence.length > 0 && (
                <Chip
                  label={`${analysisData.confluence.length} Confluence`}
                  size="small"
                  sx={{
                    backgroundColor: '#FFD700',
                    color: '#000',
                    fontSize: '0.7rem'
                  }}
                />
              )}
            </Stack>
          )}
        </Stack>

        {/* Chart Controls */}
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Quick Toggle Buttons */}
          <Tooltip title="Toggle Elliott Wave">
            <IconButton
              size="small"
              onClick={() => handleSettingChange('showElliottWave', !settings.showElliottWave)}
              sx={{
                color: settings.showElliottWave ? '#4ECDC4' : '#666',
                '&:hover': { backgroundColor: 'rgba(78, 205, 196, 0.1)' }
              }}
            >
              <TimelineIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Toggle Fibonacci">
            <IconButton
              size="small"
              onClick={() => handleSettingChange('showFibonacci', !settings.showFibonacci)}
              sx={{
                color: settings.showFibonacci ? '#FFD700' : '#666',
                '&:hover': { backgroundColor: 'rgba(255, 215, 0, 0.1)' }
              }}
            >
              {settings.showFibonacci ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Settings Menu */}
          <Tooltip title="Chart Settings">
            <IconButton
              size="small"
              onClick={handleSettingsClick}
              sx={{
                color: '#fff',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            color: '#fff'
          }}
        >
          <Typography>Loading chart...</Typography>
        </Box>
      )}

      {/* Chart Container */}
      <Box
        ref={containerRef}
        id="advanced_tradingview_chart"
        sx={{
          width: '100%',
          height: height - 60, // Subtract header height
          backgroundColor: '#1a1a1a',
        }}
      />

      {/* Chart Overlays */}
      {widgetRef.current && (
        <>
          <ChartOverlays
            chartWidget={widgetRef.current}
            analysisData={analysisData}
            showElliottWave={settings.showElliottWave}
            showFibonacci={settings.showFibonacci}
            showPatterns={settings.showPatterns}
            showConfluence={settings.showConfluence}
          />
          
          {settings.syncTimeframes && (
            <MultiTimeframeSync
              chartWidget={widgetRef.current}
              currentTimeframe={currentInterval}
            />
          )}
          
          {settings.enableDrawingTools && (
            <CustomDrawingTools
              chartWidget={widgetRef.current}
            />
          )}
        </>
      )}

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={handleSettingsClose}
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            color: '#fff',
            minWidth: 250
          }
        }}
      >
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={settings.showElliottWave}
                onChange={(e) => handleSettingChange('showElliottWave', e.target.checked)}
                size="small"
              />
            }
            label="Elliott Wave Analysis"
            sx={{ color: '#fff', width: '100%' }}
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={settings.showFibonacci}
                onChange={(e) => handleSettingChange('showFibonacci', e.target.checked)}
                size="small"
              />
            }
            label="Fibonacci Levels"
            sx={{ color: '#fff', width: '100%' }}
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={settings.showPatterns}
                onChange={(e) => handleSettingChange('showPatterns', e.target.checked)}
                size="small"
              />
            }
            label="Candlestick Patterns"
            sx={{ color: '#fff', width: '100%' }}
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={settings.showConfluence}
                onChange={(e) => handleSettingChange('showConfluence', e.target.checked)}
                size="small"
              />
            }
            label="Confluence Zones"
            sx={{ color: '#fff', width: '100%' }}
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enableDrawingTools}
                onChange={(e) => handleSettingChange('enableDrawingTools', e.target.checked)}
                size="small"
              />
            }
            label="Drawing Tools"
            sx={{ color: '#fff', width: '100%' }}
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={settings.syncTimeframes}
                onChange={(e) => handleSettingChange('syncTimeframes', e.target.checked)}
                size="small"
              />
            }
            label="Multi-Timeframe Sync"
            sx={{ color: '#fff', width: '100%' }}
          />
        </MenuItem>
        
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={settings.autoRefresh}
                onChange={(e) => handleSettingChange('autoRefresh', e.target.checked)}
                size="small"
              />
            }
            label="Auto Refresh"
            sx={{ color: '#fff', width: '100%' }}
          />
        </MenuItem>
      </Menu>
    </Paper>
  );
};

// Extend Window interface for TradingView
declare global {
  interface Window {
    TradingView: any;
    Datafeeds: any;
  }
}

export default AdvancedTradingViewChart;