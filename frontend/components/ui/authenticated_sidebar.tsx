"use client";

import Link from "next/link";
import {useState} from "react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
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
                                          <div onClick={handleClick}>
                                              <SidebarMenuButton className="w-full">
                                                  Study Tools
                                              </SidebarMenuButton>
                                              {isClicked && (
                                                <>
                                                  <SidebarGroupLabel>Create</SidebarGroupLabel>
                                                  <div className="ml-3 border-l pl-3">
                                                    <SidebarMenu>
                                                      <SidebarMenuItem>
                                                        <Link href="/dashboard" className="block w-full">
                                                          <SidebarMenuButton>Practice Exam</SidebarMenuButton>
                                                        </Link>  
                                                      </SidebarMenuItem>
                                                      <SidebarMenuItem>
                                                          <SidebarMenuButton>Study Guide</SidebarMenuButton>
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
                                                          <SidebarMenuButton>My Planner</SidebarMenuButton>
                                                      </SidebarMenuItem>
                                                      <SidebarMenuItem>
                                                          <SidebarMenuButton>Timer</SidebarMenuButton>
                                                      </SidebarMenuItem>
                                                    </SidebarMenu>  
                                                </div> 
                                              </>     
                                              )}
                                              
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