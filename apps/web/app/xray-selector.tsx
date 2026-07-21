"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type XRayProof = "fsd-style" | "module-federation";
type XRayMode = "off" | "all" | XRayProof;

const XRayContext = createContext<{ mode: XRayMode; setMode: (mode: XRayMode) => void } | null>(null);

export function XRayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const initialized = useRef(false);
  const [mode, setMode] = useState<XRayMode>("all");

  useEffect(() => {
    const url = new URL(window.location.href);

    if (!initialized.current) {
      initialized.current = true;
      const initialMode = getXRayMode(url.searchParams.get("xray"));
      setMode(initialMode);
      url.searchParams.set("xray", initialMode);
    } else {
      url.searchParams.set("xray", mode);
    }

    router.replace(`${pathname}?${url.searchParams.toString()}`, { scroll: false });
  }, [mode, pathname, router]);

  return <XRayContext value={{ mode, setMode }}>{children}</XRayContext>;
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
        <option value="off">끄기</option>
        <option value="all">전체</option>
        <option value="fsd-style">FSD-style</option>
        <option value="module-federation">Module Federation</option>
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
  return value === "off" || value === "fsd-style" || value === "module-federation"
    ? value
    : "all";
}
