import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Laporan Komplain",
  description: "Pencatatan kendala lapangan dan rekap komplain mingguan.",
  applicationName: "Komplain",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Komplain", statusBarStyle: "default" },
  icons: {
    icon: "/icons/komplain-192.png",
    apple: [{ url: "/icons/komplain-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: "#020617" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
