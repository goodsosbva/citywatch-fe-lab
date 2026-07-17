import { describe, expect, it } from "vitest";
import { calculateIncidentRisk, isRealtimeEventListResponse, type IncidentRiskInput } from "../src/index";

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

describe("isRealtimeEventListResponse", () => {
  it("accepts valid polling event responses", () => {
    expect(
      isRealtimeEventListResponse({
        events: [
          {
            id: 1,
            message: {
              sentAt: "2026-07-11T00:00:00.000Z",
              type: "heartbeat",
            },
          },
        ],
        serverTime: "2026-07-11T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("rejects malformed realtime messages", () => {
    expect(
      isRealtimeEventListResponse({
        events: [
          {
            id: 1,
            message: {
              incidentId: "INC-001",
              sentAt: "2026-07-11T00:00:00.000Z",
              status: "unknown",
              type: "incident.statusChanged",
            },
          },
        ],
        serverTime: "2026-07-11T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});
