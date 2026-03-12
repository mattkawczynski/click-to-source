import type { ReactNode } from "react";
import ClickToSourceClient from "./click-to-source-client";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClickToSourceClient />
        {children}
      </body>
    </html>
  );
}
