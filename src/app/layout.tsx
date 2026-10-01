import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = localFont({
  src: "./fonts/dm-sans.ttf",
  variable: "--font-dm-sans",
  display: "swap",
  weight: "100 1000",
});

export const metadata: Metadata = {
  title: "StayLedger | Homestay Manager",
  description: "Customer, booking, and accounts management for multiple homestays.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
