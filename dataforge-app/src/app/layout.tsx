import type { Metadata } from "next";
import "./globals.css";
import "./style.scss";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "DataForge",
  description: "Lead extraction and management platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
