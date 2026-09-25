import Image from "next/image";
import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

export default function Header() {
  return (
    <header className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center border-b-4 border-amber-400 px-8">
        
                 
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
                    <NavigationMenuLink href="#overview" data-active="true" className="py-2 text-sm">
                        Overview
                    </NavigationMenuLink>
                </NavigationMenuItem>
        
                <NavigationMenuItem>
                    <NavigationMenuLink href="#sessions" className="py-2 text-sm">
                        Sessions
                    </NavigationMenuLink>
                </NavigationMenuItem>
        
                <NavigationMenuItem>
                    <NavigationMenuLink href="#resources" className="py-2 text-sm">
                        Resources
                    </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <NavigationMenuLink href="/dashboard" className="py-2 text-sm">
                        Student Dashboard
                    </NavigationMenuLink>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
        
        {/*Place the signin/signout buttons*/}
        <div className="justify-self-end -translate-y-2">
            <NavigationMenu className="max-w-none">
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <NavigationMenuLink  href="#signin" className="py-2 text-sm">
                            Sign In
                        </NavigationMenuLink>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>
        </div>
        
    </header>
  );
}

export { Header }