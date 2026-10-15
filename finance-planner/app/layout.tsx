import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Finance Planner",
  description: "Plan goals, track monthly cash flow and see your net worth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased flex flex-col">
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-8">{children}</main>
        <footer className="border-t border-stone-200 px-4 py-4 text-center text-xs text-stone-600">
          This is a planning tool, not investment advice.{" "}
          <Link href="/privacy" className="underline">
            Privacy policy
          </Link>
        </footer>
      </body>
    </html>
  );
}
