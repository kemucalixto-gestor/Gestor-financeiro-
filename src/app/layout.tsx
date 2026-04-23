import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestor Financeiro",
  description: "Controle suas receitas, despesas e orçamentos no dia a dia.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Gestor",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
