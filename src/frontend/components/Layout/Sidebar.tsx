import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Dashboard,
  TrendingUp,
  Analytics,
  Settings,
  SmartToy,
  Security,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import PaperTradingIndicator from '../common/PaperTradingIndicator';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  width: number;
  isMobile: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose, width, isMobile }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Trading', icon: <TrendingUp />, path: '/trading' },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
    { text: 'Bot Config', icon: <SmartToy />, path: '/bot-config' },
    { text: 'Settings', icon: <Settings />, path: '/settings' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  const drawerContent = (
    <Box sx={{ width, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" fontWeight="bold" color="primary">
          KIRO BOT
        </Typography>
        <Typography variant="caption" color="text.secondary">
          AI Trading Platform
        </Typography>
      </Box>

      {/* Paper Trading Indicator */}
      <Box sx={{ px: 2, mb: 2 }}>
        <PaperTradingIndicator variant="banner" showDetails={false} />
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '30',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path 
                    ? theme.palette.primary.main 
                    : 'inherit'
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: location.pathname === item.path ? 'bold' : 'normal',
                    color: location.pathname === item.path 
                      ? theme.palette.primary.main 
                      : 'inherit'
                  }
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* Footer */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
          <Security color="warning" fontSize="small" />
          <Typography variant="caption" color="warning.main" fontWeight="bold">
            PAPER TRADING ONLY
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          No real money at risk
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
      sx={{
        width: width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: width,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;