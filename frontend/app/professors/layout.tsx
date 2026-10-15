import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "@/components/ui/header";
import Sidebars from "@/components/ui/authenticated_sidebar";

export const metadata: Metadata = {
  title: "Professor Search | StudySync",
};

export default function ProfessorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <Sidebars>{children}</Sidebars>
    </div>
  );
}
