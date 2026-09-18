import Image from "next/image";
import "../auth.css";

export default function ForgotPassword() {
  return (
    <main>
      <div className="auth-box">
        <div className="auth-container">

          <div className="auth-item">
            <Image
              src="/StudySync.png"
              alt="StudySync logo"
              width={192}
              height={60}
              priority
            />

            <div className="auth-text">
              <h2>Forgot Password?</h2>
              <p>Enter your email address to recover your account</p>
            </div>
          </div>

          <div className="auth-item">
            <form action="/auth/resetpassword">
              <div>
                <label htmlFor="email"></label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="Email Address"
                  required
                />
              </div>

              <button className="buttons" type="submit">
                Continue
              </button>
            </form>
          </div>

          <div className="auth-item">
            <p className="auth-text">
              Remember your password?{" "}
              <a href="/auth/signin" className="auth-link">
                Sign in
              </a>
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}