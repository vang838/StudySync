import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import CourseOverview from "@/components/course-overview/CourseOverview";

export const metadata: Metadata = {
  title: "Course Overview",
  description: "Central hub for all materials, discussions, and information related to a specific course.",
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  if (!courseId) {
    return <div>Error: Course ID not provided.</div>;
  }

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Course Workspace</p>
            <h1 className="font-heading text-3xl font-bold">Course Overview</h1>
            <p className="text-sm text-muted-foreground">Course ID: {courseId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/courses/course_search">
              <Button variant="secondary" size="s">Back to Catalog</Button>
            </Link>
            <Link href="/courses/create">
              <Button size="s">Create Course</Button>
            </Link>
          </div>
        </header>

        <Separator />

        <CourseOverview courseId={courseId} />
      </div>
    </main>
  );
}
