"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../auth.css";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/forgotpassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Unable to process your request.");
        return;
      }

      setSuccess(data.message || "If an account exists for this email, a password reset link has been sent.");
      router.push(`/auth/resetpassword?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Network error. Please try again.");
    }
  }

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
            <form onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email"></label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && <p className="auth-error">{error}</p>}
              {success && <p className="auth-success">{success}</p>}

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