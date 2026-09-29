import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Aria | Aura Skincare", description: "A little care, a conversation away. Meet Aura's AI voice care specialist." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
