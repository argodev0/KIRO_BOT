import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import marketDataReducer from './slices/marketDataSlice';
import tradingReducer from './slices/tradingSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    marketData: marketDataReducer,
    trading: tradingReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;