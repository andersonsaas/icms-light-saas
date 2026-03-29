import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICMS Light | Restituição Tributária",
  description:
    "Plataforma para advogados gerenciarem pedidos de restituição de ICMS em contas de energia da Light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
