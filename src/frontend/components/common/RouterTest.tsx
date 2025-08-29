import React from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

const RouterTest: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const testRoutes = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/trading', label: 'Trading' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/bot-config', label: 'Bot Config' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        React Router Test
      </Typography>
      
      <Alert severity="info" sx={{ mb: 2 }}>
        Current Route: {location.pathname}
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {testRoutes.map((route) => (
          <Button
            key={route.path}
            variant={location.pathname === route.path ? 'contained' : 'outlined'}
            onClick={() => navigate(route.path)}
            size="small"
          >
            {route.label}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

export default RouterTest;