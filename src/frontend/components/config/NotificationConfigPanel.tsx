import React from 'react';
import {
  Box,
  Typography,
  Grid,
  FormControlLabel,
  Switch,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { NotificationConfig, NotificationEvent } from '@/types/config';

interface NotificationConfigPanelProps {
  notifications: NotificationConfig;
  onChange: (notifications: NotificationConfig) => void;
}

export const NotificationConfigPanel: React.FC<NotificationConfigPanelProps> = ({
  notifications,
  onChange
}) => {
  const handleNestedChange = (section: keyof NotificationConfig, field: string, value: any) => {
    onChange({
      ...notifications,
      [section]: {
        ...notifications[section],
        [field]: value
      }
    });
  };

  const availableEvents: NotificationEvent[] = [
    'signal_generated',
    'trade_executed',
    'position_closed',
    'risk_violation',
    'emergency_stop',
    'grid_level_filled',
    'system_error'
  ];

  const eventLabels: Record<NotificationEvent, string> = {
    signal_generated: 'Signal Generated',
    trade_executed: 'Trade Executed',
    position_closed: 'Position Closed',
    risk_violation: 'Risk Violation',
    emergency_stop: 'Emergency Stop',
    grid_level_filled: 'Grid Level Filled',
    system_error: 'System Error'
  };

  const toggleEvent = (section: keyof NotificationConfig, event: NotificationEvent) => {
    const currentEvents = notifications[section].events;
    const newEvents = currentEvents.includes(event)
      ? currentEvents.filter(e => e !== event)
      : [...currentEvents, event];
    
    handleNestedChange(section, 'events', newEvents);
  };

  return (
    <Box>
      {/* Email Notifications */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Email Notifications</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifications.email.enabled}
                    onChange={(e) => handleNestedChange('email', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Email Notifications"
              />
            </Grid>

            {notifications.email.enabled && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Email Address"
                    value={notifications.email.address || ''}
                    onChange={(e) => handleNestedChange('email', 'address', e.target.value)}
                    helperText="Email address to receive notifications"
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Email Events
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableEvents.map((event) => (
                      <Chip
                        key={event}
                        label={eventLabels[event]}
                        clickable
                        color={notifications.email.events.includes(event) ? 'primary' : 'default'}
                        onClick={() => toggleEvent('email', event)}
                      />
                    ))}
                  </Box>
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Webhook Notifications */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Webhook Notifications</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifications.webhook.enabled}
                    onChange={(e) => handleNestedChange('webhook', 'enabled', e.target.checked)}
                  />
                }
                label="Enable Webhook Notifications"
              />
            </Grid>

            {notifications.webhook.enabled && (
              <>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Webhook URL"
                    value={notifications.webhook.url || ''}
                    onChange={(e) => handleNestedChange('webhook', 'url', e.target.value)}
                    helperText="HTTP endpoint to receive webhook notifications"
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Webhook Events
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableEvents.map((event) => (
                      <Chip
                        key={event}
                        label={eventLabels[event]}
                        clickable
                        color={notifications.webhook.events.includes(event) ? 'primary' : 'default'}
                        onClick={() => toggleEvent('webhook', event)}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Custom Headers (Optional)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Headers (JSON format)"
                    value={JSON.stringify(notifications.webhook.headers || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const headers = JSON.parse(e.target.value);
                        handleNestedChange('webhook', 'headers', headers);
                      } catch (error) {
                        // Invalid JSON, ignore for now
                      }
                    }}
                    helperText='Example: {"Authorization": "Bearer token", "Content-Type": "application/json"}'
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* In-App Notifications */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">In-App Notifications</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifications.inApp.enabled}
                    onChange={(e) => handleNestedChange('inApp', 'enabled', e.target.checked)}
                  />
                }
                label="Enable In-App Notifications"
              />
            </Grid>

            {notifications.inApp.enabled && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.inApp.sound}
                        onChange={(e) => handleNestedChange('inApp', 'sound', e.target.checked)}
                      />
                    }
                    label="Enable Sound Notifications"
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    In-App Events
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableEvents.map((event) => (
                      <Chip
                        key={event}
                        label={eventLabels[event]}
                        clickable
                        color={notifications.inApp.events.includes(event) ? 'primary' : 'default'}
                        onClick={() => toggleEvent('inApp', event)}
                      />
                    ))}
                  </Box>
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};