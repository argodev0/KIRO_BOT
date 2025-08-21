import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CopyIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon
} from '@mui/icons-material';
import { BotConfig } from '@/types/config';

interface ConfigurationListProps {
  configs: BotConfig[];
  selectedConfig: BotConfig | null;
  onSelect: (config: BotConfig) => void;
  onDelete: (configId: string) => void;
  loading?: boolean;
}

export const ConfigurationList: React.FC<ConfigurationListProps> = ({
  configs,
  selectedConfig,
  onSelect,
  onDelete,
  loading = false
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuConfig, setMenuConfig] = React.useState<BotConfig | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, config: BotConfig) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setMenuConfig(config);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuConfig(null);
  };

  const handleEdit = () => {
    if (menuConfig) {
      onSelect(menuConfig);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (menuConfig?.id) {
      onDelete(menuConfig.id);
    }
    handleMenuClose();
  };

  const handleDuplicate = () => {
    if (menuConfig) {
      const duplicatedConfig = {
        ...menuConfig,
        id: undefined,
        name: `${menuConfig.name} (Copy)`,
        isActive: false
      };
      onSelect(duplicatedConfig);
    }
    handleMenuClose();
  };

  const getStrategyLabel = (strategyType: string): string => {
    const labels: Record<string, string> = {
      technical_analysis: 'Technical Analysis',
      elliott_wave: 'Elliott Wave',
      fibonacci_confluence: 'Fibonacci Confluence',
      grid_trading: 'Grid Trading',
      multi_strategy: 'Multi-Strategy'
    };
    return labels[strategyType] || strategyType;
  };

  const getRiskLevel = (riskPerTrade: number): { level: string; color: 'success' | 'warning' | 'error' } => {
    if (riskPerTrade <= 2) return { level: 'Conservative', color: 'success' };
    if (riskPerTrade <= 5) return { level: 'Moderate', color: 'warning' };
    return { level: 'Aggressive', color: 'error' };
  };

  if (configs.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No configurations found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first bot configuration to get started.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        All Configurations ({configs.length})
      </Typography>
      
      <Grid container spacing={3}>
        {configs.map((config) => {
          const riskLevel = getRiskLevel(config.riskManagement.maxRiskPerTrade);
          const isSelected = selectedConfig?.id === config.id;
          
          return (
            <Grid item xs={12} md={6} lg={4} key={config.id || config.name}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
                onClick={() => onSelect(config)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h3" noWrap>
                      {config.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, config)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Chip
                      label={config.isActive ? 'Active' : 'Inactive'}
                      color={config.isActive ? 'success' : 'default'}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                    <Chip
                      label={getStrategyLabel(config.strategy.type)}
                      variant="outlined"
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                    <Chip
                      label={riskLevel.level}
                      color={riskLevel.color}
                      size="small"
                      sx={{ mb: 1 }}
                    />
                  </Box>

                  {config.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {config.description.length > 100 
                        ? `${config.description.substring(0, 100)}...`
                        : config.description
                      }
                    </Typography>
                  )}

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Symbols: {config.strategy.symbols.slice(0, 3).join(', ')}
                      {config.strategy.symbols.length > 3 && ` +${config.strategy.symbols.length - 3} more`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Timeframes: {config.strategy.timeframes.join(', ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Max Risk: {config.riskManagement.maxRiskPerTrade}% per trade
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Exchanges: {config.exchanges.filter(e => e.enabled).map(e => e.name).join(', ')}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(config);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    startIcon={config.isActive ? <StopIcon /> : <StartIcon />}
                    color={config.isActive ? 'error' : 'success'}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle start/stop logic here
                    }}
                  >
                    {config.isActive ? 'Stop' : 'Start'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Configuration</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};