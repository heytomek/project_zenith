import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: "Zenith",
  description:
    "Strategic coordination for humans and agents. Understand shared conditions, compare strategies, delegate bounded authority, and learn from outcomes.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
