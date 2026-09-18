import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./auth.css";

const images = ["/Auth_BG.png","/Auth_BG1.png", "/Auth_BG2.png", "/Auth_BG3.png"]

async function getRandomItem() 
{
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function AuthLayout({ children }: LayoutProps<"/">) {

  const featuredItem = await getRandomItem();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header>
          <div className="logo-container">
            <a href="/" aria-label="StudySync home">
              <Image
                src="/StudySync.png"
                alt="StudySync logo"
                width={180}
                height={48}
                priority
              />
            </a>
          </div>
        </header>
        <main className="auth-main" style={{ backgroundImage: featuredItem ? `url(${featuredItem})` : 'none' }}>
            <div className="auth-content">
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
                <a href="/">Home</a>
                <a href="/about">About</a>
                <a href="/features">Features</a>
            </div>

            <div>
                <h3>Support</h3>
                <a href="/help">Help Center</a>
                <a href="/contact">Contact Us</a>
            </div>

            <div>
                <h3>Legal</h3>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms of Use</a>
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
