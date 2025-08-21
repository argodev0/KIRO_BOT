import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid2 as Grid,
  useTheme,
  useMediaQuery,
  Drawer,
  IconButton,
  AppBar,
  Toolbar,
  Typography,
  Fab,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import TradingViewChart from './TradingViewChart';
import MarketDataWidget from './MarketDataWidget';
import PortfolioOverview from './PortfolioOverview';
import TradeHistory from './TradeHistory';
import AlertsNotifications from './AlertsNotifications';

interface ResponsiveDashboardProps {
  children?: React.ReactNode;
}

const ResponsiveDashboard: React.FC<ResponsiveDashboardProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [fullscreenChart, setFullscreenChart] = useState(false);

  // Auto-close mobile drawer when screen size changes
  useEffect(() => {
    if (!isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [isMobile]);

  const handleDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  const toggleFullscreenChart = () => {
    setFullscreenChart(!fullscreenChart);
  };

  // Mobile sidebar content
  const sidebarContent = (
    <Box sx={{ width: 300, p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Dashboard Controls</Typography>
        <IconButton onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Box mb={2}>
        <AlertsNotifications />
      </Box>
    </Box>
  );

  // Fullscreen chart overlay
  if (fullscreenChart) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'background.default',
        }}
      >
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Trading Chart - Fullscreen
            </Typography>
            <IconButton onClick={toggleFullscreenChart} color="inherit">
              <FullscreenExit />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{ height: 'calc(100vh - 64px)' }}>
          <TradingViewChart height={window.innerHeight - 64} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 1, sm: 2, md: 3 } }}>
      {/* Mobile App Bar */}
      {isMobile && (
        <AppBar position="static" color="default" elevation={1} sx={{ mb: 2 }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Trading Dashboard
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileDrawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 300 },
        }}
      >
        {sidebarContent}
      </Drawer>

      <Grid container spacing={2}>
        {/* Main Chart Area */}
        <Grid xs={12} lg={8}>
          <Box
            sx={{
              position: 'relative',
              height: { xs: 300, sm: 400, md: 500, lg: 600 },
              mb: 2,
            }}
          >
            <TradingViewChart height={isMobile ? 300 : isTablet ? 400 : 600} />
            
            {/* Fullscreen button */}
            <Fab
              size="small"
              color="primary"
              onClick={toggleFullscreenChart}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1000,
              }}
            >
              <Fullscreen />
            </Fab>
          </Box>

          {/* Market Data Widget - Mobile/Tablet */}
          {(isMobile || isTablet) && (
            <Box mb={2}>
              <MarketDataWidget />
            </Box>
          )}

          {/* Trade History */}
          <Box mb={2}>
            <TradeHistory />
          </Box>
        </Grid>

        {/* Sidebar */}
        <Grid xs={12} lg={4}>
          <Box display="flex" flexDirection="column" gap={2}>
            {/* Portfolio Overview */}
            <PortfolioOverview />

            {/* Market Data Widget - Desktop */}
            {!isMobile && !isTablet && <MarketDataWidget />}

            {/* Alerts - Desktop */}
            {!isMobile && <AlertsNotifications />}
          </Box>
        </Grid>

        {/* Mobile-only Alerts at bottom */}
        {isMobile && (
          <Grid xs={12}>
            <AlertsNotifications />
          </Grid>
        )}
      </Grid>

      {children}
    </Box>
  );
};

export default ResponsiveDashboard;