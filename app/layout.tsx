import type { Metadata, Viewport } from "next";
import "@fontsource/fira-sans/300.css";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/400-italic.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/500-italic.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-sans/600-italic.css";
import "@fontsource/fira-sans/700.css";
import "@fontsource/fira-sans/700-italic.css";
import "./globals.css";
import "../styles/portrait.css";
import "../styles/work.css";
import "../styles/explore.css";

export const metadata: Metadata = {
  title: "Jeffrey Hamilton — Software developer, Provo, Utah",
  description:
    "Software developer in Provo, Utah. Browser tools. Desktop apps. Games. Work and the person behind the projects.",
  icons: { icon: "/media/avatar.jpg" },
};
export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-mode="work">
      <body>{children}</body>
    </html>
  );
}
