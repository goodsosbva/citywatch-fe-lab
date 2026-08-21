"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useXRay, XRaySelector } from "./xray-selector";

const navigationItems = [
  ["/", "관제 홈"],
  ["/incidents", "사고 목록"],
  ["/incidents/new", "사고 등록"],
  ["/map", "지도 관제"],
  ["/risk-3d", "3D 위험 구역"],
  ["/realtime", "실시간 피드"],
  ["/performance", "대량 관제"],
  ["/status", "구현 상태"],
] as const;

export function AppNavigation() {
  const pathname = usePathname();
  const { mode } = useXRay();

  return (
    <header className="app-header">
      <div className="app-navigation">
        <nav aria-label="주요 메뉴" className="app-navigation__links">
          {navigationItems.map(([href, label]) => {
            const active = pathname === href;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`nav-link${active ? " nav-link--active" : ""}`}
                href={`${href}?xray=${mode}`}
                key={href}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <XRaySelector />
      </div>
    </header>
  );
}
