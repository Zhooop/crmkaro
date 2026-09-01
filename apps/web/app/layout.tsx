import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRMKaro — Business Operating System, Student Fees, Invoicing & Payroll",
  description:
    "CRMKaro is the modern all-in-one business operating system. Keep fees collection, send receipts to customers, collect leads, track staff salaries, manage GST billing and inventory stock—all unified without clutter.",
  keywords: [
    "CRMKaro",
    "CRM Karo",
    "student fees management",
    "fee collection software",
    "send receipts to customers",
    "collect leads CRM",
    "GST invoice generator",
    "staff salary payroll software",
    "lead management software India",
    "inventory stock management",
    "coaching institute management",
    "academy management software",
  ],
  authors: [{ name: "CRMKaro Team", url: "https://crmkaro.com" }],
  creator: "CRMKaro",
  publisher: "CRMKaro",
  metadataBase: new URL("https://crmkaro.com"),
  alternates: {
    canonical: "https://crmkaro.com",
  },
  openGraph: {
    title: "CRMKaro — Run your entire business with clarity",
    description:
      "Keep fees collection, send receipts to customers, collect leads, issue GST invoices, and manage staff salaries with CRMKaro.",
    url: "https://crmkaro.com",
    siteName: "CRMKaro",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/brand/crmkaro-mark.png",
        width: 512,
        height: 512,
        alt: "CRMKaro Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CRMKaro — Business Operating System",
    description:
      "Keep fees collection, send receipts to customers, collect leads, and manage staff salaries seamlessly.",
    images: ["/brand/crmkaro-mark.png"],
  },
  icons: {
    icon: [
      { url: "/brand/crmkaro-mark.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: "/brand/crmkaro-mark.png",
    apple: [
      { url: "/brand/crmkaro-mark.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "CRMKaro",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, iOS, Android",
      "description":
        "CRMKaro is an all-in-one business operating system designed for institutes, academies, agencies, and small-to-medium businesses. Features include student fees collection, customer receipts, CRM lead management, GST invoicing, automated staff payroll, and inventory stock tracking.",
      "url": "https://crmkaro.com",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "INR",
      },
      "featureList": [
        "Student Fees Collection & Month-wise Billing",
        "WhatsApp & PDF Customer Receipts",
        "Lead CRM Pipelines & Follow-up Tracking",
        "Staff Salaries & Automated Payroll",
        "GST-ready Invoicing & Kharcha (Expense) Tracking",
        "Inventory Stock Movements & Low Stock Alerts",
      ],
    },
    {
      "@type": "Organization",
      "name": "CRMKaro",
      "url": "https://crmkaro.com",
      "logo": "https://crmkaro.com/brand/crmkaro-mark.png",
      "sameAs": ["https://crmkaro.com"],
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/brand/crmkaro-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/brand/crmkaro-mark.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

