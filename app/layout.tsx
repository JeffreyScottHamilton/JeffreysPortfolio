import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Jeffrey Hamilton — Things you can use.",
  description:
    "Software developer in Provo, Utah. Browser tools. Desktop apps. Games. Work and the person behind the projects.",
  icons: { icon: "/media/portrait-original.jpg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
