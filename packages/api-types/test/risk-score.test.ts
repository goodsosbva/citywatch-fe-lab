import { describe, expect, it } from "vitest";
import { calculateIncidentRisk, type IncidentRiskInput } from "../src/index";

const baseIncident = {
  affectedPeople: 0,
  category: "traffic",
  severity: "low",
  status: "reported",
} satisfies IncidentRiskInput;

describe("calculateIncidentRisk", () => {
  it("marks critical active incidents as severe", () => {
    const risk = calculateIncidentRisk({
      ...baseIncident,
      affectedPeople: 42,
      category: "flood",
      severity: "critical",
      status: "in_progress",
    });

    expect(risk).toMatchObject({
      level: "severe",
      score: 100,
    });
    expect(risk.reasons).toContain("critical severity");
  });

  it("lowers resolved false alarms to low risk", () => {
    const risk = calculateIncidentRisk({
      ...baseIncident,
      affectedPeople: 80,
      severity: "high",
      status: "false_alarm",
    });

    expect(risk).toMatchObject({
      level: "low",
      score: 28,
    });
  });

  it("caps high affected people incidents at 100", () => {
    const risk = calculateIncidentRisk({
      ...baseIncident,
      affectedPeople: 120000,
      category: "fire",
      severity: "critical",
      status: "dispatching",
    });

    expect(risk).toMatchObject({
      level: "severe",
      score: 100,
    });
  });
});