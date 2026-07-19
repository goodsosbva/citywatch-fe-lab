import type { Incident } from "@citywatch/api-types";

export const performanceScenarioSizes = [5000, 10000] as const;
export type PerformanceScenarioSize = (typeof performanceScenarioSizes)[number];

const maximumLatitudeOffset = 0.018;

export function isPerformanceScenarioSize(
  value: number,
): value is PerformanceScenarioSize {
  return performanceScenarioSizes.includes(value as PerformanceScenarioSize);
}

export function createPerformanceIncidents(
  source: Incident[],
  count: PerformanceScenarioSize,
) {
  if (source.length === 0) return [];

  const weights = source.map((incident) => Math.max(incident.affectedPeople, 1));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);

  return Array.from({ length: count }, (_, index) => {
    const template = source[getWeightedIndex(weights, totalWeight, randomUnit(index, 11))];
    const distance = Math.pow(randomUnit(index, 23), 2.35) * maximumLatitudeOffset;
    const angle = randomUnit(index, 37) * Math.PI * 2;
    const latitudeOffset = Math.sin(angle) * distance;
    const longitudeOffset =
      (Math.cos(angle) * distance) /
      Math.cos((template.location.latitude * Math.PI) / 180);

    return {
      ...template,
      id: `PERF-${String(index + 1).padStart(5, "0")}`,
      location: {
        latitude: template.location.latitude + latitudeOffset,
        longitude: template.location.longitude + longitudeOffset,
      },
      title: `${template.title} · 성능 시나리오 ${index + 1}`,
    };
  });
}

function getWeightedIndex(weights: number[], totalWeight: number, value: number) {
  let remainingWeight = value * totalWeight;

  for (let index = 0; index < weights.length; index += 1) {
    remainingWeight -= weights[index];
    if (remainingWeight < 0) return index;
  }

  return weights.length - 1;
}

function randomUnit(index: number, salt: number) {
  let value = (index + salt * 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
}
