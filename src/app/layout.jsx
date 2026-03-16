import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SidebarProvider } from "@/context/SidebarContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "cSU — Continuous Status Updates",
  description: "Continuous Status Updates application by xLM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <SidebarProvider>
            {/* Aurora mesh + blueprint grid background */}
            <div
              className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
              style={{
                background: "linear-gradient(180deg, #f5faf8 0%, #eef6f3 40%, #e8f2f8 70%, #e4eef6 100%)",
              }}
            >
              <div className="bg-aurora bg-aurora-1" />
              <div className="bg-aurora bg-aurora-2" />
              <div className="bg-aurora bg-aurora-3" />
              <div className="bg-blueprint-grid" />
            </div>
            {children}
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
