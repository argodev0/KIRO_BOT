import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import { Security } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { verifyMFA, clearError } from '../../store/slices/authSlice';

interface MFADialogProps {
  open: boolean;
  token: string;
  onSuccess: () => void;
}

const MFADialog: React.FC<MFADialogProps> = ({ open, token, onSuccess }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);
  
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    
    if (codeError) {
      setCodeError('');
    }
    
    if (error) {
      dispatch(clearError());
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!code) {
      setCodeError('Verification code is required');
      return;
    }
    
    if (code.length !== 6) {
      setCodeError('Verification code must be 6 digits');
      return;
    }

    try {
      await dispatch(verifyMFA({ token, code })).unwrap();
      onSuccess();
    } catch (error) {
      // Error is handled by the slice
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Security sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h5" component="div">
          Two-Factor Authentication
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Please enter the 6-digit verification code from your authenticator app
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Verification Code"
            value={code}
            onChange={handleCodeChange}
            error={!!codeError}
            helperText={codeError}
            placeholder="000000"
            inputProps={{
              maxLength: 6,
              style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }
            }}
            sx={{ mb: 2 }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          Can't access your authenticator? Contact support for assistance.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={isLoading || code.length !== 6}
        >
          {isLoading ? (
            <CircularProgress size={24} />
          ) : (
            'Verify'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MFADialog;