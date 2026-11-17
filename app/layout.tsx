import type { Metadata, Viewport } from "next";
import "./globals.css";

// Configure PWA metadata in 100% English
export const metadata: Metadata = {
  title: "Less for More | Less in SG for More in Seoul",
  description:
    "Spend less in Singapore for more food and experiences in Seoul. Compare SG impulse buys with real Seoul local treats.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Less for More",
  },
};

// Lock mobile viewport scale for a native app-like feel
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased selection:bg-indigo-100">
        {children}
      </body>
    </html>
  );
}
