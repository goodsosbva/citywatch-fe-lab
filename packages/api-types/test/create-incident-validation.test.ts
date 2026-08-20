import { describe, expect, it } from "vitest";
import { validateCreateIncidentInput } from "../src/index";

describe("validateCreateIncidentInput", () => {
  it("maps invalid fields and only returns normalized input after success", () => {
    expect(
      validateCreateIncidentInput({
        title: "x",
        description: "short",
        category: "traffic",
        severity: "medium",
        regionId: "junggu",
        location: { latitude: "", longitude: "126.9769" },
        affectedPeople: "1.5",
        assignedTeam: "",
      }),
    ).toMatchObject({
      errors: {
        affectedPeople: expect.any(String),
        description: expect.any(String),
        latitude: expect.any(String),
        title: expect.any(String),
      },
      success: false,
    });

    expect(
      validateCreateIncidentInput({
        title: "  도로 침수 신고  ",
        description: "  강우로 도로 일부가 침수되었습니다.  ",
        category: "flood",
        severity: "high",
        regionId: "junggu",
        location: { latitude: "37.5657", longitude: "126.9769" },
        affectedPeople: "12",
        assignedTeam: "",
      }),
    ).toEqual({
      input: {
        affectedPeople: 12,
        category: "flood",
        description: "강우로 도로 일부가 침수되었습니다.",
        location: { latitude: 37.5657, longitude: 126.9769 },
        regionId: "junggu",
        severity: "high",
        title: "도로 침수 신고",
      },
      success: true,
    });
  });
});
