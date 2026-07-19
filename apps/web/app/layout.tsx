import type { Metadata } from "next";
import "@citywatch/ui/styles.css";
import "ol/ol.css";
import "./globals.css";
import { StoreProvider } from "./store-provider";

export const metadata: Metadata = {
  title: "CityWatch FE Lab",
  description: "A frontend side project that exposes architecture and implementation evidence through X-Ray.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
