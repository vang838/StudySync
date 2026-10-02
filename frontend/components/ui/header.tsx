"use client";

import Image from "next/image";
import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {HugeiconsIcon} from "@hugeicons/react";
import {
    UserIcon
} from "@hugeicons/core-free-icons";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { useState,useEffect } from "react";

type UserProfile = {
    user_id: number;
    first_name: string;
};

export default function Header() {
 
const [greeting, setGreeting] = useState("Guest");
const [isHovered, setIsHovered] = useState(false);
const [userId, setUserId] = useState<number | null>(null);
 useEffect(() => {

    const userId = localStorage.getItem("user_id");

    if (!userId) {
        return;
    }

        fetch(`/api/users/${encodeURIComponent(userId)}`)
    .then((res) => {
      if (!res.ok) throw new Error("Could not load user");
            return res.json();
    })
        .then((user: UserProfile) => {
            setUserId(user.user_id);
            setGreeting(user.first_name);
        })
    .catch(() => setGreeting("there"));

 },[]);

 async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
     localStorage.removeItem("user_id");
    window.location.replace("/auth/signin");
  }

  return (
    <header className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center border-b-4 border-amber-400 bg-white px-8 text-foreground">
        
                 
        <Link
            href="/"
            aria-label="Go to StudySync main page"
             className="justify-self-start"
            >
            <Image className = "-translate-y-2" src="/StudySync.png" alt="StudySync logo" width={125} height={50} priority/>
        </Link>
        
        {/*Options that's in the middle */}
        <NavigationMenu className="max-w-none justify-self-center -translate-y-2">
            <NavigationMenuList className="flex items-center gap-6">
                <NavigationMenuItem>
                    <NavigationMenuLink href="/dashboard" data-active="true" className="py-2 text-sm text-foreground">
                        Overview
                    </NavigationMenuLink>
                </NavigationMenuItem>
        
                <NavigationMenuItem>
                    <NavigationMenuLink href="#sessions" className="py-2 text-sm text-foreground">
                        Sessions
                    </NavigationMenuLink>
                </NavigationMenuItem>
        
                <NavigationMenuItem>
                    <NavigationMenuLink href="/professors/professor_search" className="py-2 text-sm text-foreground">
                        Professor Search
                    </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <NavigationMenuLink href="/courses/course_search" className="py-2 text-sm text-foreground">
                        Course Search
                    </NavigationMenuLink>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
        
        {/*Place the signin/signout buttons*/}
        <div className="relative z-50 justify-self-end -translate-y-2">
            <NavigationMenu className="max-w-none">
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                            <HugeiconsIcon icon={UserIcon} size={20} strokeWidth={2} />
                            {isHovered && (
                                    <div className="absolute right-0 top-full z-50 w-48 pt-2">
                                    <Card className="w-full shadow-md" size="sm"> 
                                        <CardContent className="grid gap-0.5 p-1">
                                            {userId !== null && <Link href={`/users/${userId}/profile`} className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">Profile</Link>}
                                            {userId !== null && <Link href={`/users/${userId}/settings`} className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">Setting</Link>}
                                            {userId !== null && <Link href={`/users/${userId}/uploads`} className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">Uploads</Link>}
                                            {userId !== null && <Link href={`/users/${userId}/ratings`} className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">Your Ratings</Link>}
                                            <button type="button" onClick={logout} className="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted">Logout</button>
                                        </CardContent>
                                    </Card>
                                    </div>
                            )}
                        </div>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>
        </div>
        
    </header>
  );
}

export { Header }