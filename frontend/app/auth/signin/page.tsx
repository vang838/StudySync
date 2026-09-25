"use client";

import Image from "next/image";
import "../auth.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function SignIn()
{
    const router = useRouter();
    const[password,setPassword] = useState("");
    const[email,setEmail] = useState("");
    const[error,setError] = useState("");
    const [success, setSuccess] = useState("");


    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) 
    {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (password.length < 8) 
            {
                setError("They do not match");
                return;
            }


        try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        console.log("Status:", res.status);
        console.log("Backend response:", data);

        if (!res.ok) setError(data.error ?? "Something went wrong.");
        else { router.push("/main/public_homepage"); router.refresh(); }
        } catch {
        setError("Network error. Please try again.");
        }

        setError("");
        setSuccess("Password reset successfully.");
    }
    return(
                
        <main>
            <div className = "auth-box">
                <div className = "auth-container">
                    <div className = "auth-item">
                        <Image src="/StudySync.png" alt="StudySync logo" width={192} height={60} priority></Image>

                        <div className = "auth-text">
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

                            <p className="auth-text">
                                <a href="/auth/forgotpassword" className="auth-link">Forgot password?</a>
                            </p>

                            <button className="buttons">Continue</button>  
                            
                        </form>
                        
                    </div>
                    <div className = "auth-item">
                        <p className = "auth-text" >Don't have an account? <a href="/auth/signup" className="auth-link">Sign up</a></p>
                    </div>
                </div>
            </div>
                    
        </main>

        
    )
}