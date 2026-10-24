import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { NetworkProvider } from "@/components/providers/network-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Aakash Management Console",
  description: "AWS-compatible local cloud emulator console for development and testing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex antialiased selection:bg-amber-100 selection:text-amber-900">
        <QueryProvider>
          <NetworkProvider>
            <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-50">
              <Header />
              <div className="flex flex-1 min-h-0 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto bg-slate-50/70 p-6 lg:p-8">
                  <div className="max-w-7xl mx-auto space-y-6">{children}</div>
                </main>
              </div>
            </div>
          </NetworkProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
