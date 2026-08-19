import { describe, expect, it } from "vitest";
import { isIncidentListResponse } from "../src/index";

const incident = {
  affectedPeople: 3,
  category: "traffic",
  description: "교통 사고 현장 확인 중입니다.",
  id: "INC-TEST",
  location: { latitude: 37.5, longitude: 127 },
  regionId: "seocho",
  reportedAt: "2026-08-19T00:00:00.000Z",
  severity: "high",
  status: "reported",
  title: "응답 계약 검사",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

describe("isIncidentListResponse", () => {
  it("accepts valid incidents and rejects malformed network data", () => {
    expect(isIncidentListResponse({ incidents: [incident] })).toBe(true);
    expect(isIncidentListResponse({ incidents: [{ ...incident, severity: "unknown" }] })).toBe(false);
  });
});
