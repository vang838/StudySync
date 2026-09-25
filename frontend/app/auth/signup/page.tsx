"use client";

import Image from "next/image";
import "../auth.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function SignUp()
{
    const router = useRouter();
    const[fname,setFname] = useState("");
    const[lname,setLname] = useState("");
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
            setError("Password must be at least 8 characters.");
            return;
        }

        try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            first_name: fname,
            last_name: lname,
            email: email,
            password:password
        }),
        });
        const data = await res.json();

        console.log("Status:", res.status);
        console.log("Backend response:", data);

        if (!res.ok) {
            setError(data.detail ?? "Something went wrong.");
            return;
        }

        router.push("/dashboard");
        router.refresh();
        } catch {
            setError("Something went wrong.");
        }

    }

    return(
                
        <main>
            <div className = "auth-box">
                <div className = "auth-container">
                    <div className = "auth-item">
                        <Image src="/StudySync.png" alt="StudySync logo" width={192} height={60} priority></Image>

                        <div className = "auth-text">
                            <h2>Welcome</h2>
                            <p>Sign Up to create a Study Sync account</p>
                        </div>

                    </div>
                    <div className = "auth-item">
                        <form onSubmit={handleSubmit}>
                            <div>
                                <div>
                                <label htmlFor ="fname"></label>
                                <input type="text" placeholder="First Name" onChange={(e) => setFname(e.target.value)} name="fname" id="fname" value ={fname} required />
                                </div>
                                <div>
                                <label htmlFor ="lname"></label>
                                <input type="text" placeholder="Last Name" onChange={(e) => setLname(e.target.value)} name="lname" id="lname" value ={lname} required />
                                </div>
                                
                            </div>
                            <div>
                                <label htmlFor ="email"></label>
                                <input type="text" placeholder="Enter Email" onChange={(e) => setEmail(e.target.value)} name="email" id="email" value ={email} required />
                            </div>
                            <div>
                                <label htmlFor ="pwd"></label>
                                <input type="password" placeholder="Enter Password" onChange={(e) => setPassword(e.target.value)} name="pwd" id="pwd" value={password} required />
                            </div>

                            <button className="buttons">Continue</button>  
                            
                        </form>
                        
                    </div>
                    <div className = "auth-item">
                        <p className = "auth-text" >Have an account? <a href="/auth/signin" className="auth-link">Sign in</a></p>
                    </div>
                </div>
            </div>
                    
        </main>

        
    )
}