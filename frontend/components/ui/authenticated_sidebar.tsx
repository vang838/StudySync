"use client";

import Link from "next/link";
import {useState} from "react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import {Button} from "@/components/ui/button";

export default function Sidebars({children}: { children: React.ReactNode; }) {
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = () => {
    setIsClicked((prev) => !prev);
   };


    return (
        <>
            <SidebarProvider className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    <Sidebar className="md:top-0 md:h-full">
                        <SidebarHeader className="p-4">
                            <Button variant="secondary">+ New</Button>
                        </SidebarHeader>
                        <SidebarContent>
                            <SidebarGroup>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        <SidebarMenuItem>
                                          <Link href="/dashboard" className="block w-full">
                                            <SidebarMenuButton>Home</SidebarMenuButton>
                                          </Link>  
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton>Library</SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                          <Link href="/collaborative-hub" className="block w-full">
                                            <SidebarMenuButton>Collaborative Hub</SidebarMenuButton>
                                          </Link>  
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                          <Link href="/dashboard/study-center" className="block w-full">
                                              <SidebarMenuButton className="w-full">
                                                  Study sessions
                                              </SidebarMenuButton>
                                          </Link>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                          <div>
                                              <SidebarMenuButton className="w-full justify-between" onClick={handleClick} aria-expanded={isClicked} aria-controls="study-tools-items">
                                                  <span>Study Tools</span>
                                                  <span aria-hidden className={`relative block size-3 shrink-0 text-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none ${isClicked ? "rotate-180" : ""} before:absolute before:left-0 before:top-1/2 before:h-[2px] before:w-2 before:-translate-y-1/2 before:rotate-[-45deg] before:rounded-full before:bg-current after:absolute after:right-0 after:top-1/2 after:h-[2px] after:w-2 after:-translate-y-1/2 after:rotate-[45deg] after:rounded-full after:bg-current`}/>
                                              </SidebarMenuButton>
                                              <div id="study-tools-items" aria-hidden={!isClicked} inert={!isClicked} className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${isClicked ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                                <div className={`min-h-0 overflow-hidden transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${isClicked ? "opacity-100" : "opacity-0"}`}>
                                                  <SidebarGroupLabel>Create</SidebarGroupLabel>
                                                  <div className="ml-3 border-l pl-3">
                                                    <SidebarMenu>
                                                      <SidebarMenuItem>
                                                        <Link href="/dashboard/study-center" className="block w-full">
                                                          <SidebarMenuButton>Practice Exam</SidebarMenuButton>
                                                        </Link>  
                                                      </SidebarMenuItem>
                                                      <SidebarMenuItem>
                                                        <Link href="/dashboard/study-center" className="block w-full">
                                                          <SidebarMenuButton>Study Guide</SidebarMenuButton>
                                                        </Link>  
                                                      </SidebarMenuItem>
                                                      <SidebarMenuItem>
                                                        <Link href="/dashboard/flashcards" className="block w-full">
                                                          <SidebarMenuButton>Flashcards</SidebarMenuButton>
                                                        </Link>  
                                                      </SidebarMenuItem>
                                                    </SidebarMenu>
                                                  </div>
                                                  <SidebarGroupLabel>Resources</SidebarGroupLabel>
                                                  <div className="ml-3 border-l pl-3">
                                                    <SidebarMenu>
                                                      <SidebarMenuItem>
                                                        <Link href="/dashboard/planner" className="block w-full">
                                                          <SidebarMenuButton>Task Navigator</SidebarMenuButton>
                                                        </Link>
                                                      </SidebarMenuItem>
                                                      <SidebarMenuItem>
                                                          <Link href="/dashboard/timer" className="block w-full">
                                                            <SidebarMenuButton>Timer</SidebarMenuButton>
                                                          </Link>
                                                      </SidebarMenuItem>
                                                    </SidebarMenu>  
                                                </div> 
                                                </div>
                                              </div>
                                          </div>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        </SidebarContent>
                    </Sidebar>

                    <SidebarInset className="min-h-0 flex-1 overflow-hidden">
                        <SidebarTrigger/>
                        {children}
                    </SidebarInset>
                </div>
            </SidebarProvider>
        </>

    );
}

export {Sidebars}