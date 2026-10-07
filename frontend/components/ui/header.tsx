"use client";

import Image from "next/image";
import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

export default function Header() {

 async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
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
                    <NavigationMenuLink href="/courses/course_search" className="py-2 text-sm text-foreground">
                        Course Search
                    </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <NavigationMenuLink href="/professors" className="py-2 text-sm text-foreground">
                        Professor Search
                    </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <NavigationMenuLink href="/collaborative-hub" className="py-2 text-sm text-foreground">
                        Collaborative Hub
                    </NavigationMenuLink>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
        
        {/*Place the signin/signout buttons*/}
        <div className="justify-self-end -translate-y-2">
            <NavigationMenu className="max-w-none">
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <NavigationMenuLink  onClick={logout} className="py-2 text-sm">
                         Logout
                        </NavigationMenuLink>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>
        </div>
        
    </header>
  );
}

export { Header }