
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type SidebarNavLinkProps = {
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
};

function SidebarNavLink({ href, children, isActive = false }: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive}
      className="flex w-full items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
    >
      {children}
    </Link>
  );
}

export default function Sidebars({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudyToolsRoute = ["/dashboard/study-center", "/dashboard/flashcards", "/dashboard/planner", "/dashboard/timer"]
    .some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const [isClicked, setIsClicked] = useState(isStudyToolsRoute);

  return (
    <SidebarProvider className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar className="md:top-0 md:h-full">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>My Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarNavLink href="/dashboard" isActive={pathname === "/dashboard"}>
                      Dashboard
                    </SidebarNavLink>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled title="Library is not available yet">
                      Library
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarNavLink href="/dashboard/study-center" isActive={pathname === "/dashboard/study-center"}>
                      Study Sessions
                    </SidebarNavLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      className="w-full justify-between"
                      onClick={() => setIsClicked((prev) => !prev)}
                      aria-expanded={isClicked}
                      aria-controls="study-tools-items"
                    >
                      <span>Study Tools</span>
                      <span aria-hidden="true" className={`relative block size-3 shrink-0 text-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none ${isClicked ? "rotate-180" : ""} before:absolute before:left-0 before:top-1/2 before:h-[2px] before:w-2 before:-translate-y-1/2 before:rotate-[-45deg] before:rounded-full before:bg-current after:absolute after:right-0 after:top-1/2 after:h-[2px] after:w-2 after:-translate-y-1/2 after:rotate-[45deg] after:rounded-full after:bg-current`} />
                    </SidebarMenuButton>

                    <div
                      id="study-tools-items"
                      aria-hidden={!isClicked}
                      inert={!isClicked}
                      className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${isClicked ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                    >
                      <div className={`min-h-0 overflow-hidden transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${isClicked ? "opacity-100" : "opacity-0"}`}>
                        <SidebarGroupLabel>Create</SidebarGroupLabel>
                        <div className="ml-3 border-l pl-3">
                          <SidebarMenu>
                            <SidebarMenuItem>
                              <SidebarNavLink href="/dashboard/study-center">
                                Practice Exam
                              </SidebarNavLink>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                              <SidebarNavLink href="/dashboard/study-center">
                                Study Guide
                              </SidebarNavLink>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                              <SidebarNavLink
                                href="/dashboard/flashcards"
                                isActive={pathname === "/dashboard/flashcards" || pathname.startsWith("/dashboard/flashcards/")}
                              >
                                Flashcards
                              </SidebarNavLink>
                            </SidebarMenuItem>
                          </SidebarMenu>
                        </div>

                        <SidebarGroupLabel>Resources</SidebarGroupLabel>
                        <div className="ml-3 border-l pl-3">
                          <SidebarMenu>
                            <SidebarMenuItem>
                              <SidebarNavLink href="/dashboard/planner" isActive={pathname === "/dashboard/planner"}>
                                Task Navigator
                              </SidebarNavLink>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                              <SidebarNavLink href="/dashboard/timer" isActive={pathname === "/dashboard/timer"}>
                                Timer
                              </SidebarNavLink>
                            </SidebarMenuItem>
                          </SidebarMenu>
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
          <SidebarTrigger />
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export { Sidebars }
