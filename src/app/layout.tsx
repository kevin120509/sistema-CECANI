import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CECANI — Portal del Cliente",
  description: "Portal de registro y seguimiento de expedientes para clientes de CECANI, Centro de Consultoría y Asesoría de Negocios.",
};

import OneSignalInitializer from "@/components/OneSignalInitializer";
import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased" suppressHydrationWarning>
        <OneSignalInitializer />
        <Toaster position="top-right" richColors expand={true} />
        {children}
      </body>
    </html>
  );
}
