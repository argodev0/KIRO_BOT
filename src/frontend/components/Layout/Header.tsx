import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Settings,
  Notifications,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { logout } from '../../store/slices/authSlice';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { portfolio, botStatus } = useSelector((state: RootState) => state.trading);
  const { notifications } = useSelector((state: RootState) => state.ui);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    handleProfileMenuClose();
  };

  const unreadNotifications = notifications.filter(n => !n.autoHide).length;

  return (
    <AppBar 
      position="static" 
      elevation={1}
      sx={{ 
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Toolbar>
        {/* Menu button */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* Page title */}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          AI Crypto Trading Bot
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 2 }}>
          {/* Bot status */}
          <Chip
            label={`Bot: ${botStatus}`}
            size="small"
            color={
              botStatus === 'running' ? 'success' :
              botStatus === 'paused' ? 'warning' : 'default'
            }
            variant="outlined"
          />

          {/* Portfolio balance */}
          <Typography variant="body2" color="text.secondary">
            Balance: ${portfolio.totalBalance.toLocaleString()}
          </Typography>

          {/* P&L */}
          <Typography 
            variant="body2" 
            color={portfolio.totalUnrealizedPnl >= 0 ? 'success.main' : 'error.main'}
          >
            P&L: {portfolio.totalUnrealizedPnl >= 0 ? '+' : ''}${portfolio.totalUnrealizedPnl.toFixed(2)}
          </Typography>
        </Box>

        {/* Notifications */}
        <IconButton color="inherit" sx={{ mr: 1 }}>
          <Notifications />
          {unreadNotifications > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'error.main',
              }}
            />
          )}
        </IconButton>

        {/* User menu */}
        <IconButton
          edge="end"
          aria-label="account of current user"
          aria-controls="primary-search-account-menu"
          aria-haspopup="true"
          onClick={handleProfileMenuOpen}
          color="inherit"
        >
          <Avatar sx={{ width: 32, height: 32 }}>
            {user?.email?.charAt(0).toUpperCase()}
          </Avatar>
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          keepMounted
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
        >
          <MenuItem onClick={handleProfileMenuClose}>
            <AccountCircle sx={{ mr: 1 }} />
            Profile
          </MenuItem>
          <MenuItem onClick={handleProfileMenuClose}>
            <Settings sx={{ mr: 1 }} />
            Settings
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <Logout sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;