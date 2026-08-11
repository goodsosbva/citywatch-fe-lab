"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type XRayProof =
  | "fsd-style"
  | "module-federation"
  | "monorepo"
  | "openlayers"
  | "r3f"
  | "websocket"
  | "rest-api"
  | "redux"
  | "zod"
  | "accessibility";
type XRayMode = "off" | "all" | XRayProof;

const XRayContext = createContext<{ mode: XRayMode; setMode: (mode: XRayMode) => void } | null>(null);

export function XRayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const initialized = useRef(false);
  const [mode, setMode] = useState<XRayMode>("all");
  const modeRef = useRef<XRayMode>("all");

  useEffect(() => {
    const url = new URL(window.location.href);

    if (!initialized.current) {
      initialized.current = true;
      modeRef.current = getXRayMode(url.searchParams.get("xray"));
      setMode(modeRef.current);
    }

    if (url.searchParams.get("xray") === modeRef.current) return;

    url.searchParams.set("xray", modeRef.current);
    router.replace(`${pathname}?${url.searchParams.toString()}`, {
      scroll: false,
    });
  }, [pathname, router]);

  function selectMode(nextMode: XRayMode) {
    const url = new URL(window.location.href);
    modeRef.current = nextMode;
    setMode(nextMode);
    url.searchParams.set("xray", nextMode);
    router.replace(`${getXRayPathname(nextMode, pathname)}?${url.searchParams.toString()}`, {
      scroll: false,
    });
  }

  return <XRayContext value={{ mode, setMode: selectMode }}>{children}</XRayContext>;
}

export function XRaySelector() {
  const { mode, setMode } = useXRayContext();

  return (
    <label className="xray-selector">
      <span>X-Ray</span>
      <select
        aria-label="X-Ray 관점"
        onChange={(event) => setMode(event.target.value as XRayMode)}
        value={mode}
      >
        <option value="off">X-Ray만 끄기</option>
        <option value="all">전체</option>
        <option value="fsd-style">FSD-style</option>
        <option value="module-federation">Module Federation</option>
        <option value="monorepo">Monorepo</option>
        <option value="openlayers">OpenLayers</option>
        <option value="r3f">R3F / Three.js</option>
        <option value="websocket">WebSocket / Polling</option>
        <option value="rest-api">REST API</option>
        <option value="redux">Redux</option>
        <option value="zod">Zod Validation</option>
        <option value="accessibility">Accessibility</option>
      </select>
    </label>
  );
}

export function useXRay(proofs: readonly XRayProof[] = ["fsd-style"]) {
  const { mode } = useXRayContext();
  return {
    enabled: mode === "all" || (mode !== "off" && proofs.includes(mode)),
    mode,
  };
}

function useXRayContext() {
  const context = useContext(XRayContext);
  if (!context) throw new Error("X-Ray components must be used inside XRayProvider.");
  return context;
}

function getXRayMode(value: string | null): XRayMode {
  return value === "off" ||
    value === "fsd-style" ||
    value === "module-federation" ||
    value === "monorepo" ||
    value === "openlayers" ||
    value === "r3f" ||
    value === "websocket" ||
    value === "rest-api" ||
    value === "redux" ||
    value === "zod" ||
    value === "accessibility"
    ? value
    : "all";
}

function getXRayPathname(mode: XRayMode, currentPathname: string) {
  if (mode === "module-federation" || mode === "monorepo") return "/";
  if (mode === "openlayers") return "/map";
  if (mode === "r3f") return "/risk-3d";
  if (mode === "websocket") return "/realtime";
  if (mode === "rest-api" || mode === "redux") return "/incidents";
  if (mode === "zod" || mode === "accessibility") return "/incidents/new";
  return currentPathname;
}
