import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "VISIONLIGHT", description: "Recupera ventas de tu tienda Shopify" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
