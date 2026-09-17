import { configureStore } from "@reduxjs/toolkit";
import cityReducer from "./citySlice";
import patientLookupReducer from "./patientLookupSlice";
import { api } from "./apiSlice";
import landingReducer from "./landingSlice";

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    cities: cityReducer,
    patientLookup: patientLookupReducer,
    landing: landingReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
