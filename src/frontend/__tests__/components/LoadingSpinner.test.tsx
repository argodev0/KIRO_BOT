import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('LoadingSpinner', () => {
  it('renders with default message', () => {
    renderWithTheme(<LoadingSpinner />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    const customMessage = 'Please wait...';
    renderWithTheme(<LoadingSpinner message={customMessage} />);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('applies correct CSS classes', () => {
    renderWithTheme(<LoadingSpinner />);
    
    const container = screen.getByText('Loading...').closest('.loading-spinner');
    expect(container).toBeInTheDocument();
  });
});