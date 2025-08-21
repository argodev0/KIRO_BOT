import { configureStore } from '@reduxjs/toolkit';
import authReducer, { 
  login, 
  logout, 
  clearError, 
  clearMFA,
  AuthState 
} from '../../store/slices/authSlice';

// Mock API
jest.mock('../../services/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    verifyMFA: jest.fn(),
    refreshToken: jest.fn(),
  },
}));

describe('authSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });
    
    // Clear localStorage
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      expect(state).toEqual({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        mfaRequired: false,
        mfaToken: null,
      });
    });
  });

  describe('reducers', () => {
    it('should clear error', () => {
      // Set initial error state
      const initialState: AuthState = {
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Test error',
        mfaRequired: false,
        mfaToken: null,
      };

      const action = clearError();
      const newState = authReducer(initialState, action);
      
      expect(newState.error).toBeNull();
    });

    it('should clear MFA state', () => {
      const initialState: AuthState = {
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        mfaRequired: true,
        mfaToken: 'test-token',
      };

      const action = clearMFA();
      const newState = authReducer(initialState, action);
      
      expect(newState.mfaRequired).toBe(false);
      expect(newState.mfaToken).toBeNull();
    });
  });

  describe('async thunks', () => {
    it('should handle login pending', () => {
      const action = { type: login.pending.type };
      const state = authReducer(undefined, action);
      
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle login fulfilled without MFA', () => {
      const mockUser = { id: '1', email: 'test@example.com', isVerified: true, mfaEnabled: false };
      const mockResponse = {
        user: mockUser,
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        mfaRequired: false,
      };

      const action = { type: login.fulfilled.type, payload: mockResponse };
      const state = authReducer(undefined, action);
      
      expect(state.isLoading).toBe(false);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('test-token');
      expect(state.refreshToken).toBe('test-refresh-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.mfaRequired).toBe(false);
    });

    it('should handle login fulfilled with MFA required', () => {
      const mockResponse = {
        mfaRequired: true,
        mfaToken: 'mfa-token',
      };

      const action = { type: login.fulfilled.type, payload: mockResponse };
      const state = authReducer(undefined, action);
      
      expect(state.isLoading).toBe(false);
      expect(state.mfaRequired).toBe(true);
      expect(state.mfaToken).toBe('mfa-token');
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle login rejected', () => {
      const action = { type: login.rejected.type, payload: 'Login failed' };
      const state = authReducer(undefined, action);
      
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Login failed');
    });

    it('should handle logout fulfilled', () => {
      const initialState: AuthState = {
        user: { id: '1', email: 'test@example.com', isVerified: true, mfaEnabled: false },
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        mfaRequired: false,
        mfaToken: null,
      };

      const action = { type: logout.fulfilled.type };
      const state = authReducer(initialState, action);
      
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.mfaRequired).toBe(false);
      expect(state.mfaToken).toBeNull();
    });
  });
});