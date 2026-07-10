import type {
  IncidentListQuery,
  IncidentSeverity,
  IncidentStatus,
} from "@citywatch/api-types";
import {
  createSelector,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

type AllFilter = "all";

export type IncidentFilters = {
  search: string;
  severity: IncidentSeverity | AllFilter;
  status: IncidentStatus | AllFilter;
  regionId: string;
};

export type IncidentControlState = {
  filters: IncidentFilters;
  selectedIncidentId?: string;
};

const initialFilters: IncidentFilters = {
  search: "",
  severity: "all",
  status: "all",
  regionId: "all",
};

const initialState: IncidentControlState = {
  filters: initialFilters,
};

const incidentControlSlice = createSlice({
  name: "incidentControl",
  initialState,
  reducers: {
    setSearchFilter(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
    },
    setSeverityFilter(
      state,
      action: PayloadAction<IncidentFilters["severity"]>,
    ) {
      state.filters.severity = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<IncidentFilters["status"]>) {
      state.filters.status = action.payload;
    },
    setRegionFilter(state, action: PayloadAction<string>) {
      state.filters.regionId = action.payload;
    },
    resetIncidentFilters(state) {
      state.filters = { ...initialFilters };
    },
    setSelectedIncidentId(state, action: PayloadAction<string>) {
      state.selectedIncidentId = action.payload;
    },
  },
});

type IncidentControlRootState = {
  incidentControl: IncidentControlState;
};

export const {
  resetIncidentFilters,
  setRegionFilter,
  setSearchFilter,
  setSelectedIncidentId,
  setSeverityFilter,
  setStatusFilter,
} = incidentControlSlice.actions;

export const selectIncidentFilters = (state: IncidentControlRootState) =>
  state.incidentControl.filters;

export const selectSelectedIncidentId = (state: IncidentControlRootState) =>
  state.incidentControl.selectedIncidentId;

export const selectIncidentListQuery = createSelector(
  selectIncidentFilters,
  (filters): IncidentListQuery => {
    const query: IncidentListQuery = {};
    const search = filters.search.trim();

    if (search) query.search = search;
    if (filters.severity !== "all") query.severity = filters.severity;
    if (filters.status !== "all") query.status = filters.status;
    if (filters.regionId !== "all") query.regionId = filters.regionId;

    return query;
  },
);

export const selectActiveIncidentFilterCount = createSelector(
  selectIncidentFilters,
  (filters) =>
    Number(Boolean(filters.search.trim())) +
    Number(filters.severity !== "all") +
    Number(filters.status !== "all") +
    Number(filters.regionId !== "all"),
);

export default incidentControlSlice.reducer;
