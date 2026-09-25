"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../auth.css";

export default function SignIn() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (!email.trim()) {
            setError("Please enter your email.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.detail ?? "Invalid email or password.");
                return;
            }

            router.push("/dashboard");
            router.refresh();
        } catch {
            setError("Network error. Please try again.");
        }
    }

    return(
        <main>
            <div className="auth-box">
                <div className="auth-container">
                    <div className="auth-item">
                        <Image src="/StudySync.png" alt="StudySync logo" width={192} height={60} priority />

                        <div className="auth-text">
                            <h2>Welcome</h2>
                            <p>Sign In with your Study Sync account</p>
                        </div>
                    </div>
                    <div className = "auth-item">
                        <form onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor ="email"></label>
                                <input type="text" placeholder="Enter Email" onChange={(e) => setEmail(e.target.value)} name="email" id="email" value ={email} required />
                            </div>
                            <div>
                                <label htmlFor ="pwd"></label>
                                <input type="password" placeholder="Enter Password" onChange={(e) => setPassword(e.target.value)} name="pwd" id="pwd" value = {password} required />
                            </div>

                            {error && <p className="auth-error">{error}</p>}

                            <p className="auth-text">
                                <a href="/auth/forgotpassword" className="auth-link">Forgot password?</a>
                            </p>

                            <button className="buttons" type="submit">Continue</button>
                        </form>
                    </div>

                    <div className="auth-item">
                        <p className="auth-text">Don't have an account? <a href="/auth/signup" className="auth-link">Sign up</a></p>
                    </div>
                </div>
            </div>
        </main>
    );
}