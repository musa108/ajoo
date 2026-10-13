import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/instrument-sans/index.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Ajo: save together, get paid in turn", template: "%s | Ajo" },
  description:
    "Ajo puts the savings circle you already know on-chain. Members pay in each round, one member takes the pot, and every on-time payment builds a record that travels with you.",
  openGraph: {
    title: "Ajo: save together, get paid in turn",
    description: "The savings circle you already know, with the pot held by code instead of a person.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F2F4FF",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
