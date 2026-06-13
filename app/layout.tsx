import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import AccessibilityWidget from "@/components/AccessibilityWidget";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "טבע בייק — חוגי רכיבת שטח לילדים ומבוגרים",
  description: "חוגי גרביטי, רכיבה טכנית וכושר בשטח — משגב, מצובה וביריה. הרשמה לחוגי אופניים לכל הגילאים.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${geistMono.variable}`}>
      <body className="min-h-full antialiased">
        {children}
        <AccessibilityWidget />
      </body>
    </html>
  );
}
