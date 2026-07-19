"use client";

import type { Incident } from "@citywatch/api-types";
import Feature, { type FeatureLike } from "ol/Feature";
import OlMap from "ol/Map";
import { boundingExtent } from "ol/extent";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { unByKey } from "ol/Observable";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import Cluster from "ol/source/Cluster";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import View from "ol/View";
import { useEffect, useRef } from "react";

type ClusteredPerformanceMapProps = {
  incidents: Incident[];
  onSelectIncident: (incidentId: string) => void;
};

const seoulCenter = fromLonLat([126.978, 37.5665]);
const styleCache = new Map<number, Style>();

export function ClusteredPerformanceMap({
  incidents,
  onSelectIncident,
}: ClusteredPerformanceMapProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlMap | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const onSelectIncidentRef = useRef(onSelectIncident);

  useEffect(() => {
    onSelectIncidentRef.current = onSelectIncident;
  }, [onSelectIncident]);

  useEffect(() => {
    if (!targetRef.current || mapRef.current) return;

    const source = new VectorSource();
    const clusterSource = new Cluster({ distance: 38, source });
    const markerLayer = new VectorLayer({
      source: clusterSource,
      style: getClusterStyle,
    });
    const map = new OlMap({
      layers: [
        new TileLayer({ source: new OSM() }),
        markerLayer,
      ],
      target: targetRef.current,
      view: new View({ center: seoulCenter, zoom: 11 }),
    });
    const clickKey = map.on("singleclick", (event) => {
      const clusterFeature = map.forEachFeatureAtPixel(
        event.pixel,
        (feature) => feature,
      );
      const clusteredFeatures = clusterFeature?.get("features") as
        | Feature<Point>[]
        | undefined;

      if (!clusteredFeatures?.length) return;

      if (clusteredFeatures.length === 1) {
        const incidentId = clusteredFeatures[0].get("incidentId");
        if (typeof incidentId === "string") onSelectIncidentRef.current(incidentId);
        return;
      }

      const coordinates = clusteredFeatures.flatMap((feature) => {
        const geometry = feature.getGeometry();
        return geometry ? [geometry.getCoordinates()] : [];
      });

      if (coordinates.length > 0) {
        map.getView().fit(boundingExtent(coordinates), {
          duration: 180,
          maxZoom: 16,
          padding: [48, 48, 48, 48],
        });
      }
    });

    sourceRef.current = source;
    mapRef.current = map;

    return () => {
      unByKey(clickKey);
      map.setTarget(undefined);
      mapRef.current = null;
      sourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;

    source.clear(true);
    source.addFeatures(
      incidents.flatMap((incident) => {
        const { latitude, longitude } = incident.location;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

        return [
          new Feature({
            geometry: new Point(fromLonLat([longitude, latitude])),
            incidentId: incident.id,
          }),
        ];
      }),
    );
  }, [incidents]);

  return (
    <div
      aria-label="대량 사고 성능 시나리오 클러스터 지도"
      className="performance-map-canvas"
      ref={targetRef}
    />
  );
}

function getClusterStyle(feature: FeatureLike) {
  const size = (feature.get("features") as Feature<Point>[] | undefined)?.length ?? 0;
  const cached = styleCache.get(size);
  if (cached) return cached;

  const style = new Style({
    image: new CircleStyle({
      fill: new Fill({ color: size > 1 ? "#2563eb" : "#f97316" }),
      radius: Math.min(23, 8 + Math.ceil(Math.log2(Math.max(size, 1))) * 2),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
    text:
      size > 1
        ? new Text({
            fill: new Fill({ color: "#ffffff" }),
            font: "800 12px Arial",
            text: String(size),
          })
        : undefined,
  });

  styleCache.set(size, style);
  return style;
}
