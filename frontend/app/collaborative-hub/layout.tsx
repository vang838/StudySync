
import type { ReactNode } from "react";

import Header from "@/components/ui/header";
import Sidebars from "@/components/ui/authenticated_sidebar";

export default function CollaborativeHubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <Sidebars>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </Sidebars>
    </div>
  );
}
