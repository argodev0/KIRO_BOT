import React from 'react';
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
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Settings,
  Notifications,
  Security,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { logout } from '../../store/slices/authSlice';
import PaperTradingIndicator from '../common/PaperTradingIndicator';
import LiveDataIndicator from '../common/LiveDataIndicator';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { isConnected } = useSelector((state: RootState) => state.marketData);
  const { botStatus } = useSelector((state: RootState) => state.trading);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

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

  const getBotStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'paused': return 'warning';
      case 'stopped': return 'default';
      default: return 'default';
    }
  };

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
        {/* Menu Button */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* Title */}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {isMobile ? 'KIRO' : 'KIRO Trading Bot'}
        </Typography>

        {/* Status Indicators */}
        <Box display="flex" alignItems="center" gap={1} mr={2}>
          {/* Live Data Status */}
          <LiveDataIndicator variant="chip" />
          
          {/* Paper Trading Indicator */}
          <PaperTradingIndicator variant="chip" size="small" />
          
          {/* Bot Status */}
          <Chip
            label={`Bot: ${botStatus}`}
            color={getBotStatusColor(botStatus)}
            size="small"
            icon={<Security />}
          />
        </Box>

        {/* Notifications */}
        <IconButton color="inherit" sx={{ mr: 1 }}>
          <Notifications />
        </IconButton>

        {/* User Profile */}
        <IconButton
          edge="end"
          aria-label="account of current user"
          aria-controls="primary-search-account-menu"
          aria-haspopup="true"
          onClick={handleProfileMenuOpen}
          color="inherit"
        >
          <Avatar sx={{ width: 32, height: 32 }}>
            {user?.username?.charAt(0).toUpperCase() || <AccountCircle />}
          </Avatar>
        </IconButton>

        {/* Profile Menu */}
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

      {/* Mobile Paper Trading Banner */}
      {isMobile && (
        <Box sx={{ px: 2, pb: 1 }}>
          <PaperTradingIndicator variant="banner" showDetails={false} />
        </Box>
      )}
    </AppBar>
  );
};

export default Header;