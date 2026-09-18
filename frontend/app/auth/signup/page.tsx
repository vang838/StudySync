import Image from "next/image";
import "../auth.css";
export default function SignUp()
{
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
                        <form>
                            <div>
                                <label htmlFor ="email"></label>
                                <input type="text" name="email" id="email" value ="Email Address" required />
                            </div>
                            <div>
                                <label htmlFor ="pwd"></label>
                                <input type="password" name="pwd" id="pwd" value = "Enter Password" required />
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