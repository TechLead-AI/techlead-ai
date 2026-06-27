import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Tech Lead AI",
  description: "Mentor junior developers by reviewing their pull requests.",
};

// Scale to the device width so phones render the app at a sensible size.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
