import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./main.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function MainLayout({ children }: LayoutProps<"/">) {


  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header>
          <div className="logo-container">
            <Link href="/" aria-label="StudySync home">
              <Image
                src="/StudySync.png"
                alt="StudySync logo"
                width={180}
                height={48}
                priority
              />
            </Link>
          </div>
        </header>
        <main>
            <div>
                {children}
            </div>
        </main>
        <footer>
            <div className="footer-container">

            <div className="footer-brand">
            <Image
                src="/StudySync.png"
                alt="StudySync logo"
                width={180}
                height={48}
            />

            <p>
                Learn together. Study smarter.
            </p>
            </div>

            <div className="footer-links">
            <div>
                <h3>StudySync</h3>
                <Link href="/">Home</Link>
                <Link href="/about">About</Link>
                <Link href="/features">Features</Link>
            </div>

            <div>
                <h3>Support</h3>
                <Link href="/help">Help Center</Link>
                <Link href="/contact">Contact Us</Link>
            </div>

            <div>
                <h3>Legal</h3>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms of Use</Link>
            </div>
            </div>

        </div>

        <div className="footer-bottom">
            <p>© 2026 StudySync. All rights reserved.</p>
        </div>
        </footer>
      </body>
    </html>
  );
}
