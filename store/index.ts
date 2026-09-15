import { configureStore } from '@reduxjs/toolkit';
import prescriptionReducer from './prescriptionSlice';

export const store = configureStore({ reducer: { prescription: prescriptionReducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


