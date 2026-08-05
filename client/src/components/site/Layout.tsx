import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col  text-foreground w-full">
      <Navbar />
      <main className="flex-1 w-full pt-16">{children}</main>
      <Footer />
    </div>
  );
}
