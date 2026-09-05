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
  | "performance"
  | "ssr";
type XRayMode = "off" | "all" | XRayProof;
type XRaySummary = { packages: string[]; stacks: string[] };

const XRayContext = createContext<{
  mode: XRayMode;
  practiceOpen: boolean;
  practiceFrameWindow?: Window;
  practicePreviewUrl?: string;
  setMode: (mode: XRayMode) => void;
  setPracticeFrameWindow: (frame?: Window) => void;
  setPracticeOpen: (open: boolean) => void;
  setPracticePreviewUrl: (url?: string) => void;
} | null>(null);

export function XRayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const initialized = useRef(false);
  const [mode, setMode] = useState<XRayMode>("all");
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceFrameWindow, setPracticeFrameWindow] = useState<Window>();
  const [practicePreviewUrl, setPracticePreviewUrl] = useState<string>();
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

  useEffect(() => {
    document.body.dataset.xrayMode = mode;
    return () => {
      delete document.body.dataset.xrayMode;
    };
  }, [mode]);

  function selectMode(nextMode: XRayMode) {
    const url = new URL(window.location.href);
    if (nextMode !== mode || (nextMode !== "module-federation" && nextMode !== "monorepo")) {
      setPracticeOpen(false);
      setPracticeFrameWindow(undefined);
      setPracticePreviewUrl(undefined);
    }
    modeRef.current = nextMode;
    setMode(nextMode);
    url.searchParams.set("xray", nextMode);
    router.replace(`${getXRayPathname(nextMode, pathname)}?${url.searchParams.toString()}`, {
      scroll: false,
    });
  }

  return (
    <XRayContext value={{
      mode,
      practiceOpen,
      practiceFrameWindow,
      practicePreviewUrl,
      setMode: selectMode,
      setPracticeFrameWindow,
      setPracticeOpen,
      setPracticePreviewUrl,
    }}>
      {children}
    </XRayContext>
  );
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
        <option value="performance">Large Data Performance</option>
        <option value="ssr">SSR / Hydration</option>
      </select>
    </label>
  );
}

export function AllXRaySummary() {
  const pathname = usePathname();
  const { mode } = useXRayContext();
  const [summary, setSummary] = useState<XRaySummary>({ packages: [], stacks: [] });

  useEffect(() => {
    if (mode !== "all") return;

    let animationFrame = 0;

    function collectSummary() {
      const boxes = document.querySelectorAll<HTMLElement>(".cw-xray-box");
      const packages = new Set<string>();
      const stacks = new Set<string>();

      boxes.forEach((box) => {
        if (box.dataset.xrayPackage) packages.add(box.dataset.xrayPackage);
        box.dataset.xrayStacks
          ?.split(",")
          .filter(Boolean)
          .forEach((stack) => stacks.add(stack));
      });

      const nextSummary = {
        packages: [...packages].sort(),
        stacks: [...stacks].sort(),
      };

      setSummary((current) =>
        current.packages.join("\n") === nextSummary.packages.join("\n") &&
        current.stacks.join("\n") === nextSummary.stacks.join("\n")
          ? current
          : nextSummary,
      );
    }

    function scheduleCollection() {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(collectSummary);
    }

    collectSummary();
    const observer = new MutationObserver(scheduleCollection);
    observer.observe(document.body, {
      attributeFilter: ["data-xray-package", "data-xray-stacks"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [mode, pathname]);

  if (mode !== "all") return null;

  return (
    <section aria-labelledby="all-xray-title" className="all-xray-summary shell">
      <div className="panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">All X-Ray</p>
            <h2 id="all-xray-title">현재 화면 기술 요약</h2>
          </div>
          <span className="all-xray-summary__count">
            {summary.stacks.length} technologies
          </span>
        </div>
        <p className="all-xray-summary__description">
          전체 모드는 경계를 겹치지 않고 현재 렌더링된 화면의 기술만 요약합니다.
          실제 코드 경계와 값의 흐름은 위 X-Ray에서 기술 하나를 선택해 확인합니다.
        </p>
        <div className="all-xray-summary__groups" aria-live="polite">
          <SummaryGroup label="기술" values={summary.stacks} />
          <SummaryGroup label="실행 패키지" values={summary.packages} />
        </div>
      </div>
    </section>
  );
}

function SummaryGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <section aria-label={label}>
      <h3>{label}</h3>
      {values.length > 0 ? (
        <ul className="all-xray-summary__chips">
          {values.map((value) => <li key={value}>{value}</li>)}
        </ul>
      ) : (
        <p className="state-message" role="status">현재 화면의 증거를 확인하는 중입니다.</p>
      )}
    </section>
  );
}

export function useXRay(proofs: readonly XRayProof[] = ["fsd-style", "monorepo"]) {
  const {
    mode,
    practiceFrameWindow,
    practiceOpen,
    practicePreviewUrl,
    setPracticeFrameWindow,
    setPracticeOpen,
    setPracticePreviewUrl,
  } = useXRayContext();
  return {
    enabled: mode === "all" || (mode !== "off" && proofs.includes(mode)),
    mode,
    practiceFrameWindow,
    practiceOpen,
    practicePreviewUrl,
    setPracticeFrameWindow,
    setPracticeOpen,
    setPracticePreviewUrl,
  };
}

function useXRayContext() {
  const context = useContext(XRayContext);
  if (!context) throw new Error("X-Ray components must be used inside XRayProvider.");
  return context;
}

function getXRayMode(value: string | null): XRayMode {
  return value === "off" ||
    value === "all" ||
    value === "fsd-style" ||
    value === "module-federation" ||
    value === "monorepo" ||
    value === "openlayers" ||
    value === "r3f" ||
    value === "websocket" ||
    value === "rest-api" ||
    value === "redux" ||
    value === "zod" ||
    value === "performance" ||
    value === "ssr"
    ? value
    : "all";
}

function getXRayPathname(mode: XRayMode, currentPathname: string) {
  if (mode === "module-federation") return "/";
  if (mode === "openlayers") return "/map";
  if (mode === "r3f") return "/risk-3d";
  if (mode === "websocket") return "/realtime";
  if (mode === "rest-api" || mode === "redux") return "/incidents";
  if (mode === "zod") return "/incidents/new";
  if (mode === "performance") return "/performance";
  if (mode === "ssr") return "/incidents/INC-001";
  return currentPathname;
}
