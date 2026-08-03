import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Build Challenge",
  description: "ChatGPTとCodexで30日間に15作品の公開を目指す個人開発チャレンジ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
