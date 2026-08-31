import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRMKaro Admin — Platform Operations",
  description: "Secure CRMKaro platform operations console.",
  icons: {
    icon: [
      { url: "/brand/crmkaro-mark.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: "/brand/crmkaro-mark.png",
    apple: [
      { url: "/brand/crmkaro-mark.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/brand/crmkaro-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/brand/crmkaro-mark.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
