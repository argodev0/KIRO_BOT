/**
 * Pattern Overlay Panel Component
 * Displays detected patterns with detailed information and highlighting controls
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Badge,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NeutralIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { CandlestickPattern, PatternType } from '../../../types/analysis';

interface PatternOverlayPanelProps {
  patterns: CandlestickPattern[];
  onPatternToggle?: (patternId: string, visible: boolean) => void;
  onPatternHighlight?: (pattern: CandlestickPattern) => void;
  showConfidenceFilter?: boolean;
  minConfidence?: number;
  onConfidenceChange?: (confidence: number) => void;
}

interface PatternGroup {
  category: string;
  patterns: CandlestickPattern[];
  visible: boolean;
}

const PATTERN_CATEGORIES = {
  reversal: {
    label: 'Reversal Patterns',
    patterns: [
      'doji', 'hammer', 'hanging_man', 'shooting_star', 'inverted_hammer',
      'engulfing_bullish', 'engulfing_bearish', 'harami_bullish', 'harami_bearish',
      'morning_star', 'evening_star', 'piercing_line', 'dark_cloud_cover'
    ],
    color: '#FF6B6B'
  },
  continuation: {
    label: 'Continuation Patterns',
    patterns: [
      'spinning_top', 'marubozu_bullish', 'marubozu_bearish',
      'three_white_soldiers', 'three_black_crows'
    ],
    color: '#4ECDC4'
  },
  indecision: {
    label: 'Indecision Patterns',
    patterns: [
      'long_legged_doji', 'dragonfly_doji', 'gravestone_doji'
    ],
    color: '#FFE66D'
  }
};

const PatternOverlayPanel: React.FC<PatternOverlayPanelProps> = ({
  patterns,
  onPatternToggle,
  onPatternHighlight,
  showConfidenceFilter = true,
  minConfidence = 0.5,
  onConfidenceChange
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [visiblePatterns, setVisiblePatterns] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['reversal', 'continuation', 'indecision'])
  );
  const [highlightedPattern, setHighlightedPattern] = useState<string | null>(null);

  // Group patterns by category
  const groupedPatterns = React.useMemo(() => {
    const groups: Record<string, PatternGroup> = {};
    
    Object.entries(PATTERN_CATEGORIES).forEach(([key, category]) => {
      groups[key] = {
        category: category.label,
        patterns: patterns.filter(pattern => 
          category.patterns.includes(pattern.type) && 
          pattern.confidence >= minConfidence
        ),
        visible: expandedCategories.has(key)
      };
    });

    return groups;
  }, [patterns, minConfidence, expandedCategories]);

  // Get pattern statistics
  const patternStats = React.useMemo(() => {
    const total = patterns.length;
    const bullish = patterns.filter(p => p.direction === 'bullish').length;
    const bearish = patterns.filter(p => p.direction === 'bearish').length;
    const highConfidence = patterns.filter(p => p.confidence > 0.7).length;
    const avgConfidence = patterns.length > 0 
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length 
      : 0;

    return { total, bullish, bearish, highConfidence, avgConfidence };
  }, [patterns]);

  // Handle pattern visibility toggle
  const handlePatternToggle = useCallback((pattern: CandlestickPattern) => {
    const patternId = `${pattern.type}_${pattern.startIndex}_${pattern.endIndex}`;
    const isVisible = visiblePatterns.has(patternId);
    
    if (isVisible) {
      setVisiblePatterns(prev => {
        const newSet = new Set(prev);
        newSet.delete(patternId);
        return newSet;
      });
    } else {
      setVisiblePatterns(prev => new Set(prev).add(patternId));
    }

    if (onPatternToggle) {
      onPatternToggle(patternId, !isVisible);
    }
  }, [visiblePatterns, onPatternToggle]);

  // Handle pattern highlight
  const handlePatternHighlight = useCallback((pattern: CandlestickPattern) => {
    const patternId = `${pattern.type}_${pattern.startIndex}_${pattern.endIndex}`;
    setHighlightedPattern(patternId);
    
    if (onPatternHighlight) {
      onPatternHighlight(pattern);
    }
  }, [onPatternHighlight]);

  // Handle category expansion
  const handleCategoryToggle = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Get pattern icon
  const getPatternIcon = (pattern: CandlestickPattern) => {
    switch (pattern.direction) {
      case 'bullish':
        return <TrendingUpIcon sx={{ color: '#00FF00', fontSize: 16 }} />;
      case 'bearish':
        return <TrendingDownIcon sx={{ color: '#FF0000', fontSize: 16 }} />;
      default:
        return <NeutralIcon sx={{ color: '#FFE66D', fontSize: 16 }} />;
    }
  };

  // Get pattern strength icon
  const getStrengthIcon = (strength: string) => {
    switch (strength) {
      case 'strong':
        return <CheckCircleIcon sx={{ color: '#00FF00', fontSize: 14 }} />;
      case 'moderate':
        return <WarningIcon sx={{ color: '#FFE66D', fontSize: 14 }} />;
      case 'weak':
        return <WarningIcon sx={{ color: '#FF6B6B', fontSize: 14 }} />;
      default:
        return null;
    }
  };

  // Get pattern display name
  const getPatternDisplayName = (type: PatternType): string => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (patterns.length === 0) {
    return (
      <Paper
        elevation={2}
        sx={{
          position: 'absolute',
          top: 120,
          right: 220,
          backgroundColor: 'rgba(26, 26, 26, 0.95)',
          borderRadius: 2,
          p: 2,
          minWidth: 200,
          backdropFilter: 'blur(10px)',
          border: '1px solid #2a2a2a',
          zIndex: 1000
        }}
      >
        <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center' }}>
          No patterns detected
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        position: 'absolute',
        top: 120,
        right: 220,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderRadius: 2,
        p: 1,
        minWidth: 280,
        maxWidth: 350,
        maxHeight: 500,
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        border: '1px solid #2a2a2a',
        zIndex: 1000
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <StarIcon sx={{ color: '#FFD700', fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 'bold' }}>
            Pattern Analysis
          </Typography>
          <Badge badgeContent={patterns.length} color="primary" />
        </Stack>
        
        <IconButton size="small" sx={{ color: '#fff' }}>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        {/* Pattern Statistics */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip
              label={`${patternStats.bullish} Bullish`}
              size="small"
              sx={{
                backgroundColor: 'rgba(0, 255, 0, 0.2)',
                color: '#00FF00',
                fontSize: '0.7rem'
              }}
            />
            <Chip
              label={`${patternStats.bearish} Bearish`}
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 0, 0, 0.2)',
                color: '#FF0000',
                fontSize: '0.7rem'
              }}
            />
          </Stack>
          
          <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
            Avg Confidence: {(patternStats.avgConfidence * 100).toFixed(1)}%
          </Typography>
          <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
            High Confidence: {patternStats.highConfidence}/{patternStats.total}
          </Typography>
        </Box>

        {/* Confidence Filter */}
        {showConfidenceFilter && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 0.5 }}>
              Min Confidence: {(minConfidence * 100).toFixed(0)}%
            </Typography>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={minConfidence}
              onChange={(e) => onConfidenceChange?.(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: 4,
                backgroundColor: '#2a2a2a',
                outline: 'none',
                borderRadius: 2
              }}
            />
          </Box>
        )}

        {/* Pattern Categories */}
        <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
          {Object.entries(groupedPatterns).map(([categoryKey, group]) => {
            const categoryInfo = PATTERN_CATEGORIES[categoryKey as keyof typeof PATTERN_CATEGORIES];
            
            if (group.patterns.length === 0) return null;

            return (
              <Box key={categoryKey} sx={{ mb: 1 }}>
                {/* Category Header */}
                <Box
                  onClick={() => handleCategoryToggle(categoryKey)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: categoryInfo.color
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 'bold' }}>
                      {group.category}
                    </Typography>
                    <Chip
                      label={group.patterns.length}
                      size="small"
                      sx={{
                        backgroundColor: categoryInfo.color,
                        color: '#000',
                        fontSize: '0.6rem',
                        height: 16
                      }}
                    />
                  </Stack>
                  
                  <IconButton size="small" sx={{ color: '#fff' }}>
                    {expandedCategories.has(categoryKey) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </Box>

                {/* Pattern List */}
                <Collapse in={expandedCategories.has(categoryKey)}>
                  <List dense sx={{ pl: 1 }}>
                    {group.patterns.map((pattern, index) => {
                      const patternId = `${pattern.type}_${pattern.startIndex}_${pattern.endIndex}`;
                      const isVisible = visiblePatterns.has(patternId);
                      const isHighlighted = highlightedPattern === patternId;

                      return (
                        <ListItem
                          key={`${pattern.type}_${index}`}
                          sx={{
                            py: 0.5,
                            px: 1,
                            borderRadius: 1,
                            backgroundColor: isHighlighted ? 'rgba(78, 205, 196, 0.2)' : 'transparent',
                            border: isHighlighted ? '1px solid #4ECDC4' : '1px solid transparent',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'rgba(78, 205, 196, 0.1)' }
                          }}
                          onClick={() => handlePatternHighlight(pattern)}
                        >
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            {getPatternIcon(pattern)}
                          </ListItemIcon>
                          
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.75rem' }}>
                                  {getPatternDisplayName(pattern.type)}
                                </Typography>
                                {getStrengthIcon(pattern.strength)}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.65rem' }}>
                                {(pattern.confidence * 100).toFixed(1)}% confidence
                              </Typography>
                            }
                          />
                          
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePatternToggle(pattern);
                            }}
                            sx={{
                              color: isVisible ? '#4ECDC4' : '#666',
                              '&:hover': { backgroundColor: 'rgba(78, 205, 196, 0.1)' }
                            }}
                          >
                            {isVisible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                          </IconButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </Box>

        {/* Pattern Quality Alert */}
        {patternStats.highConfidence / patternStats.total > 0.7 && (
          <Alert
            severity="success"
            sx={{
              mt: 1,
              backgroundColor: 'rgba(0, 255, 0, 0.1)',
              color: '#00FF00',
              '& .MuiAlert-icon': { color: '#00FF00' }
            }}
          >
            <Typography variant="caption">
              High quality patterns detected! {patternStats.highConfidence} out of {patternStats.total} patterns have high confidence.
            </Typography>
          </Alert>
        )}
      </Collapse>
    </Paper>
  );
};

export default PatternOverlayPanel;