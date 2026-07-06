import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={["cw-badge", `cw-badge--${tone}`, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}
