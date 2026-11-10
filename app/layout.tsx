import type { Metadata } from "next";
import { PRODUCT_DESCRIPTION_ZH, PRODUCT_NAME } from "@/src/lib/branding";
import "./globals.css";
import { LanguageProvider } from "@/src/components/LanguageProvider";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION_ZH,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full"><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
