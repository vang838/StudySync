import Image from "next/image";


export default function Footer() {
  return (
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
  );
}

export { Footer }