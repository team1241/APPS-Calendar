import type { Metadata } from "next";
import "./globals.css";
import "./calendar-baseline.css";
import "./styles/modal-overrides.css";
import "./styles/carousel-mode.css";
import "./styles/topbar-profile.css";
import "./styles/admin-shell.css";
import "./styles/admin-controls.css";
import "./styles/admin-responsive.css";
import "./styles/theme.css";
import { RootProviders } from "@/components/providers/root-providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  description: "APPS Calendar - Team scheduling and announcements",
  title: "APPS Calendar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme script sets data-theme on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: fixed string from our code; must run before first paint to avoid a theme flash.
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
          id="theme-init"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
