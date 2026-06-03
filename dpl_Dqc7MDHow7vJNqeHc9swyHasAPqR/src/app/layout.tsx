import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Helmet Live",
  description: "LiveKit viewer for the Smart Helmet stream",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
