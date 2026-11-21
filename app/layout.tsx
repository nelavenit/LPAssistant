import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simplex Assistant | LPAssistant",
  description: "Practice the simplex method and solve tableaux with exact arithmetic and Phase I.",
  manifest: "./manifest.webmanifest",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "./icon.svg",
    shortcut: "./icon.svg",
    apple: "./apple-touch-icon.png",
  },
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
