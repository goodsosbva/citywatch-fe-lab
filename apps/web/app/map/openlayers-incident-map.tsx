"use client";

import {
  calculateIncidentRisk,
  type Incident,
  type IncidentRiskLevel,
} from "@citywatch/api-types";
import Feature, { type FeatureLike } from "ol/Feature";
import Map from "ol/Map";
import { unByKey } from "ol/Observable";
import View from "ol/View";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { useEffect, useRef } from "react";
import { incidentRiskLevelColors } from "../incidents/incident-format";

type OpenLayersIncidentMapProps = {
  incidents: Incident[];
  onSelectIncident: (incidentId: string) => void;
  selectedIncidentId?: string;
};

const seoulCenter = fromLonLat([126.978, 37.5665]);

export function OpenLayersIncidentMap({
  incidents,
  onSelectIncident,
  selectedIncidentId,
}: OpenLayersIncidentMapProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const onSelectIncidentRef = useRef(onSelectIncident);
  const selectedIncidentIdRef = useRef(selectedIncidentId);

  useEffect(() => {
    onSelectIncidentRef.current = onSelectIncident;
  }, [onSelectIncident]);

  useEffect(() => {
    selectedIncidentIdRef.current = selectedIncidentId;
    sourceRef.current?.changed();
  }, [selectedIncidentId]);

  useEffect(() => {
    if (!targetRef.current || mapRef.current) return;

    const source = new VectorSource();
    const markerLayer = new VectorLayer({
      source,
      style: (feature) =>
        getMarkerStyle(feature, selectedIncidentIdRef.current),
    });

    const map = new Map({
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        markerLayer,
      ],
      target: targetRef.current,
      view: new View({
        center: seoulCenter,
        zoom: 11,
      }),
    });

    const clickKey = map.on("singleclick", (event) => {
      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (nextFeature) => nextFeature,
      );
      const incidentId = feature?.get("incidentId");

      if (typeof incidentId === "string") {
        onSelectIncidentRef.current(incidentId);
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
    const map = mapRef.current;
    const source = sourceRef.current;

    if (!map || !source) return;

    source.clear();

    const features = incidents.flatMap((incident) => {
      const { latitude, longitude } = incident.location;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return [];
      }

      const risk = calculateIncidentRisk(incident);

      return [
        new Feature({
          geometry: new Point(fromLonLat([longitude, latitude])),
          incidentId: incident.id,
          riskLevel: risk.level,
          riskScore: risk.score,
        }),
      ];
    });

    source.addFeatures(features);

    const extent = source.getExtent();

    if (features.length > 0 && extent) {
      map.getView().fit(extent, {
        duration: 250,
        maxZoom: 14,
        padding: [56, 56, 56, 56],
      });
    } else {
      map.getView().setCenter(seoulCenter);
      map.getView().setZoom(11);
    }
  }, [incidents]);

  return (
    <div
      aria-label="서울 사고 위치 지도"
      className="map-canvas"
      ref={targetRef}
    />
  );
}

function getMarkerStyle(feature: FeatureLike, selectedIncidentId?: string) {
  const riskLevel = feature.get("riskLevel") as IncidentRiskLevel | undefined;
  const riskScore = Number(feature.get("riskScore") ?? 0);
  const selected = feature.get("incidentId") === selectedIncidentId;
  const radius = selected ? 13 : Math.min(11, 7 + Math.floor(riskScore / 25));

  return new Style({
    image: new CircleStyle({
      fill: new Fill({
        color: riskLevel ? incidentRiskLevelColors[riskLevel] : "#2563eb",
      }),
      radius,
      stroke: new Stroke({
        color: selected ? "#172033" : "#ffffff",
        width: selected ? 4 : 2,
      }),
    }),
  });
}
