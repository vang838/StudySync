"use client";

import Image from "next/image";
import { useState } from "react";
import "../auth.css";

export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess("");

    if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
    }

    if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
    }

    setError("");
    setSuccess("Password reset successfully.");
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