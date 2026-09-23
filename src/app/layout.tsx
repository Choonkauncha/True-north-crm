import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "True North Field OS — Residential Roofing CRM",
  description:
    "True North Field OS — a residential roofing CRM with the operating loop: Lead → Inspection → Measurement → IKO Estimate → Signed Contract → Job Cash Flow. AI-powered roof damage inspection and Copilot assistant.",
  keywords: [
    "True North",
    "Roofing CRM",
    "IKO shingles",
    "Residential Roofing",
    "Ohio Roofing",
    "Field OS",
  ],
  authors: [{ name: "True North Restorations" }],
  icons: {
    icon: "/true-north-logo.png",
    apple: "/true-north-logo.png",
  },
  openGraph: {
    title: "True North Field OS",
    description: "Residential Roofing CRM with AI inspection + Copilot",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
