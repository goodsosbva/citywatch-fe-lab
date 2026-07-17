"use client";

import {
  calculateIncidentRisk,
  type Incident,
  type IncidentRisk,
} from "@citywatch/api-types";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  DoubleSide,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  getRegionName,
  incidentRiskLevelColors,
  incidentStatusLabels,
} from "../incidents/incident-format";

type RiskZoneSceneProps = {
  incident: Incident;
};

type RiskZone = {
  color: string;
  height: number;
  impactRadius: number;
  incident: Incident;
  position: [number, number, number];
  radius: number;
  risk: IncidentRisk;
};

type MapCenter = {
  latitude: number;
  longitude: number;
};

const mapZoom = 16;
const mapTileCount = 3;
const mapTileWorldSize = 4.5;
const maxMercatorLatitude = 85.05112878;
const detailCameraPosition: [number, number, number] = [0, 12, 8.5];

export function RiskZoneScene({ incident }: RiskZoneSceneProps) {
  const [resetViewKey, setResetViewKey] = useState(0);
  const scene = createRiskScene(incident);

  return (
    <div
      aria-label="사고 위치와 위험 점수를 높이와 색상으로 표현한 3D 위험 구역"
      className="risk-3d-scene"
      role="group"
    >
      <span className="sr-only">
        {scene.zone
          ? `${scene.zone.incident.id} 위험 점수 ${scene.zone.risk.score}, ${scene.zone.risk.level}`
          : "표시할 유효한 사고 좌표가 없습니다."}
      </span>
      <Canvas
        camera={{ fov: 38, position: detailCameraPosition }}
        dpr={[1, 1.5]}
        fallback={
          <p className="state-message state-message--error" role="alert">
            이 브라우저에서는 WebGL 3D 장면을 표시할 수 없습니다.
          </p>
        }
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color args={["#e8edf3"]} attach="background" />
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#ffffff", "#64748b", 1.8]} />
        <directionalLight intensity={2.2} position={[8, 12, 6]} />

        <Suspense fallback={<GroundPlaceholder />}>
          <MapGround center={scene.center} />
        </Suspense>
        <MapControls resetViewKey={resetViewKey} />

        {scene.zone ? <RiskTower zone={scene.zone} /> : null}
      </Canvas>
      {scene.zone ? (
        <div aria-live="polite" className="risk-3d-tooltip">
          <strong>{scene.zone.incident.id} · {scene.zone.incident.title}</strong>
          <span>
            {getRegionName(scene.zone.incident.regionId)} · 위험 {scene.zone.risk.score} · 영향 {scene.zone.incident.affectedPeople}명 · {incidentStatusLabels[scene.zone.incident.status]}
          </span>
          <span>
            좌표 {scene.zone.incident.location.latitude.toFixed(4)}, {scene.zone.incident.location.longitude.toFixed(4)}
          </span>
        </div>
      ) : null}
      <button
        className="risk-3d-reset-view"
        onClick={() => setResetViewKey((key) => key + 1)}
        type="button"
      >
        시점 초기화
      </button>
      <span aria-label="북쪽" className="risk-3d-north">북쪽 ↑</span>
      <span className="risk-3d-map-attribution">
        © <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">OpenStreetMap</a> contributors
      </span>
    </div>
  );
}

function MapControls({ resetViewKey }: { resetViewKey: number }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.enableRotate = false;
    controls.maxDistance = 20;
    controls.minDistance = 7;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    camera.position.set(...detailCameraPosition);
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [camera, resetViewKey]);

  return null;
}

function MapGround({ center }: { center: MapCenter }) {
  const tiles = useMemo(() => createMapTiles(center), [center]);
  const textures = useLoader(
    TextureLoader,
    tiles.map((tile) => tile.url),
  );

  for (const texture of textures) {
    texture.anisotropy = 4;
    texture.colorSpace = SRGBColorSpace;
  }

  return (
    <group>
      {tiles.map((tile, index) => (
        <mesh
          key={tile.url}
          position={tile.position}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[mapTileWorldSize, mapTileWorldSize]} />
          <meshBasicMaterial map={textures[index]} />
        </mesh>
      ))}
    </group>
  );
}

function GroundPlaceholder() {
  return (
    <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[18, 18]} />
      <meshStandardMaterial color="#dbe4ec" roughness={0.96} />
    </mesh>
  );
}

function RiskTower({ zone }: { zone: RiskZone }) {
  return (
    <group position={zone.position}>
      <mesh position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[zone.impactRadius * 0.78, zone.impactRadius, 48]} />
        <meshBasicMaterial
          color={zone.color}
          depthWrite={false}
          opacity={0.2}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[zone.radius * 1.08, zone.radius * 1.32, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          depthWrite={false}
          opacity={0.95}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, zone.height / 2, 0]}>
        <cylinderGeometry args={[zone.radius * 0.9, zone.radius, zone.height, 20]} />
        <meshStandardMaterial
          color={zone.color}
          emissive={zone.color}
          emissiveIntensity={0.12}
          metalness={0.08}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

function createRiskScene(incident: Incident) {
  const { latitude, longitude } = incident.location;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      center: { latitude: 37.5665, longitude: 126.978 },
      zone: undefined,
    };
  }

  const risk = calculateIncidentRisk(incident);

  return {
    center: incident.location,
    zone: {
      color: incidentRiskLevelColors[risk.level],
      height: 0.35 + risk.score / 45,
      impactRadius:
        0.48 + Math.sqrt(Math.max(incident.affectedPeople, 0)) * 0.07,
      incident,
      position: [0, 0, 0] as [number, number, number],
      radius:
        0.3 + Math.min(Math.max(incident.affectedPeople, 0), 100) / 650,
      risk,
    },
  };
}

function createMapTiles(center: MapCenter) {
  const centerPoint = toMapTilePoint(center);
  const startX = Math.round(centerPoint.x - mapTileCount / 2);
  const startY = Math.round(centerPoint.y - mapTileCount / 2);
  const worldTileCount = 2 ** mapZoom;

  return Array.from({ length: mapTileCount * mapTileCount }, (_, index) => {
    const tileX = startX + (index % mapTileCount);
    const tileY = startY + Math.floor(index / mapTileCount);
    const requestX = ((tileX % worldTileCount) + worldTileCount) % worldTileCount;
    const requestY = clamp(tileY, 0, worldTileCount - 1);

    return {
      position: [
        (tileX + 0.5 - centerPoint.x) * mapTileWorldSize,
        -0.08,
        (tileY + 0.5 - centerPoint.y) * mapTileWorldSize,
      ] as [number, number, number],
      url: `https://tile.openstreetmap.org/${mapZoom}/${requestX}/${requestY}.png`,
    };
  });
}

function toMapTilePoint({ latitude, longitude }: MapCenter) {
  const worldTileCount = 2 ** mapZoom;
  const latitudeRadians =
    (clamp(latitude, -maxMercatorLatitude, maxMercatorLatitude) * Math.PI) / 180;

  return {
    x: ((longitude + 180) / 360) * worldTileCount,
    y:
      ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) *
      worldTileCount,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
