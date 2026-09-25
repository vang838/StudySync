"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import "../auth.css";

export default function ResetPassword() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email") ?? "";
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSuccess("");

        if (!email) {
            setError("Missing email. Please return to the forgot password page.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/resetpassword`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail ?? "Unable to reset password.");
                return;
            }

            setError("");
            setSuccess(data.message || "Password reset successfully.");
            router.push("/auth/signin");
        } catch {
            setError("Network error. Please try again.");
        }
    }

    return(
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
                            <h2>Reset Password</h2>
                            <p>Enter your new password</p>
                        </div>
                    </div>

                    <div className="auth-item">
                        <form onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="password"></label>
                                <input
                                    type="password"
                                    name="password"
                                    id="password"
                                    placeholder="New Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword"></label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    id="confirmPassword"
                                    placeholder="Confirm Password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {error && (
                                <p className="auth-error">{error}</p>
                            )}
                            {success && (
                                <p className="auth-success">{success}</p>
                            )}

                            <button className="buttons" type="submit">
                                Reset Password
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