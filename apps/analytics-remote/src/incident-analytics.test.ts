import { describe, expect, it } from "vitest";
import {
  calculateIncidentAnalytics,
  type IncidentAnalyticsInput,
} from "./incident-analytics";

describe("calculateIncidentAnalytics", () => {
  it("summarizes incidents and handles an empty list", () => {
    const incidents: IncidentAnalyticsInput[] = [
      { affectedPeople: 42, severity: "critical", status: "resolved" },
      { affectedPeople: 18, severity: "high", status: "in_progress" },
      { affectedPeople: 7, severity: "low", status: "reported" },
    ];

    expect(calculateIncidentAnalytics(incidents)).toEqual({
      averageAffectedPeople: 22,
      highRisk: 2,
      resolutionRate: 33,
      total: 3,
    });
    expect(calculateIncidentAnalytics([])).toEqual({
      averageAffectedPeople: 0,
      highRisk: 0,
      resolutionRate: 0,
      total: 0,
    });
  });
});
