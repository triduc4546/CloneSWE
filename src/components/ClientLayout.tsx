"use client";

import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import ScrollToTop from "@/components/scroll-to-top";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 bg-white">{children}</main>
      </div>
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
