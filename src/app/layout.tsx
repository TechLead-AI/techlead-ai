import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Tech Lead AI",
  description: "Mentor junior developers by reviewing their pull requests.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
