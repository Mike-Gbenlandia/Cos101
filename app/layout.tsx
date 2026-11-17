import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/TopNav";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "COS101 Exam Practice — Introduction to Computing Science",
  description:
    "Client-side CBT practice platform for COS101: Introduction to Computing Science with proportional module sampling, instant diagnostics, and local progress history.",
  openGraph: {
    title: "COS101 Exam Practice — Introduction to Computing Science",
    description:
      "Client-side CBT practice platform for COS101: Introduction to Computing Science with proportional module sampling, instant diagnostics, and local progress history.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetBrainsMono.variable}`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <TopNav />
        <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
