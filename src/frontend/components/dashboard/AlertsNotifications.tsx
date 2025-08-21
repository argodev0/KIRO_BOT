import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Badge,
  Collapse,
  Divider,
  Button,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  Warning,
  Error,
  Info,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Close,
  ExpandMore,
  ExpandLess,
  MoreVert,
  Clear,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';

interface Alert {
  id: string;
  type: 'signal' | 'risk' | 'system' | 'trade';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: any;
}

const AlertsNotifications: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { signals } = useSelector((state: RootState) => state.trading);
  const { isConnected } = useSelector((state: RootState) => state.marketData);

  // Mock alerts for demonstration
  useEffect(() => {
    const mockAlerts: Alert[] = [
      {
        id: '1',
        type: 'signal',
        severity: 'success',
        title: 'New Trading Signal',
        message: 'BTCUSDT Long signal generated with 85% confidence',
        timestamp: Date.now() - 300000,
        read: false,
        data: { symbol: 'BTCUSDT', direction: 'long', confidence: 85 }
      },
      {
        id: '2',
        type: 'trade',
        severity: 'info',
        title: 'Order Filled',
        message: 'Buy order for ETHUSDT filled at $2,450.50',
        timestamp: Date.now() - 600000,
        read: false,
        data: { symbol: 'ETHUSDT', side: 'buy', price: 2450.50 }
      },
      {
        id: '3',
        type: 'risk',
        severity: 'warning',
        title: 'Risk Limit Approaching',
        message: 'Daily loss approaching 3% limit (currently at 2.1%)',
        timestamp: Date.now() - 900000,
        read: true,
        data: { currentLoss: 2.1, limit: 3 }
      },
      {
        id: '4',
        type: 'system',
        severity: 'error',
        title: 'Exchange Connection Issue',
        message: 'Binance WebSocket connection temporarily lost',
        timestamp: Date.now() - 1200000,
        read: true,
        data: { exchange: 'Binance', status: 'reconnected' }
      },
    ];

    setAlerts(mockAlerts);
  }, []);

  const getAlertIcon = (type: string, severity: string) => {
    switch (type) {
      case 'signal':
        return severity === 'success' ? <TrendingUp color="success" /> : <TrendingDown color="error" />;
      case 'trade':
        return <CheckCircle color="info" />;
      case 'risk':
        return <Warning color="warning" />;
      case 'system':
        return severity === 'error' ? <Error color="error" /> : <Info color="info" />;
      default:
        return <Notifications />;
    }
  };

  const getSeverityColor = (severity: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'success': return 'success';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const unreadCount = alerts.filter(alert => !alert.read).length;

  const handleMarkAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  const handleMarkAllAsRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
    setAnchorEl(null);
  };

  const handleClearAll = () => {
    setAlerts([]);
    setAnchorEl(null);
  };

  const handleRemoveAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsActive sx={{ mr: 1 }} />
            </Badge>
            <Typography variant="h6">Alerts & Notifications</Typography>
          </Box>
          <Box>
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            <IconButton onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleMarkAllAsRead}>
            Mark all as read
          </MenuItem>
          <MenuItem onClick={handleClearAll}>
            Clear all
          </MenuItem>
        </Menu>

        <Collapse in={expanded}>
          {alerts.length > 0 ? (
            <List dense>
              {alerts.slice(0, 10).map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem
                    sx={{
                      backgroundColor: alert.read ? 'transparent' : 'action.hover',
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  >
                    <ListItemIcon>
                      {getAlertIcon(alert.type, alert.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={alert.read ? 'normal' : 'bold'}
                          >
                            {alert.title}
                          </Typography>
                          <Chip
                            label={alert.type}
                            color={getSeverityColor(alert.severity)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {alert.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimeAgo(alert.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box display="flex" alignItems="center">
                        {!alert.read && (
                          <Tooltip title="Mark as read">
                            <IconButton
                              size="small"
                              onClick={() => handleMarkAsRead(alert.id)}
                            >
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Remove">
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveAlert(alert.id)}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < alerts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              
              {alerts.length > 10 && (
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        +{alerts.length - 10} more notifications
                      </Typography>
                    }
                  />
                </ListItem>
              )}
            </List>
          ) : (
            <Box display="flex" alignItems="center" justifyContent="center" py={3}>
              <Typography variant="body2" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          )}

          {alerts.length > 0 && (
            <Box mt={2} display="flex" justifyContent="center">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Clear />}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default AlertsNotifications;