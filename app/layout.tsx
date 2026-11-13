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

const BOOT = `try{var d=document.documentElement,s=sessionStorage;if(s.getItem("jh-mode")==="explore"){d.dataset.mode="explore";d.dataset.boot="explore"}if(s.getItem("jh-intro-seen")!=="1"&&!matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.boot=(d.dataset.boot||"")+" intro"}catch(e){}`;

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
    <html lang="en" data-mode="work" suppressHydrationWarning>
      <head>
        {/* Before first paint: avoid flashing Work when the visit is in Explore,
            and avoid flashing the finished hero right before the intro plays. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
