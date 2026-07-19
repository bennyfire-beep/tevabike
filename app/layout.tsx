import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import ContactWidget from "@/components/ContactWidget";

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
  description: "חוגי גרביטי, רכיבה טכנית וכושר בשטח — משגב, מצובה וביריה.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${geistMono.variable}`}>
      <body className="min-h-full antialiased">
        {children}
        <ContactWidget />
        <a href="/accessibility" aria-label="נגישות" style={{ position:"fixed", bottom:"24px", left:"24px", zIndex:9999, width:"48px", height:"48px", borderRadius:"50%", background:"#1565C0", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", textDecoration:"none", boxShadow:"0 4px 16px rgba(21,101,192,0.45)" }}>
          ♿
        </a>
      </body>
    </html>
  );
}
