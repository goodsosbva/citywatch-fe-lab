import type { Metadata } from "next";
import "@citywatch/ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityWatch FE Lab",
  description: "A city safety monitoring frontend lab with X-Ray stack overlays.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
