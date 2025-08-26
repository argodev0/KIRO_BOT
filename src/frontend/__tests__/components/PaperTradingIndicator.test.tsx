import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaperTradingIndicator from '../../components/common/PaperTradingIndicator';

describe('PaperTradingIndicator', () => {
  it('renders chip variant by default', () => {
    render(<PaperTradingIndicator />);
    
    expect(screen.getByText('PAPER TRADING')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveClass('MuiChip-root');
  });

  it('renders banner variant with details', () => {
    render(<PaperTradingIndicator variant="banner" showDetails={true} />);
    
    expect(screen.getByText('PAPER TRADING MODE ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('All trades are simulated - No real money at risk')).toBeInTheDocument();
  });

  it('expands details when clicked in banner mode', () => {
    render(<PaperTradingIndicator variant="banner" showDetails={true} />);
    
    const expandButton = screen.getByRole('button');
    fireEvent.click(expandButton);
    
    expect(screen.getByText('Paper Trading Safety Features:')).toBeInTheDocument();
    expect(screen.getByText('All trading operations are simulated')).toBeInTheDocument();
  });

  it('renders inline variant', () => {
    render(<PaperTradingIndicator variant="inline" />);
    
    expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
  });

  it('shows tooltip on chip hover', () => {
    render(<PaperTradingIndicator variant="chip" />);
    
    const chip = screen.getByRole('button');
    fireEvent.mouseOver(chip);
    
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('applies correct styling for different sizes', () => {
    const { rerender } = render(<PaperTradingIndicator variant="chip" size="small" />);
    expect(screen.getByRole('button')).toHaveClass('MuiChip-sizeSmall');
    
    rerender(<PaperTradingIndicator variant="chip" size="large" />);
    expect(screen.getByRole('button')).toHaveClass('MuiChip-sizeMedium');
  });
});