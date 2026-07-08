"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type XRayLayer = "app" | "widget" | "feature" | "entity" | "shared" | "remote" | "package";

const xrayLayers: XRayLayer[] = ["app", "widget", "feature", "entity", "shared", "remote", "package"];

export type XRayBoxProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  enabled?: boolean;
  label: string;
  layer?: XRayLayer;
  packageName?: string;
  stacks?: string[];
};

export function XRayBox({
  children,
  className,
  enabled = false,
  label,
  layer,
  packageName,
  stacks = [],
  style,
  title,
  ...props
}: XRayBoxProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const resolvedLayer = layer ?? getXRayLayer(label);

  return (
    <div
      className={["cw-xray-box", className].filter(Boolean).join(" ")}
      data-xray-layer={resolvedLayer}
      data-xray-label={label}
      data-xray-package={packageName}
      data-xray-stacks={stacks.join(",")}
      style={style}
      title={title ?? getXRayTitle(label, packageName, stacks)}
      {...props}
    >
      <span className="cw-xray-label">{getXRayDisplayLabel(label)}</span>
      {children}
    </div>
  );
}

export type XRayToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  style?: CSSProperties;
};

export function XRayToggle({ enabled, label = "X-Ray", onChange, style }: XRayToggleProps) {
  return (
    <button
      aria-label={`${label} mode`}
      aria-pressed={enabled}
      className="cw-xray-toggle"
      onClick={() => onChange(!enabled)}
      style={style}
      type="button"
    >
      {label}: {enabled ? "On" : "Off"}
    </button>
  );
}

function getXRayLayer(label: string): XRayLayer {
  const maybeLayer = label.split("/")[0] as XRayLayer;
  return xrayLayers.includes(maybeLayer) ? maybeLayer : "shared";
}

function getXRayDisplayLabel(label: string) {
  const parts = label.split("/");
  const layer = parts[0];
  const leaf = parts[parts.length - 1];
  return layer && leaf && layer !== leaf ? `${layer}/${leaf}` : label;
}

function getXRayTitle(label: string, packageName?: string, stacks: string[] = []) {
  return [label, packageName, stacks.length ? stacks.join(" · ") : undefined].filter(Boolean).join("\n");
}