import type {Metadata} from "next";
import type {ReactNode} from "react";
import Header from "@/components/ui/header";
import Sidebars from "@/components/ui/authenticated_sidebar";
import {StudyTasksProvider} from "@/components/dashboard/StudyTasksProvider";

export const metadata: Metadata = {
    title: "Student Dashboard | StudySync",
};

export default function DashboardLayout({
                                            children,
                                        }: {
    children: ReactNode;
}) {
    return (
        <div className="flex h-screen flex-col overflow-hidden">
            <Header/>
            <Sidebars>
                <StudyTasksProvider>{children}</StudyTasksProvider>
            </Sidebars>
        </div>
    );
}