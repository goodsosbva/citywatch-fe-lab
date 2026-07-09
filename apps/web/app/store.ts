import { configureStore } from "@reduxjs/toolkit";
import incidentControlReducer from "./incidents/incident-control-slice";

export function makeStore() {
  return configureStore({
    reducer: {
      incidentControl: incidentControlReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
