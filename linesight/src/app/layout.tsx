import type { Metadata } from "next";
import { AppShell } from "@/components/ui/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "LineSight – Apple Watch Ultra 2 FATP Quality",
  description: "Factory quality dashboard for Apple Watch Ultra 2 FATP (synthetic data).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`bg-slate-950 text-slate-100 antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
