import type { Metadata, Viewport } from "next";
import { Assistant, Heebo } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MetisOps — ניהול תפעול רחפנים",
  description:
    "פלטפורמת תיאום מרחב אווירי, בקרת רישיונות, יומן טיסות ו-LMS למפעילי רחפנים בישראל.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3d91",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} ${heebo.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
