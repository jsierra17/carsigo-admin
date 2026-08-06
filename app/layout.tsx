import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CarSiGo",
  description: "Panel Administrativo para CarSiGo",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32" },
      { url: "/icon.png", sizes: "192x192" },
    ],
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" style={{ colorScheme: 'dark' }}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0b] min-h-screen flex flex-col`}>
        {children}
      </body>
    </html>
  );
}