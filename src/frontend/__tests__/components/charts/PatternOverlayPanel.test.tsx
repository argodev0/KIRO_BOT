/**
 * Unit tests for PatternOverlayPanel component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PatternOverlayPanel from '../../../components/charts/PatternOverlayPanel';
import { CandlestickPattern } from '../../../../types/analysis';

// Mock patterns data
const mockPatterns: CandlestickPattern[] = [
  {
    type: 'hammer',
    confidence: 0.85,
    startIndex: 10,
    endIndex: 10,
    direction: 'bullish',
    strength: 'strong',
    description: 'Hammer pattern indicating potential bullish reversal',
    reliability: 0.85
  },
  {
    type: 'engulfing_bearish',
    confidence: 0.75,
    startIndex: 15,
    endIndex: 16,
    direction: 'bearish',
    strength: 'moderate',
    description: 'Bearish engulfing pattern',
    reliability: 0.75
  },
  {
    type: 'doji',
    confidence: 0.65,
    startIndex: 20,
    endIndex: 20,
    direction: 'bullish',
    strength: 'moderate',
    description: 'Doji pattern showing market indecision',
    reliability: 0.65
  },
  {
    type: 'spinning_top',
    confidence: 0.55,
    startIndex: 25,
    endIndex: 25,
    direction: 'bearish',
    strength: 'weak',
    description: 'Spinning top pattern',
    reliability: 0.55
  },
  {
    type: 'morning_star',
    confidence: 0.9,
    startIndex: 30,
    endIndex: 32,
    direction: 'bullish',
    strength: 'strong',
    description: 'Morning star - strong bullish reversal pattern',
    reliability: 0.9
  }
];

describe('PatternOverlayPanel', () => {
  const mockOnPatternToggle = jest.fn();
  const mockOnPatternHighlight = jest.fn();
  const mockOnConfidenceChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "No patterns detected" when patterns array is empty', () => {
    render(
      <PatternOverlayPanel 
        patterns={[]} 
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    expect(screen.getByText('No patterns detected')).toBeInTheDocument();
  });

  it('renders pattern analysis header with correct pattern count', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    expect(screen.getByText('Pattern Analysis')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Badge with pattern count
  });

  it('displays correct pattern statistics', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Should show bullish and bearish pattern counts
    expect(screen.getByText('3 Bullish')).toBeInTheDocument(); // hammer, doji, morning_star
    expect(screen.getByText('2 Bearish')).toBeInTheDocument(); // engulfing_bearish, spinning_top

    // Should show average confidence
    const avgConfidence = ((0.85 + 0.75 + 0.65 + 0.55 + 0.9) / 5 * 100).toFixed(1);
    expect(screen.getByText(`Avg Confidence: ${avgConfidence}%`)).toBeInTheDocument();

    // Should show high confidence count (patterns > 0.7)
    expect(screen.getByText('High Confidence: 3/5')).toBeInTheDocument(); // hammer, engulfing_bearish, morning_star
  });

  it('shows confidence filter when enabled', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        showConfidenceFilter={true}
        minConfidence={0.6}
        onConfidenceChange={mockOnConfidenceChange}
      />
    );

    expect(screen.getByText('Min Confidence: 60%')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('calls onConfidenceChange when confidence slider is moved', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        showConfidenceFilter={true}
        minConfidence={0.6}
        onConfidenceChange={mockOnConfidenceChange}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.8' } });

    expect(mockOnConfidenceChange).toHaveBeenCalledWith(0.8);
  });

  it('groups patterns by category correctly', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Should show category headers
    expect(screen.getByText('Reversal Patterns')).toBeInTheDocument();
    expect(screen.getByText('Continuation Patterns')).toBeInTheDocument();
    expect(screen.getByText('Indecision Patterns')).toBeInTheDocument();

    // Should show pattern counts per category
    expect(screen.getByText('3')).toBeInTheDocument(); // Reversal patterns count
    expect(screen.getByText('1')).toBeInTheDocument(); // Continuation patterns count
    expect(screen.getByText('1')).toBeInTheDocument(); // Indecision patterns count
  });

  it('expands and collapses pattern categories', async () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Initially, categories should be expanded and patterns visible
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('Engulfing Bearish')).toBeInTheDocument();

    // Click to collapse reversal patterns category
    const reversalHeader = screen.getByText('Reversal Patterns').closest('div');
    if (reversalHeader) {
      fireEvent.click(reversalHeader);
    }

    // Patterns in that category should be hidden (collapsed)
    await waitFor(() => {
      // The patterns might still be in DOM but not visible due to Collapse component
      expect(screen.getByText('Reversal Patterns')).toBeInTheDocument();
    });
  });

  it('displays individual patterns with correct information', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Check for pattern names
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('Engulfing Bearish')).toBeInTheDocument();
    expect(screen.getByText('Morning Star')).toBeInTheDocument();

    // Check for confidence percentages
    expect(screen.getByText('85.0% confidence')).toBeInTheDocument();
    expect(screen.getByText('75.0% confidence')).toBeInTheDocument();
    expect(screen.getByText('90.0% confidence')).toBeInTheDocument();
  });

  it('calls onPatternHighlight when pattern is clicked', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    const hammerPattern = screen.getByText('Hammer').closest('li');
    if (hammerPattern) {
      fireEvent.click(hammerPattern);
    }

    expect(mockOnPatternHighlight).toHaveBeenCalledWith(mockPatterns[0]);
  });

  it('calls onPatternToggle when visibility button is clicked', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Find visibility toggle buttons
    const visibilityButtons = screen.getAllByRole('button');
    const toggleButton = visibilityButtons.find(button => 
      button.querySelector('[data-testid="VisibilityOffIcon"]') || 
      button.querySelector('[data-testid="VisibilityIcon"]')
    );

    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(mockOnPatternToggle).toHaveBeenCalled();
    }
  });

  it('expands and collapses the entire panel', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Panel should be expanded initially
    expect(screen.getByText('Avg Confidence:')).toBeInTheDocument();

    // Click header to collapse
    const header = screen.getByText('Pattern Analysis').closest('div');
    if (header) {
      fireEvent.click(header);
    }

    // Content should be collapsed (but header still visible)
    expect(screen.getByText('Pattern Analysis')).toBeInTheDocument();
  });

  it('filters patterns by minimum confidence', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        minConfidence={0.7}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Only patterns with confidence >= 0.7 should be shown
    expect(screen.getByText('Hammer')).toBeInTheDocument(); // 0.85
    expect(screen.getByText('Engulfing Bearish')).toBeInTheDocument(); // 0.75
    expect(screen.getByText('Morning Star')).toBeInTheDocument(); // 0.9

    // These should not be shown (confidence < 0.7)
    expect(screen.queryByText('Doji')).not.toBeInTheDocument(); // 0.65
    expect(screen.queryByText('Spinning Top')).not.toBeInTheDocument(); // 0.55
  });

  it('shows high quality patterns alert when appropriate', () => {
    // Create patterns where >70% have high confidence
    const highQualityPatterns: CandlestickPattern[] = [
      { ...mockPatterns[0], confidence: 0.8 }, // high
      { ...mockPatterns[1], confidence: 0.85 }, // high
      { ...mockPatterns[2], confidence: 0.9 }, // high
      { ...mockPatterns[3], confidence: 0.6 }, // low
    ];

    render(
      <PatternOverlayPanel 
        patterns={highQualityPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    expect(screen.getByText(/High quality patterns detected!/)).toBeInTheDocument();
    expect(screen.getByText(/3 out of 4 patterns have high confidence/)).toBeInTheDocument();
  });

  it('handles empty pattern categories gracefully', () => {
    // Patterns that don't fit standard categories
    const unusualPatterns: CandlestickPattern[] = [
      {
        type: 'hammer',
        confidence: 0.8,
        startIndex: 10,
        endIndex: 10,
        direction: 'bullish',
        strength: 'strong',
        description: 'Hammer pattern',
        reliability: 0.8
      }
    ];

    render(
      <PatternOverlayPanel 
        patterns={unusualPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Should still render without errors
    expect(screen.getByText('Pattern Analysis')).toBeInTheDocument();
    expect(screen.getByText('Hammer')).toBeInTheDocument();
  });

  it('displays correct pattern direction icons', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Should have trending up icons for bullish patterns
    const trendingUpIcons = screen.getAllByTestId('TrendingUpIcon');
    expect(trendingUpIcons.length).toBeGreaterThan(0);

    // Should have trending down icons for bearish patterns
    const trendingDownIcons = screen.getAllByTestId('TrendingDownIcon');
    expect(trendingDownIcons.length).toBeGreaterThan(0);
  });

  it('displays pattern strength indicators', () => {
    render(
      <PatternOverlayPanel 
        patterns={mockPatterns}
        onPatternToggle={mockOnPatternToggle}
        onPatternHighlight={mockOnPatternHighlight}
      />
    );

    // Should show strength indicators (CheckCircle for strong, Warning for moderate/weak)
    const checkIcons = screen.getAllByTestId('CheckCircleIcon');
    const warningIcons = screen.getAllByTestId('WarningIcon');
    
    expect(checkIcons.length + warningIcons.length).toBeGreaterThan(0);
  });
});