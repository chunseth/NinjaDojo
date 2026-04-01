import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./curriculum.css";

export const metadata: Metadata = {
  title: "NinjaDojo Dashboard",
  description: "Live progress board for kids in the center"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
