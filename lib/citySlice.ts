import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

export type CitySuggestion = { name: string; country: string; country_code?: string; latitude: number; longitude: number };
type CityState = { query: string; suggestions: CitySuggestion[]; selectedCity: string; activeIndex: number; loading: boolean; error: string };
const initialState: CityState = { query: "", suggestions: [], selectedCity: "", activeIndex: -1, loading: false, error: "" };
const QUICK_CITIES = ["Agra", "Ahmedabad", "Amritsar", "Bengaluru", "Bhopal", "Bhubaneswar", "Chandigarh", "Chennai", "Dehradun", "Delhi", "Gandhinagar", "Goa", "Gurugram", "Guwahati", "Hyderabad", "Indore", "Jaipur", "Jalandhar", "Jammu", "Kanpur", "Kochi", "Kolkata", "Lucknow", "Ludhiana", "Mumbai", "Mysuru", "Nagpur", "Nashik", "Noida", "Patna", "Pune", "Raipur", "Ranchi", "Srinagar", "Surat", "Thane", "Thiruvananthapuram", "Udaipur", "Vadodara", "Varanasi", "Vijayawada", "Visakhapatnam"];

export const searchCities = createAsyncThunk<CitySuggestion[], string>("cities/search", async (query) => {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json&countryCode=IN`);
  if (!response.ok) throw new Error("City search failed");
  const data = await response.json() as { results?: CitySuggestion[] };
  return (data.results ?? []).filter((city) => city.country_code === "IN");
});

const citySlice = createSlice({
  name: "cities", initialState,
  reducers: {
    setCityQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload; state.selectedCity = "";
      const query = action.payload.trim().toLowerCase();
      state.suggestions = query.length < 1 ? [] : QUICK_CITIES.filter((city) => city.toLowerCase().startsWith(query)).slice(0, 6).map((name, index) => ({ name, country: "India", country_code: "IN", latitude: index, longitude: index }));
    },
    selectCity: (state, action: PayloadAction<string>) => { state.selectedCity = action.payload; state.query = action.payload; state.suggestions = []; state.activeIndex = -1; },
    setCityActiveIndex: (state, action: PayloadAction<number>) => { state.activeIndex = action.payload; },
    clearCitySuggestions: (state) => { state.suggestions = []; },
  },
  extraReducers: (builder) => builder.addCase(searchCities.pending, (state) => { state.loading = true; state.error = ""; }).addCase(searchCities.fulfilled, (state, action) => { state.loading = false; state.suggestions = action.payload; }).addCase(searchCities.rejected, (state) => { state.loading = false; state.suggestions = []; state.error = "City suggestions unavailable"; }),
});
export const { setCityQuery, selectCity, setCityActiveIndex, clearCitySuggestions } = citySlice.actions;
export default citySlice.reducer;
