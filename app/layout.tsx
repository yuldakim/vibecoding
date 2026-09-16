import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이불공장 납품·정산",
  description: "이불공장 납품 송장과 정산서 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
