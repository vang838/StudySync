import Header from "@/components/ui/header";
import Sidebars from "@/components/ui/authenticated_sidebar";
import StudentDashboardPage from "@/app/dashboard/page";

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header/>
      <Sidebars>
        <StudentDashboardPage/>
      </Sidebars>
    </div>
  );
}
