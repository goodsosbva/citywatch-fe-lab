import type { Metadata } from "next";
import "@citywatch/ui/styles.css";
import "ol/ol.css";
import "./globals.css";
import { AppNavigation } from "./app-navigation";
import { MonorepoWorkspaceMap } from "./monorepo-workspace-map";
import { StoreProvider } from "./store-provider";
import { AllXRaySummary, XRayProvider } from "./xray-selector";

export const metadata: Metadata = {
  title: "CityWatch FE Lab",
  description: "A frontend side project that exposes architecture and implementation evidence through X-Ray.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <StoreProvider>
          <XRayProvider>
            <AppNavigation />
            {children}
            <AllXRaySummary />
            <MonorepoWorkspaceMap />
          </XRayProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
