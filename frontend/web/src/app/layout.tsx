import type { Metadata } from "next";
import { SessionProvider } from "@/components/auth/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bike Buddy Portal",
    template: "%s · Bike Buddy",
  },
  description:
    "Accessible administration and fleet management for Bike Buddy.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
